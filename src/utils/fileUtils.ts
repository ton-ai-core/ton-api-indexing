import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from './logger';
import { 
  prepareFilePath, 
  getFilePath, 
  calculateOptimalDirectoryLevels,
  analyzeDirectoryDistribution 
} from './directoryStructure';

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
 * Check if contract file already exists (with hierarchical directory support)
 */
export async function contractFileExists(
  dataDirectory: string, 
  rawAddress: string,
  directoryLevels?: number
): Promise<boolean> {
  const filePath = getFilePath(rawAddress, dataDirectory, directoryLevels);
  return fs.pathExists(filePath);
}

/**
 * Save contract inspect data to JSON file (with hierarchical directory support)
 */
export async function saveContractData(
  dataDirectory: string,
  rawAddress: string,
  data: any,
  logger: Logger,
  directoryLevels?: number
): Promise<string> {
  try {
    // Используем новую систему иерархических папок
    const filePath = await prepareFilePath(rawAddress, dataDirectory, directoryLevels);
    
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    
    logger.debug({ 
      address: rawAddress, 
      filePath,
      directoryLevels: directoryLevels || 'auto'
    }, 'Saved contract data to hierarchical structure');
    
    return filePath;
  } catch (error) {
    logger.error({ 
      error, 
      address: rawAddress, 
      dataDirectory,
      directoryLevels 
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

/**
 * Определяет оптимальное количество уровней директорий на основе текущих данных
 */
export async function determineOptimalDirectoryLevels(
  dataDirectory: string,
  logger: Logger,
  estimatedTotalFiles?: number
): Promise<number> {
  try {
    let fileCount = estimatedTotalFiles;
    
    if (!fileCount) {
      // Подсчитываем текущие файлы
      if (await fs.pathExists(dataDirectory)) {
        const stats = await analyzeDirectoryDistribution(dataDirectory);
        fileCount = stats.totalFiles;
        
        // Если файлов еще нет, берем консервативную оценку
        if (fileCount === 0) {
          fileCount = 100000; // По умолчанию планируем на 100к файлов
        }
      } else {
        fileCount = 100000;
      }
    }
    
    const optimalLevels = calculateOptimalDirectoryLevels(fileCount);
    
    logger.info({
      currentFileCount: fileCount,
      optimalDirectoryLevels: optimalLevels,
      expectedDirectories: Math.pow(256, optimalLevels),
      avgFilesPerDirectory: Math.ceil(fileCount / Math.pow(256, optimalLevels))
    }, 'Determined optimal directory structure');
    
    return optimalLevels;
    
  } catch (error) {
    logger.error({ error, dataDirectory }, 'Failed to determine optimal directory levels');
    // Возвращаем безопасное значение по умолчанию
    return 2;
  }
}

/**
 * Анализирует текущую структуру данных и выводит статистику
 */
export async function analyzeCurrentDataStructure(
  dataDirectory: string,
  logger: Logger
): Promise<void> {
  try {
    if (!(await fs.pathExists(dataDirectory))) {
      logger.info({ dataDirectory }, 'Data directory does not exist yet');
      return;
    }
    
    const stats = await analyzeDirectoryDistribution(dataDirectory);
    
    logger.info({
      totalFiles: stats.totalFiles,
      totalDirectories: stats.totalDirectories,
      averageFilesPerDirectory: parseFloat(stats.averageFilesPerDirectory.toFixed(2)),
      maxFilesInDirectory: stats.maxFilesInDirectory,
      minFilesInDirectory: stats.minFilesInDirectory,
      recommendedLevels: calculateOptimalDirectoryLevels(stats.totalFiles)
    }, 'Current data structure analysis');
    
    // Предупреждаем если есть переполненные директории
    if (stats.maxFilesInDirectory > 1000) {
      logger.warn({
        maxFilesInDirectory: stats.maxFilesInDirectory,
        threshold: 1000
      }, 'Some directories exceed recommended file limit - consider migration');
    }
    
  } catch (error) {
    logger.error({ error, dataDirectory }, 'Failed to analyze data structure');
  }
} 