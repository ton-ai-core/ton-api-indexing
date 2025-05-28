#!/usr/bin/env ts-node

/**
 * Test script to demonstrate rate limit handling
 * This script simulates rate limit scenarios and shows how our retry logic works
 */

import { RestClient } from '../src/services/RestClient';
import { IndexerConfig } from '../src/types';
import { createLogger } from '../src/utils/logger';

// Mock configuration for testing
const testConfig: IndexerConfig = {
  tonApiKey: process.env.TONAPI_KEY || 'test-key',
  graphqlUrl: 'https://tonapi.io/v2/graphql',
  restUrl: 'https://tonapi.io/v2',
  cursorFilePath: './test-cursor.txt',
  dataDirectory: './test-data',
  maxConcurrentRequests: 1,
  requestDelayMs: 100,
  accountsPerPage: 10,
  maxRetries: 3,
  retryDelayMs: 1000, // 1 second base delay
  logLevel: 'debug',
  logPretty: true,
};

async function testRateLimitHandling() {
  const logger = createLogger(testConfig);
  const restClient = new RestClient(testConfig, logger);

  logger.info('🧪 Starting rate limit handling test');
  logger.info('This test will attempt to make requests and show how rate limits are handled');

  // Test with multiple rapid requests to potentially trigger rate limits
  const testAddresses = [
    'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N', // Known working address
    'EQC_1YoM8RBixN95lz7odcF3Vrkc_N8Ne7gQi7Abtlet_Efi', // Another test address
    'EQD7vN-pvb_QPEtEPo8uCeGH0Qxb5L4vKALVhd4WzLqrO2xM', // Another test address
  ];

  logger.info(`📝 Testing with ${testAddresses.length} addresses`);

  for (let i = 0; i < testAddresses.length; i++) {
    const address = testAddresses[i];
    
    try {
      logger.info(`🔄 Request ${i + 1}/${testAddresses.length}: ${address}`);
      
      const startTime = Date.now();
      const result = await restClient.inspectContract(address);
      const duration = Date.now() - startTime;
      
      logger.info({
        address,
        duration,
        success: true,
        dataSize: JSON.stringify(result).length
      }, `✅ Request ${i + 1} completed successfully`);
      
    } catch (error) {
      const duration = Date.now() - Date.now();
      logger.error({
        address,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, `❌ Request ${i + 1} failed`);
      
      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        logger.warn('🚦 Rate limit detected - our retry logic should have handled this automatically');
      }
    }
    
    // Small delay between requests to avoid overwhelming the API
    if (i < testAddresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  logger.info('🏁 Rate limit handling test completed');
  logger.info('💡 Check the logs above to see how rate limits were handled');
  logger.info('📊 Look for log entries with "Rate limit hit, waiting before retry"');
}

// Run the test
if (require.main === module) {
  testRateLimitHandling().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
} 