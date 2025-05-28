import { GraphQLClient as GQLClient, gql, ClientError } from 'graphql-request';
import { AllAccountsResponse, GraphQLVariables, IndexerConfig } from '../types';
import { Logger } from '../utils/logger';

/**
 * GraphQL query for fetching accounts with pagination
 */
const ALL_ACCOUNTS_QUERY = gql`
  query($first: Int!, $after: Cursor) {
    allAccounts(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        rawAddress
      }
    }
  }
`;

/**
 * GraphQL client service for TON API
 */
export class GraphQLClient {
  private client: GQLClient;
  private config: IndexerConfig;
  private logger: Logger;

  constructor(config: IndexerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Initialize GraphQL client with authorization header
    this.client = new GQLClient(config.graphqlUrl, {
      headers: {
        'Authorization': `Bearer ${config.tonApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.logger.info({ url: config.graphqlUrl }, 'GraphQL client initialized');
  }

  /**
   * Fetch accounts with pagination
   */
  async fetchAccounts(first: number, after?: string | null): Promise<AllAccountsResponse> {
    const variables: GraphQLVariables = {
      first,
      after: after || null,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        this.logger.debug({ 
          variables, 
          attempt, 
          maxRetries: this.config.maxRetries 
        }, 'Fetching accounts from GraphQL');
        
        const response = await this.client.request<AllAccountsResponse>(
          ALL_ACCOUNTS_QUERY,
          variables
        );

        this.logger.info({
          accountsCount: response.allAccounts.nodes.length,
          hasNextPage: response.allAccounts.pageInfo.hasNextPage,
          endCursor: response.allAccounts.pageInfo.endCursor,
        }, 'Successfully fetched accounts');

        return response;

      } catch (error) {
        const { error: handledError, shouldRetry, delay } = this.handleError(error, variables, attempt);
        lastError = handledError;

        // If this was the last attempt or we shouldn't retry, don't wait
        if (attempt === this.config.maxRetries + 1 || !shouldRetry) {
          break;
        }

        this.logger.warn({ 
          variables, 
          attempt, 
          delay, 
          error: lastError.message 
        }, 'Retrying GraphQL request');

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Test GraphQL connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.fetchAccounts(1);
      this.logger.info('GraphQL connection test successful');
      return true;
    } catch (error) {
      this.logger.error({ error }, 'GraphQL connection test failed');
      return false;
    }
  }

  /**
   * Handle GraphQL errors with proper logging and rate limit detection
   */
  private handleError(error: unknown, variables: GraphQLVariables, attempt: number): { error: Error, shouldRetry: boolean, delay: number } {
    if (error instanceof ClientError) {
      // Check for rate limit in GraphQL error
      const status = error.response?.status;
      const headers = error.response?.headers;
      
      if (status === 429) {
        // Check for Retry-After header
        const retryAfter = (headers as Record<string, string>)?.['retry-after'] || 
                          (headers as Record<string, string>)?.['Retry-After'];
        let rateLimitDelay: number;
        
        if (retryAfter) {
          const retryAfterSeconds = parseInt(retryAfter, 10);
          if (!isNaN(retryAfterSeconds)) {
            rateLimitDelay = retryAfterSeconds * 1000; // Convert to milliseconds
          } else {
            rateLimitDelay = Math.min(this.config.retryDelayMs * Math.pow(2, attempt), 60000); // Max 60 seconds
          }
        } else {
          // Use exponential backoff for rate limits
          rateLimitDelay = Math.min(this.config.retryDelayMs * Math.pow(2, attempt), 60000); // Max 60 seconds
        }

        this.logger.warn({
          variables,
          attempt,
          status,
          retryAfter,
          rateLimitDelay,
          error: error.message,
        }, 'GraphQL rate limit hit, waiting before retry');

        return {
          error: new Error(`GraphQL rate limit exceeded (${status}): ${error.message}`),
          shouldRetry: true,
          delay: rateLimitDelay,
        };
      }

      this.logger.error({ 
        error: error.message,
        status,
        variables,
        attempt,
      }, 'GraphQL client error');

      return {
        error: new Error(`GraphQL request failed: ${error.message}`),
        shouldRetry: true,
        delay: this.config.retryDelayMs * attempt,
      };
    }

    // Other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error({ 
      error: errorMessage, 
      variables,
      attempt,
    }, 'GraphQL unknown error');

    return {
      error: new Error(`GraphQL request failed: ${errorMessage}`),
      shouldRetry: false,
      delay: 0,
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 