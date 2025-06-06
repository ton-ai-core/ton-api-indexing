#!/usr/bin/env ts-node

import * as fs from 'fs-extra';
import * as path from 'path';
import { getHashPrefix } from '../src/utils/fileUtils';

interface MigrationStats {
  totalFiles: number;
  migratedFiles: number;
  errors: string[];
  subfolders: Set<string>;
}

/**
 * Migrate existing data files to subfolder structure
 */
async function migrateDataStructure(dataDirectory: string): Promise<MigrationStats> {
  console.log('🚀 Starting data structure migration...');
  
  const stats: MigrationStats = {
    totalFiles: 0,
    migratedFiles: 0,
    errors: [],
    subfolders: new Set<string>(),
  };

  try {
    // Read all files in data directory
    const files = await fs.readdir(dataDirectory);
    
    // Filter only JSON files with inspect_ prefix
    const jsonFiles = files.filter(file => 
      file.startsWith('inspect_') && file.endsWith('.json')
    );
    
    stats.totalFiles = jsonFiles.length;
    console.log(`📁 Found ${stats.totalFiles} files to migrate`);
    
    if (stats.totalFiles === 0) {
      console.log('✅ No files to migrate');
      return stats;
    }

    // Process files in batches to avoid overwhelming the system
    const batchSize = 1000;
    
    for (let i = 0; i < jsonFiles.length; i += batchSize) {
      const batch = jsonFiles.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(jsonFiles.length / batchSize)} (${batch.length} files)`);
      
      await Promise.all(batch.map(async (fileName) => {
        try {
          // Extract raw address from filename
          // Format: inspect_0_f403d103fcdfcac4d4d59aedd57695f0d13a5b2f6e4a9825c92464a44c6d2f86.json
          const rawAddress = fileName
            .replace('inspect_', '')
            .replace('.json', '')
            .replace(/_/g, ':');
          
          // Get hash prefix for subfolder
          const prefix = getHashPrefix(rawAddress);
          stats.subfolders.add(prefix);
          
          // Create paths
          const oldPath = path.join(dataDirectory, fileName);
          const newDir = path.join(dataDirectory, prefix);
          const newPath = path.join(newDir, fileName);
          
          // Check if file already exists in new location
          if (await fs.pathExists(newPath)) {
            console.log(`⚠️  File already exists in new location: ${fileName}`);
            // Remove old file if new exists
            await fs.remove(oldPath);
            stats.migratedFiles++;
            return;
          }
          
          // Ensure subfolder exists
          await fs.ensureDir(newDir);
          
          // Move file to new location
          await fs.move(oldPath, newPath);
          
          stats.migratedFiles++;
          
          if (stats.migratedFiles % 10000 === 0) {
            console.log(`✅ Migrated ${stats.migratedFiles}/${stats.totalFiles} files`);
          }
          
        } catch (error) {
          const errorMessage = `Failed to migrate ${fileName}: ${error}`;
          stats.errors.push(errorMessage);
          console.error(`❌ ${errorMessage}`);
        }
      }));
    }
    
  } catch (error) {
    const errorMessage = `Failed to read data directory: ${error}`;
    stats.errors.push(errorMessage);
    console.error(`❌ ${errorMessage}`);
    throw error;
  }

  return stats;
}

/**
 * Print migration statistics
 */
function printStats(stats: MigrationStats): void {
  console.log('\n📊 Migration Statistics:');
  console.log(`├── Total files: ${stats.totalFiles}`);
  console.log(`├── Migrated files: ${stats.migratedFiles}`);
  console.log(`├── Errors: ${stats.errors.length}`);
  console.log(`├── Subfolders created: ${stats.subfolders.size}`);
  console.log(`└── Subfolder prefixes: ${Array.from(stats.subfolders).sort().join(', ')}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(error => console.log(`   ${error}`));
  }
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  const dataDirectory = process.argv[2] || './data';
  
  console.log(`🎯 Data directory: ${path.resolve(dataDirectory)}`);
  
  // Check if data directory exists
  if (!await fs.pathExists(dataDirectory)) {
    console.error(`❌ Data directory does not exist: ${dataDirectory}`);
    process.exit(1);
  }
  
  try {
    const startTime = Date.now();
    const stats = await migrateDataStructure(dataDirectory);
    const duration = Date.now() - startTime;
    
    printStats(stats);
    
    console.log(`\n🎉 Migration completed in ${(duration / 1000).toFixed(2)}s`);
    
    if (stats.errors.length === 0) {
      console.log('✅ All files migrated successfully!');
      process.exit(0);
    } else {
      console.log(`⚠️  Migration completed with ${stats.errors.length} errors`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`💥 Migration failed: ${error}`);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { migrateDataStructure, MigrationStats }; 