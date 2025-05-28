import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from './logger';

/**
 * Read cursor from file
 */
export async function readCursor(filePath: string, logger: Logger): Promise<string | null> {
  try {
    if (await fs.pathExists(filePath)) {
      const cursor = await fs.readFile(filePath, 'utf-8');
      logger.info({ cursor: cursor.trim() }, 'Loaded cursor from file');
      return cursor.trim() || null;
    }
    logger.info('Cursor file does not exist, starting from the beginning');
    return null;
  } catch (error) {
    logger.error({ error, filePath }, 'Failed to read cursor file');
    throw new Error(`Failed to read cursor file: ${error}`);
  }
}

/**
 * Save cursor to file
 */
export async function saveCursor(filePath: string, cursor: string, logger: Logger): Promise<void> {
  try {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, cursor, 'utf-8');
    logger.debug({ cursor, filePath }, 'Saved cursor to file');
  } catch (error) {
    logger.error({ error, cursor, filePath }, 'Failed to save cursor');
    throw new Error(`Failed to save cursor: ${error}`);
  }
}

/**
 * Generate filename from raw address (replace colons with underscores)
 */
export function generateFileName(rawAddress: string): string {
  return `inspect_${rawAddress.replace(/:/g, '_')}.json`;
}

/**
 * Check if contract file already exists
 */
export async function contractFileExists(dataDirectory: string, rawAddress: string): Promise<boolean> {
  const fileName = generateFileName(rawAddress);
  const filePath = path.join(dataDirectory, fileName);
  return fs.pathExists(filePath);
}

/**
 * Save contract inspect data to JSON file
 */
export async function saveContractData(
  dataDirectory: string,
  rawAddress: string,
  data: any,
  logger: Logger
): Promise<string> {
  try {
    await fs.ensureDir(dataDirectory);
    
    const fileName = generateFileName(rawAddress);
    const filePath = path.join(dataDirectory, fileName);
    
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    
    logger.debug({ 
      address: rawAddress, 
      fileName, 
      filePath 
    }, 'Saved contract data');
    
    return filePath;
  } catch (error) {
    logger.error({ 
      error, 
      address: rawAddress, 
      dataDirectory 
    }, 'Failed to save contract data');
    throw new Error(`Failed to save contract data for ${rawAddress}: ${error}`);
  }
}

/**
 * Ensure data directory exists
 */
export async function ensureDataDirectory(dataDirectory: string, logger: Logger): Promise<void> {
  try {
    await fs.ensureDir(dataDirectory);
    logger.info({ dataDirectory }, 'Data directory ensured');
  } catch (error) {
    logger.error({ error, dataDirectory }, 'Failed to ensure data directory');
    throw new Error(`Failed to create data directory: ${error}`);
  }
} 