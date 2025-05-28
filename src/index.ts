#!/usr/bin/env node

import { loadConfig } from './config';
import { createLogger } from './utils/logger';
import { IndexerService } from './services/IndexerService';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  let logger: ReturnType<typeof createLogger> | undefined;
  
  try {
    // Load configuration
    const config = loadConfig();
    
    // Initialize logger
    logger = createLogger(config);
    logger.info('TON API Indexer starting...');
    logger.info({
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      config: {
        graphqlUrl: config.graphqlUrl,
        restUrl: config.restUrl,
        dataDirectory: config.dataDirectory,
        maxConcurrentRequests: config.maxConcurrentRequests,
        accountsPerPage: config.accountsPerPage,
      },
    }, 'Configuration loaded');

    // Initialize indexer service
    const indexer = new IndexerService(config, logger);

    // Test API connections first
    logger.info('Testing API connections...');
    const connectionsOk = await indexer.testConnections();
    
    if (!connectionsOk) {
      logger.error('Failed to connect to APIs. Please check your configuration and network connection.');
      process.exit(1);
    }

    // Set up graceful shutdown
    let isShuttingDown = false;
    
    const shutdown = (signal: string) => {
      if (isShuttingDown) {
        if (logger) logger.warn('Force shutdown requested');
        process.exit(1);
      }
      
      isShuttingDown = true;
      if (logger) logger.info({ signal }, 'Received shutdown signal, gracefully shutting down...');
      
      // Give some time for current operations to complete
      setTimeout(() => {
        if (logger) logger.info('Shutdown complete');
        process.exit(0);
      }, 5000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Check command line arguments for run mode
    const args = process.argv.slice(2);
    const runMode = args[0] || 'iteration';

    if (runMode === 'infinite' || runMode === 'daemon') {
      logger.info('🔄 Starting INFINITE indexing mode - will run continuously');
      logger.info('📁 Will automatically save cursor to cursor.txt after each iteration');
      logger.info('🛡️ Will restart from cursor.txt if process restarts');
      logger.info('⏹️ Use Ctrl+C or SIGTERM to stop gracefully');
      
      await runInfiniteMode(indexer, logger, () => isShuttingDown);
      
    } else if (runMode === 'timed') {
      const minutes = parseInt(args[1] || '10', 10);
      logger.info(`⏰ Starting TIMED indexing mode - will run for ${minutes} minutes`);
      logger.info('📁 Will automatically save cursor to cursor.txt after each iteration');
      logger.info('🛡️ Perfect for GitHub Actions scheduled runs');
      
      await runTimedMode(indexer, logger, minutes, () => isShuttingDown);
      
    } else if (runMode === 'complete') {
      logger.info('Running complete indexer (all pages)');
      await indexer.runComplete();
    } else {
      logger.info('Running single iteration');
      const summary = await indexer.runIteration();
      
      logger.info({
        summary,
      }, 'Indexer iteration completed successfully');
    }

    logger.info('TON API Indexer finished successfully');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (logger) {
      logger.error({ 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      }, 'TON API Indexer failed');
    } else {
      console.error('TON API Indexer failed:', errorMessage);
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    
    process.exit(1);
  }
}

/**
 * Run indexer in infinite mode with automatic cursor persistence
 */
async function runInfiniteMode(
  indexer: IndexerService, 
  logger: ReturnType<typeof createLogger>,
  shouldStop: () => boolean
): Promise<void> {
  let iterationCount = 0;
  const startTime = Date.now();
  
  logger.info('🚀 Infinite indexing mode started');
  
  while (!shouldStop()) {
    try {
      iterationCount++;
      const iterationStartTime = Date.now();
      
      logger.info({
        iterationNumber: iterationCount,
        totalRuntime: Date.now() - startTime,
      }, `📊 Starting iteration #${iterationCount}`);
      
      // Run single iteration
      const result = await indexer.runIteration();
      const iterationDuration = Date.now() - iterationStartTime;
      
      logger.info({
        iterationNumber: iterationCount,
        summary: result.summary,
        hasNextPage: result.hasNextPage,
        endCursor: result.endCursor,
        iterationDuration,
        totalRuntime: Date.now() - startTime,
      }, `✅ Iteration #${iterationCount} completed successfully`);
      
      // Check if we should continue (no more pages)
      if (!result.hasNextPage) {
        logger.info('📄 Reached end of all accounts - will continue monitoring for new accounts');
        
        // Wait longer when we've reached the end
        const waitTime = parseInt(process.env.END_OF_DATA_WAIT_MS || '60000', 10); // 1 minute default
        logger.info({ waitTime }, '⏳ Waiting before checking for new accounts...');
        
        await sleep(waitTime);
      } else {
        // Normal delay between iterations
        const iterationDelay = parseInt(process.env.ITERATION_DELAY_MS || '5000', 10); // 5 seconds default
        if (iterationDelay > 0) {
          logger.debug({ iterationDelay }, '⏱️ Waiting before next iteration...');
          await sleep(iterationDelay);
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        iterationNumber: iterationCount,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      }, `❌ Iteration #${iterationCount} failed`);
      
      // Wait before retrying
      const errorRetryDelay = parseInt(process.env.ERROR_RETRY_DELAY_MS || '30000', 10); // 30 seconds default
      logger.warn({ errorRetryDelay }, '🔄 Waiting before retrying after error...');
      await sleep(errorRetryDelay);
    }
  }
  
  logger.info({
    totalIterations: iterationCount,
    totalRuntime: Date.now() - startTime,
  }, '🏁 Infinite indexing mode stopped');
}

/**
 * Run indexer in timed mode - perfect for GitHub Actions
 */
async function runTimedMode(
  indexer: IndexerService,
  logger: ReturnType<typeof createLogger>,
  minutes: number,
  shouldStop: () => boolean
): Promise<void> {
  let iterationCount = 0;
  const startTime = Date.now();
  const endTime = startTime + (minutes * 60 * 1000);
  
  logger.info({
    durationMinutes: minutes,
    endTime: new Date(endTime).toISOString(),
  }, '🚀 Timed indexing mode started');
  
  while (!shouldStop() && Date.now() < endTime) {
    try {
      iterationCount++;
      const iterationStartTime = Date.now();
      const remainingTime = Math.max(0, endTime - Date.now());
      const remainingMinutes = Math.round(remainingTime / 60000);
      
      logger.info({
        iterationNumber: iterationCount,
        totalRuntime: Date.now() - startTime,
        remainingMinutes,
      }, `📊 Starting iteration #${iterationCount} (${remainingMinutes}min remaining)`);
      
      // Check if we have enough time for another iteration (at least 30 seconds)
      if (remainingTime < 30000) {
        logger.info('⏰ Less than 30 seconds remaining, stopping to ensure clean exit');
        break;
      }
      
      // Run single iteration
      const result = await indexer.runIteration();
      const iterationDuration = Date.now() - iterationStartTime;
      
      logger.info({
        iterationNumber: iterationCount,
        summary: result.summary,
        hasNextPage: result.hasNextPage,
        endCursor: result.endCursor,
        iterationDuration,
        totalRuntime: Date.now() - startTime,
        remainingMinutes: Math.round((endTime - Date.now()) / 60000),
      }, `✅ Iteration #${iterationCount} completed successfully`);
      
      // Check if we should continue (no more pages)
      if (!result.hasNextPage) {
        logger.info('📄 Reached end of all accounts, stopping early');
        break;
      }
      
      // Small delay between iterations (shorter than infinite mode)
      const iterationDelay = parseInt(process.env.ITERATION_DELAY_MS || '2000', 10); // 2 seconds default for timed mode
      if (iterationDelay > 0 && (Date.now() + iterationDelay) < endTime) {
        logger.debug({ iterationDelay }, '⏱️ Waiting before next iteration...');
        await sleep(iterationDelay);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        iterationNumber: iterationCount,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      }, `❌ Iteration #${iterationCount} failed`);
      
      // Shorter retry delay for timed mode
      const errorRetryDelay = Math.min(10000, Math.max(0, endTime - Date.now() - 5000)); // Max 10 seconds or remaining time
      if (errorRetryDelay > 0) {
        logger.warn({ errorRetryDelay }, '🔄 Waiting before retrying after error...');
        await sleep(errorRetryDelay);
      }
    }
  }
  
  const actualRuntime = Date.now() - startTime;
  const actualMinutes = Math.round(actualRuntime / 60000);
  
  logger.info({
    totalIterations: iterationCount,
    requestedDurationMinutes: minutes,
    actualDurationMinutes: actualMinutes,
    totalRuntime: actualRuntime,
  }, '🏁 Timed indexing mode completed');
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  main();
} 