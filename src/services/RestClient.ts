import axios, { AxiosInstance, AxiosError } from 'axios';
import { ContractInspectData, IndexerConfig, ApiError } from '../types';
import { Logger } from '../utils/logger';

/**
 * REST client service for TON API
 */
export class RestClient {
  private client: AxiosInstance;
  private config: IndexerConfig;
  private logger: Logger;

  constructor(config: IndexerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Initialize Axios client with default headers
    this.client = axios.create({
      baseURL: config.restUrl,
      headers: {
        'Authorization': `Bearer ${config.tonApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });

    this.logger.info({ baseURL: config.restUrl }, 'REST client initialized');
  }

  /**
   * Inspect a contract by its raw address
   */
  async inspectContract(rawAddress: string): Promise<ContractInspectData> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        this.logger.debug({ 
          address: rawAddress, 
          attempt, 
          maxRetries: this.config.maxRetries 
        }, 'Inspecting contract');

        const response = await this.client.get<ContractInspectData>(
          `/blockchain/accounts/${encodeURIComponent(rawAddress)}/inspect`
        );

        this.logger.debug({ 
          address: rawAddress, 
          status: response.status 
        }, 'Contract inspection successful');

        return response.data;

      } catch (error) {
        const { error: handledError, shouldRetry, delay } = this.handleError(error, rawAddress, attempt);
        lastError = handledError;

        // If this was the last attempt or we shouldn't retry, don't wait
        if (attempt === this.config.maxRetries + 1 || !shouldRetry) {
          break;
        }

        this.logger.warn({ 
          address: rawAddress, 
          attempt, 
          delay, 
          error: lastError.message 
        }, 'Retrying contract inspection');

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Test REST API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a known TON address
      const testAddress = 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N';
      await this.inspectContract(testAddress);
      this.logger.info('REST API connection test successful');
      return true;
    } catch (error) {
      this.logger.error({ error }, 'REST API connection test failed');
      return false;
    }
  }

  /**
   * Handle API errors with proper logging and error creation
   */
  private handleError(error: unknown, rawAddress: string, attempt: number): { error: Error, shouldRetry: boolean, delay: number } {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiError>;
      
      if (axiosError.response) {
        // Server responded with error status
        const { status, data, headers } = axiosError.response;
        const errorMessage = data?.error || data?.message || `HTTP ${status}`;
        
        // Special handling for rate limits (429)
        if (status === 429) {
          // Check for Retry-After header
          const retryAfter = headers['retry-after'] || headers['Retry-After'];
          let rateLimitDelay: number;
          
          if (retryAfter) {
            // Retry-After can be in seconds (number) or HTTP date
            const retryAfterSeconds = parseInt(retryAfter as string, 10);
            if (!isNaN(retryAfterSeconds)) {
              rateLimitDelay = retryAfterSeconds * 1000; // Convert to milliseconds
            } else {
              // If it's not a number, use exponential backoff
              rateLimitDelay = Math.min(this.config.retryDelayMs * Math.pow(2, attempt), 60000); // Max 60 seconds
            }
          } else {
            // Use exponential backoff for rate limits
            rateLimitDelay = Math.min(this.config.retryDelayMs * Math.pow(2, attempt), 60000); // Max 60 seconds
          }

          this.logger.warn({
            address: rawAddress,
            attempt,
            status,
            error: errorMessage,
            retryAfter,
            rateLimitDelay,
          }, 'Rate limit hit, waiting before retry');

          return {
            error: new Error(`Rate limit exceeded (${status}): ${errorMessage}`),
            shouldRetry: true,
            delay: rateLimitDelay,
          };
        }
        
        this.logger.error({
          address: rawAddress,
          attempt,
          status,
          error: errorMessage,
          statusText: axiosError.response.statusText,
        }, 'Contract inspection API error');

        return {
          error: new Error(`API error (${status}): ${errorMessage}`),
          shouldRetry: true,
          delay: this.config.retryDelayMs * attempt,
        };
      } else if (axiosError.request) {
        // Request was made but no response received
        this.logger.error({
          address: rawAddress,
          attempt,
          error: 'No response received',
          code: axiosError.code,
        }, 'Contract inspection network error');

        return {
          error: new Error(`Network error: ${axiosError.message}`),
          shouldRetry: true,
          delay: this.config.retryDelayMs * attempt,
        };
      }
    }

    // Other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error({
      address: rawAddress,
      attempt,
      error: errorMessage,
    }, 'Contract inspection unknown error');

    return {
      error: new Error(`Unknown error: ${errorMessage}`),
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