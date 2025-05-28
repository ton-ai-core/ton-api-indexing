import pLimit from 'p-limit';
import { GraphQLClient } from './GraphQLClient';
import { RestClient } from './RestClient';
import { 
  IndexerConfig, 
  AccountNode, 
  ProcessingResult, 
  BatchSummary,
  IterationResult 
} from '../types';
import { Logger } from '../utils/logger';
import {
  readCursor,
  saveCursor,
  contractFileExists,
  saveContractData,
  ensureDataDirectory,
} from '../utils/fileUtils';
import { AddressFilter, createDefaultAddressFilterConfig } from '../utils/addressFilter';

/**
 * Main indexer service that orchestrates the entire indexing process
 */
export class IndexerService {
  private graphqlClient: GraphQLClient;
  private restClient: RestClient;
  private config: IndexerConfig;
  private logger: Logger;
  private limit: ReturnType<typeof pLimit>;
  private addressFilter: AddressFilter;

  constructor(config: IndexerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Initialize clients
    this.graphqlClient = new GraphQLClient(config, logger);
    this.restClient = new RestClient(config, logger);
    
    // Initialize address filter
    const filterConfig = createDefaultAddressFilterConfig();
    this.addressFilter = new AddressFilter(filterConfig, logger);
    
    // Set up concurrency limit for parallel processing
    this.limit = pLimit(config.maxConcurrentRequests);

    this.logger.info({
      maxConcurrentRequests: config.maxConcurrentRequests,
      accountsPerPage: config.accountsPerPage,
      addressFilterEnabled: true,
    }, 'Indexer service initialized');
  }

  /**
   * Test connections to both GraphQL and REST APIs
   */
  async testConnections(): Promise<boolean> {
    this.logger.info('Testing API connections...');
    
    const [graphqlOk, restOk] = await Promise.all([
      this.graphqlClient.testConnection(),
      this.restClient.testConnection(),
    ]);

    if (graphqlOk && restOk) {
      this.logger.info('All API connections successful');
      return true;
    } else {
      this.logger.error({
        graphqlOk,
        restOk,
      }, 'Some API connections failed');
      return false;
    }
  }

  /**
   * Run one iteration of the indexer
   */
  async runIteration(): Promise<IterationResult> {
    this.logger.info('Starting indexer iteration');

    // Ensure data directory exists
    await ensureDataDirectory(this.config.dataDirectory, this.logger);

    // Read current cursor
    const cursor = await readCursor(this.config.cursorFilePath, this.logger);

    // Fetch accounts from GraphQL
    const response = await this.graphqlClient.fetchAccounts(
      this.config.accountsPerPage,
      cursor
    );

    const { nodes: accounts, pageInfo } = response.allAccounts;

    if (accounts.length === 0) {
      this.logger.info('No accounts to process');
      return {
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          errors: [],
        },
        hasNextPage: false,
        endCursor: null,
      };
    }

    // Process accounts in parallel
    const results = await this.processAccountsBatch(accounts);

    // Save new cursor if we have one
    if (pageInfo.endCursor) {
      await saveCursor(this.config.cursorFilePath, pageInfo.endCursor, this.logger);
    }

    // Compile summary
    const summary = this.compileBatchSummary(results);
    
    // Log address filter statistics
    this.addressFilter.logStats();
    
    this.logger.info({
      ...summary,
      hasNextPage: pageInfo.hasNextPage,
      endCursor: pageInfo.endCursor,
      filterStats: this.addressFilter.getStats(),
    }, 'Indexer iteration completed');

    return {
      summary,
      hasNextPage: pageInfo.hasNextPage,
      endCursor: pageInfo.endCursor,
    };
  }

  /**
   * Run the indexer continuously until no more pages
   */
  async runComplete(): Promise<void> {
    this.logger.info('Starting complete indexer run');

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        const summary = await this.runIteration();
        
        totalProcessed += summary.summary.total;
        totalSuccessful += summary.summary.successful;
        totalFailed += summary.summary.failed;
        totalSkipped += summary.summary.skipped;

        // Check if we have more pages
        const cursor = await readCursor(this.config.cursorFilePath, this.logger);
        if (!cursor) {
          hasNextPage = false;
        }

        // Small delay between iterations
        if (hasNextPage && this.config.requestDelayMs > 0) {
          await this.sleep(this.config.requestDelayMs);
        }

      } catch (error) {
        this.logger.error({ error }, 'Error during indexer iteration');
        throw error;
      }
    }

    this.logger.info({
      totalProcessed,
      totalSuccessful,
      totalFailed,
      totalSkipped,
    }, 'Complete indexer run finished');
  }

  /**
   * Process a batch of accounts in parallel
   */
  private async processAccountsBatch(accounts: AccountNode[]): Promise<ProcessingResult[]> {
    this.logger.info({ accountsCount: accounts.length }, 'Processing accounts batch');

    const tasks = accounts.map(account => 
      this.limit(() => this.processAccount(account.rawAddress))
    );

    return Promise.all(tasks);
  }

  /**
   * Process a single account
   */
  private async processAccount(rawAddress: string): Promise<ProcessingResult> {
    try {
      // Check if address should be filtered before processing
      const filterResult = this.addressFilter.shouldProcessAddress(rawAddress);
      
      if (!filterResult.shouldProcess) {
        this.logger.debug({ 
          address: rawAddress, 
          skipReason: filterResult.skipReason 
        }, 'Address skipped by filter');
        
        return {
          address: rawAddress,
          success: true,
          skipped: true,
          error: `Filtered: ${filterResult.skipReason}`,
        };
      }

      // Check if file already exists
      const fileExists = await contractFileExists(this.config.dataDirectory, rawAddress);
      
      if (fileExists) {
        this.logger.debug({ address: rawAddress }, 'Contract file already exists, skipping');
        return {
          address: rawAddress,
          success: true,
          skipped: true,
        };
      }

      // Fetch contract data
      const contractData = await this.restClient.inspectContract(rawAddress);

      // Save to file
      const filePath = await saveContractData(
        this.config.dataDirectory,
        rawAddress,
        contractData,
        this.logger
      );

      return {
        address: rawAddress,
        success: true,
        filePath,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error({
        address: rawAddress,
        error: errorMessage,
      }, 'Failed to process account');

      return {
        address: rawAddress,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Compile summary from processing results
   */
  private compileBatchSummary(results: ProcessingResult[]): BatchSummary {
    const summary: BatchSummary = {
      total: results.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    for (const result of results) {
      if (result.success) {
        if (result.skipped) {
          summary.skipped++;
        } else {
          summary.successful++;
        }
      } else {
        summary.failed++;
        if (result.error) {
          summary.errors.push({
            address: result.address,
            error: result.error,
          });
        }
      }
    }

    return summary;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 