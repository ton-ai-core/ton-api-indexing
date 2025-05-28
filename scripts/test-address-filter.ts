#!/usr/bin/env ts-node

/**
 * Test script for address filtering functionality
 * Updated with comprehensive TON address patterns based on documentation analysis
 */

import { AddressFilter, createDefaultAddressFilterConfig } from '../src/utils/addressFilter';
import { createLogger } from '../src/utils/logger';

// Comprehensive test addresses including problematic ones from logs and documentation
const testAddresses = [
  // === NORMAL ADDRESSES (should process) ===
  'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N', // Standard wallet
  '0:8f7e5b2e8c3d4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2', // Basechain contract
  
  // === PROBLEMATIC MASTERCHAIN ADDRESSES (should filter) ===
  // From actual error logs:
  '-1:00000000000000000000000000e3de040c6644bdab616ccecbb876d1a4b5e54c',
  '-1:00000000000000000000000000d0556d21f8c7aefcb0f00d7304e0d6b8419b64',
  '-1:00000000000000000000000002197021fefa795fec661a45f60e47a6f6605281',
  '-1:000000000000000000000000071dd34002608267b24300a690e2159170d5f77e',
  '-1:0000000000000000000000000884eb3b8b82a2ec05451e331d26ed9eade49b15',
  
  // Additional system patterns:
  '-1:0000000000000000000000000000000000000000000000000000000000000000', // All zeros
  '-1:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // All f's
  '-1:0000000000000000000000001234567890abcdef0000000000000000000000', // Mixed with many zeros
  '-1:1111111111111111111111111111111111111111111111111111111111111111', // Repetitive pattern
  '-1:0123456789abcdef0000000000000000000000000000000000000000000000', // Zeros at end
  
  // === BASECHAIN ADDRESSES WITH ISSUES (some should filter) ===
  '0:0000000000000000000000000000000000000000000000000000000000000000', // All zeros
  '0:0000000000000000000000000000000000000000000000000000000000000001', // Almost all zeros
  '0:8888888888888888888888888888888888888888888888888888888888888888', // Repetitive
  
  // === INVALID/SHORT ADDRESSES (should filter) ===
  'short',
  '',
  '-1:123', // Too short
  '0:abc', // Too short
  
  // === EDGE CASES ===
  '-1:123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef12', // Valid length but suspicious
  '0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', // Normal basechain
  
  // === TON SYSTEM CONTRACTS (based on documentation) ===
  '-1:3333333333333333333333333333333333333333333333333333333333333333', // Config contract pattern
  '-1:5555555555555555555555555555555555555555555555555555555555555555', // Elector contract pattern
];

async function testAddressFiltering() {
  // Create logger with pretty output for testing
  const config = {
    tonApiKey: 'test',
    graphqlUrl: 'test',
    restUrl: 'test',
    cursorFilePath: 'test',
    dataDirectory: 'test',
    maxConcurrentRequests: 1,
    requestDelayMs: 0,
    accountsPerPage: 10,
    maxRetries: 3,
    retryDelayMs: 1000,
    logLevel: 'info',
    logPretty: true,
  };
  
  const logger = createLogger(config);
  
  // Enable filtering for testing
  process.env.ADDRESS_FILTER_ENABLED = 'true';
  process.env.SKIP_MASTERCHAIN_SYSTEM = 'true';
  process.env.SKIP_ZERO_ADDRESSES = 'true';
  process.env.SKIP_SHORT_ADDRESSES = 'true';
  
  const filterConfig = createDefaultAddressFilterConfig();
  const addressFilter = new AddressFilter(filterConfig, logger);

  logger.info('🧪 Testing TON-Optimized Address Filtering');
  logger.info(`📋 Testing ${testAddresses.length} addresses with improved patterns`);
  logger.info({ filterConfig }, 'Filter configuration');

  console.log('\n📊 Results by Category:');
  console.log('=' .repeat(100));

  let processed = 0;
  let skipped = 0;

  // Group addresses by category for better visualization
  const categories = [
    { name: '✅ Normal Addresses', addresses: testAddresses.slice(0, 2) },
    { name: '🚫 Problematic Masterchain (from logs)', addresses: testAddresses.slice(2, 7) },
    { name: '🔧 System Pattern Examples', addresses: testAddresses.slice(7, 12) },
    { name: '⚠️  Basechain with Issues', addresses: testAddresses.slice(12, 15) },
    { name: '❌ Invalid/Short', addresses: testAddresses.slice(15, 19) },
    { name: '🎯 Edge Cases', addresses: testAddresses.slice(19, 21) },
    { name: '🏛️  System Contracts', addresses: testAddresses.slice(21) },
  ];

  for (const category of categories) {
    console.log(`\n${category.name}:`);
    console.log('-'.repeat(80));
    
    for (const address of category.addresses) {
      const result = addressFilter.shouldProcessAddress(address);
      
      const status = result.shouldProcess ? '✅ PROCESS' : '⏭️  SKIP';
      const reason = result.skipReason ? ` (${result.skipReason})` : '';
      
      // Truncate long addresses for better readability
      const displayAddress = address.length > 50 
        ? `${address.substring(0, 25)}...${address.substring(address.length - 20)}`
        : address;
      
      console.log(`${status.padEnd(12)} ${displayAddress}${reason}`);
      
      if (result.shouldProcess) {
        processed++;
      } else {
        skipped++;
      }
    }
  }

  console.log('=' .repeat(100));
  console.log(`📈 Summary: ${processed} processed, ${skipped} skipped`);
  
  // Log final statistics
  addressFilter.logStats();
  
  const stats = addressFilter.getStats();
  console.log(`\n💾 Potential API calls saved: ${stats.skipped} (${stats.skipPercentage}%)`);
  console.log(`📋 Skip reasons breakdown:`);
  
  for (const [reason, count] of Object.entries(stats.skipReasons)) {
    console.log(`   ${reason}: ${count}`);
  }

  console.log(`\n🎯 Filter effectiveness analysis:`);
  console.log(`   - Masterchain system addresses: ${Object.values(stats.skipReasons).reduce((a, b) => a + b, 0)} detected`);
  console.log(`   - Based on TON documentation patterns`);
  console.log(`   - Optimized for "not enough bytes for magic prefix" errors`);
}

// Run test
if (require.main === module) {
  testAddressFiltering().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
} 