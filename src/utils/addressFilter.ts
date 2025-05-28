import { Logger } from './logger';

/**
 * Configuration for address filtering
 */
export interface AddressFilterConfig {
  customSkipPatterns: string[];
}

/**
 * Result of address filtering
 */
export interface FilterResult {
  shouldProcess: boolean;
  skipReason?: string;
}

/**
 * Address filter utility to avoid unnecessary API calls
 * Based on TON blockchain documentation and empirical analysis
 */
export class AddressFilter {
  private config: AddressFilterConfig;
  private logger: Logger;
  private stats: {
    total: number;
    processed: number;
    skipped: number;
    skipReasons: Record<string, number>;
  };

  constructor(config: AddressFilterConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.stats = {
      total: 0,
      processed: 0,
      skipped: 0,
      skipReasons: {},
    };

    this.logger.info('TON address filter initialized - automatically filtering problematic addresses');
  }

  /**
   * Check if address should be processed or skipped
   */
  shouldProcessAddress(rawAddress: string): FilterResult {
    this.stats.total++;

    // Always check masterchain system addresses (most common source of errors)
    if (this.isMasterchainSystemAddress(rawAddress)) {
      return this.skipAddress('masterchain_system');
    }

    // Always check zero-heavy addresses (likely system/empty contracts)
    if (this.isZeroHeavyAddress(rawAddress)) {
      return this.skipAddress('zero_heavy');
    }

    // Always check very short addresses (likely invalid)
    if (this.isShortAddress(rawAddress)) {
      return this.skipAddress('too_short');
    }

    // Check custom skip patterns
    for (const pattern of this.config.customSkipPatterns) {
      if (this.matchesPattern(rawAddress, pattern)) {
        return this.skipAddress(`custom_pattern:${pattern}`);
      }
    }

    this.stats.processed++;
    return { shouldProcess: true };
  }

  /**
   * Check if address matches custom pattern
   */
  private matchesPattern(rawAddress: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern);
      return regex.test(rawAddress);
    } catch (error) {
      this.logger.warn({
        pattern,
        error: error instanceof Error ? error.message : String(error),
      }, 'Invalid regex pattern in address filter');
      return false;
    }
  }

  /**
   * Record a skipped address
   */
  private skipAddress(reason: string): FilterResult {
    this.stats.skipped++;
    this.stats.skipReasons[reason] = (this.stats.skipReasons[reason] || 0) + 1;

    return {
      shouldProcess: false,
      skipReason: reason,
    };
  }

  /**
   * Get filtering statistics
   */
  getStats() {
    return {
      ...this.stats,
      skipPercentage: this.stats.total > 0 ? (this.stats.skipped / this.stats.total * 100).toFixed(2) : '0.00',
    };
  }

  /**
   * Log current statistics
   */
  logStats() {
    const stats = this.getStats();
    this.logger.info({
      ...stats,
    }, 'Address filtering statistics (TON-optimized)');
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      total: 0,
      processed: 0,
      skipped: 0,
      skipReasons: {},
    };
  }

  /**
   * Check if address is a masterchain system address
   * Based on TON documentation: masterchain (-1) and workchain (-2) contain system contracts
   * Many system addresses in these workchains cause "not enough bytes for magic prefix" errors
   */
  private isMasterchainSystemAddress(rawAddress: string): boolean {
    // Workchain -2: Always filter (all addresses cause API errors)
    if (rawAddress.startsWith('-2:')) {
      return true;
    }

    // Workchain -1: Apply pattern-based filtering
    if (!rawAddress.startsWith('-1:')) {
      return false;
    }

    const hash = rawAddress.substring(3); // Remove "-1:"
    
    // Check address length - should be exactly 64 hex chars (256 bits)
    if (hash.length !== 64) {
      return true; // Invalid length indicates system address
    }

    // Check for known patterns that cause "magic prefix" errors:
    
    // 1. Addresses with high percentage of zeros (empirically identified as problematic)
    const zeroCount = (hash.match(/0/g) || []).length;
    const zeroPercentage = zeroCount / hash.length;
    
    if (zeroPercentage > 0.55) { // Optimized threshold based on error logs
      return true;
    }

    // 2. Specific system patterns found in error logs
    const systemPatterns = [
      // Addresses starting with many zeros (nonexist/uninit contracts)
      /^0{20,}/, // 20+ consecutive zeros at start
      /^00000000000000000000000/, // Pattern from actual error logs
      
      // System service addresses (often cause TVM errors)
      /^fffffffffffff/, // Pattern with many f's
      /fffffffffff$/, // Pattern ending with many f's
      
      // Configuration and validator addresses patterns
      /^[0-9a-f]{10,}0{20,}/, // Mixed pattern with zeros at end
      /0{15,}[0-9a-f]{5,}$/, // Zeros followed by short data
      
      // Common masterchain system services
      /^0000000000000000000000000[0-9a-f]{10,}$/, // Zero prefix with system identifier
    ];

    for (const pattern of systemPatterns) {
      if (pattern.test(hash)) {
        return true;
      }
    }

    // 3. Check for repetitive patterns (often indicate system addresses)
    // Look for patterns like "000...111" or "aaa...bbb"
    const chunks = hash.match(/.{8}/g) || [];
    const uniqueChunks = new Set(chunks);
    
    // If address has very few unique patterns, likely system
    if (chunks.length >= 8 && uniqueChunks.size <= 2) {
      return true;
    }

    return false;
  }

  /**
   * Check if address has too many zeros (likely empty/uninit contract)
   * Based on TON states: uninit addresses often have high zero content
   */
  private isZeroHeavyAddress(rawAddress: string): boolean {
    const parts = rawAddress.split(':');
    if (parts.length !== 2) return false;

    const hash = parts[1];
    const zeroCount = (hash.match(/0/g) || []).length;
    const zeroPercentage = zeroCount / hash.length;

    // Different thresholds for different workchains
    if (parts[0] === '-1' || parts[0] === '-2') {
      // System workchains: lower threshold (already handled above)
      return zeroPercentage > 0.8;
    } else {
      // Basechain: higher threshold for zero detection
      return zeroPercentage > 0.75;
    }
  }

  /**
   * Check if address is too short (likely invalid)
   */
  private isShortAddress(rawAddress: string): boolean {
    return rawAddress.length < 10;
  }
}

/**
 * Create default address filter configuration
 * All TON-specific filters are always enabled as they prevent known API errors
 */
export function createDefaultAddressFilterConfig(): AddressFilterConfig {
  return {
    customSkipPatterns: process.env.CUSTOM_SKIP_PATTERNS 
      ? process.env.CUSTOM_SKIP_PATTERNS.split(',').map(p => p.trim())
      : [],
  };
} 