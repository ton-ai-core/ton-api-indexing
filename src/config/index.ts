import { config } from 'dotenv';
import { IndexerConfig } from '../types';

// Load environment variables
config();

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): IndexerConfig {
  // Validate required environment variables
  const requiredEnvVars = ['TONAPI_KEY'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }

  const configuration: IndexerConfig = {
    tonApiKey: process.env.TONAPI_KEY!,
    graphqlUrl: process.env.TONAPI_GRAPHQL_URL || 'https://tonapi.io/v2/graphql',
    restUrl: process.env.TONAPI_REST_URL || 'https://tonapi.io/v2',
    cursorFilePath: process.env.CURSOR_FILE_PATH || './cursor.txt',
    dataDirectory: process.env.DATA_DIRECTORY || './data',
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '4', 10),
    requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '100', 10),
    accountsPerPage: parseInt(process.env.ACCOUNTS_PER_PAGE || '100', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    logPretty: process.env.LOG_PRETTY === 'true',
  };

  // Validate numerical values
  if (configuration.maxConcurrentRequests <= 0 || configuration.maxConcurrentRequests > 10) {
    throw new Error('MAX_CONCURRENT_REQUESTS must be between 1 and 10');
  }

  if (configuration.accountsPerPage <= 0 || configuration.accountsPerPage > 1000) {
    throw new Error('ACCOUNTS_PER_PAGE must be between 1 and 1000');
  }

  if (configuration.maxRetries < 0 || configuration.maxRetries > 10) {
    throw new Error('MAX_RETRIES must be between 0 and 10');
  }

  return configuration;
} 