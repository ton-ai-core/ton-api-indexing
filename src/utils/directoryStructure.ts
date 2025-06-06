import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

/**
 * Константы для организации файловой структуры
 */
export const DIRECTORY_CONSTANTS = {
  MAX_FILES_PER_DIRECTORY: 1000,
  HASH_LENGTH: 2, // Длина каждого уровня хеша (00-ff = 256 папок)
  MIN_DIRECTORY_LEVELS: 2, // Минимальное количество уровней
  MAX_DIRECTORY_LEVELS: 6, // Максимальное количество уровней (256^6 = 281 триллион папок)
} as const;

/**
 * Генерирует MD5 хеш от строки
 */
function generateHash(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

/**
 * Вычисляет оптимальное количество уровней директорий на основе ожидаемого количества файлов
 */
export function calculateOptimalDirectoryLevels(expectedFileCount: number): number {
  const maxFilesPerDir = DIRECTORY_CONSTANTS.MAX_FILES_PER_DIRECTORY;
  const foldersPerLevel = Math.pow(256, DIRECTORY_CONSTANTS.HASH_LENGTH); // 256 папок на уровень
  
  // Рассчитываем минимальное количество уровней для размещения всех файлов
  let requiredLevels = DIRECTORY_CONSTANTS.MIN_DIRECTORY_LEVELS;
  let totalFolders = Math.pow(foldersPerLevel, requiredLevels);
  
  while (expectedFileCount / totalFolders > maxFilesPerDir && requiredLevels < DIRECTORY_CONSTANTS.MAX_DIRECTORY_LEVELS) {
    requiredLevels++;
    totalFolders = Math.pow(foldersPerLevel, requiredLevels);
  }
  
  return Math.min(requiredLevels, DIRECTORY_CONSTANTS.MAX_DIRECTORY_LEVELS);
}

/**
 * Создает иерархическую структуру папок на основе адреса с динамическим количеством уровней
 * Алгоритм: address -> MD5 -> разбиваем по уровням -> динамическая структура
 * Пример с 2 уровнями: EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS -> a1b2 -> a1/b2/
 * Пример с 3 уровнями: EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS -> a1b2c3 -> a1/b2/c3/
 */
export function getDirectoryPath(
  address: string, 
  baseDir: string = './data', 
  directoryLevels?: number
): string {
  // Удаляем префиксы TON адресов для консистентности
  const cleanAddress = address.replace(/^(EQ|UQ|kQ)/, '');
  
  // Генерируем хеш
  const hash = generateHash(cleanAddress);
  
  // Используем переданное количество уровней или значение по умолчанию
  const levels = directoryLevels || DIRECTORY_CONSTANTS.MIN_DIRECTORY_LEVELS;
  const hashLength = DIRECTORY_CONSTANTS.HASH_LENGTH;
  
  // Создаем массив папок для каждого уровня
  const directories: string[] = [];
  for (let i = 0; i < levels; i++) {
    const startIndex = i * hashLength;
    const endIndex = startIndex + hashLength;
    const levelHash = hash.substring(startIndex, endIndex);
    directories.push(levelHash);
  }
  
  return path.join(baseDir, ...directories);
}

/**
 * Создает все необходимые директории в пути
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as any).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Получает полный путь к файлу с учетом иерархии
 */
export function getFilePath(
  address: string, 
  baseDir: string = './data', 
  directoryLevels?: number
): string {
  const dirPath = getDirectoryPath(address, baseDir, directoryLevels);
  const fileName = `inspect_${address.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
  return path.join(dirPath, fileName);
}

/**
 * Создает структуру директорий и возвращает путь к файлу
 */
export async function prepareFilePath(
  address: string, 
  baseDir: string = './data', 
  directoryLevels?: number
): Promise<string> {
  const dirPath = getDirectoryPath(address, baseDir, directoryLevels);
  await ensureDirectoryExists(dirPath);
  const fileName = `inspect_${address.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
  return path.join(dirPath, fileName);
}

/**
 * Статистика по распределению файлов
 */
export interface DirectoryStats {
  totalDirectories: number;
  totalFiles: number;
  averageFilesPerDirectory: number;
  maxFilesInDirectory: number;
  minFilesInDirectory: number;
  directoryDistribution: Record<string, number>;
}

/**
 * Рекурсивная функция для подсчета файлов в директории любого уровня вложенности
 */
async function countFilesRecursively(
  dirPath: string, 
  currentPath: string = '',
  stats: DirectoryStats
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile() && entry.name.endsWith('.json'));
  const directories = entries.filter(entry => entry.isDirectory());
  
  if (files.length > 0) {
    // Это конечная директория с файлами
    stats.totalDirectories++;
    stats.totalFiles += files.length;
    
    const dirKey = currentPath || 'root';
    stats.directoryDistribution[dirKey] = files.length;
    
    if (files.length > stats.maxFilesInDirectory) {
      stats.maxFilesInDirectory = files.length;
    }
    if (files.length < stats.minFilesInDirectory) {
      stats.minFilesInDirectory = files.length;
    }
  }
  
  // Рекурсивно обрабатываем поддиректории
  for (const directory of directories) {
    const subDirPath = path.join(dirPath, directory.name);
    const subCurrentPath = currentPath ? `${currentPath}/${directory.name}` : directory.name;
    await countFilesRecursively(subDirPath, subCurrentPath, stats);
  }
}

/**
 * Анализирует распределение файлов по директориям с поддержкой любого количества уровней
 */
export async function analyzeDirectoryDistribution(baseDir: string = './data'): Promise<DirectoryStats> {
  const stats: DirectoryStats = {
    totalDirectories: 0,
    totalFiles: 0,
    averageFilesPerDirectory: 0,
    maxFilesInDirectory: 0,
    minFilesInDirectory: Infinity,
    directoryDistribution: {},
  };

  try {
    await countFilesRecursively(baseDir, '', stats);
    
    stats.averageFilesPerDirectory = stats.totalDirectories > 0 
      ? stats.totalFiles / stats.totalDirectories 
      : 0;
      
    if (stats.minFilesInDirectory === Infinity) {
      stats.minFilesInDirectory = 0;
    }
    
  } catch (error) {
    // Если структура еще не создана
    stats.minFilesInDirectory = 0;
  }

  return stats;
}

/**
 * Мигрирует файлы из плоской структуры в иерархическую с автоматическим расчетом оптимальных уровней
 */
export async function migrateToHierarchicalStructure(
  sourceDir: string,
  targetDir: string,
  batchSize: number = 100,
  customDirectoryLevels?: number
): Promise<{ migrated: number; errors: string[]; optimalLevels: number; stats: DirectoryStats }> {
  const result = { migrated: 0, errors: [] as string[], optimalLevels: 2, stats: {} as DirectoryStats };
  
  try {
    const files = await fs.readdir(sourceDir);
    const inspectFiles = files.filter(f => f.startsWith('inspect_') && f.endsWith('.json'));
    
    console.log(`Found ${inspectFiles.length} files to migrate`);
    
    // Автоматически рассчитываем оптимальное количество уровней если не передано
    const optimalLevels = customDirectoryLevels || calculateOptimalDirectoryLevels(inspectFiles.length);
    result.optimalLevels = optimalLevels;
    
    console.log(`Using ${optimalLevels} directory levels for optimal distribution`);
    console.log(`Expected files per directory: ~${Math.ceil(inspectFiles.length / Math.pow(256, optimalLevels))}`);
    
    for (let i = 0; i < inspectFiles.length; i += batchSize) {
      const batch = inspectFiles.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (fileName) => {
        try {
          // Извлекаем адрес из имени файла
          const addressMatch = fileName.match(/^inspect_(.+)\.json$/);
          if (!addressMatch) {
            result.errors.push(`Invalid filename format: ${fileName}`);
            return;
          }
          
          const address = addressMatch[1].replace(/_/g, '');
          const sourcePath = path.join(sourceDir, fileName);
          const targetPath = await prepareFilePath(address, targetDir, optimalLevels);
          
          // Перемещаем файл
          await fs.rename(sourcePath, targetPath);
          result.migrated++;
          
          if (result.migrated % 1000 === 0) {
            console.log(`Migrated ${result.migrated} files...`);
          }
          
        } catch (error) {
          result.errors.push(`Error migrating ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }));
    }
    
    // Анализируем результат миграции
    result.stats = await analyzeDirectoryDistribution(targetDir);
    
    console.log(`Migration completed:`);
    console.log(`- Migrated: ${result.migrated} files`);
    console.log(`- Directory levels used: ${optimalLevels}`);
    console.log(`- Total directories created: ${result.stats.totalDirectories}`);
    console.log(`- Average files per directory: ${result.stats.averageFilesPerDirectory.toFixed(2)}`);
    console.log(`- Max files in directory: ${result.stats.maxFilesInDirectory}`);
    
  } catch (error) {
    result.errors.push(`Migration error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return result;
}

/**
 * Создает скрипт миграции для существующей структуры данных
 */
export async function createMigrationScript(
  currentDataDir: string = './data'
): Promise<string> {
  const files = await fs.readdir(currentDataDir);
  const inspectFiles = files.filter(f => f.startsWith('inspect_') && f.endsWith('.json'));
  const fileCount = inspectFiles.length;
  
  const optimalLevels = calculateOptimalDirectoryLevels(fileCount);
  const expectedDirs = Math.pow(256, optimalLevels);
  const avgFilesPerDir = Math.ceil(fileCount / expectedDirs);
  
  return `
# Миграция структуры данных TON индексатора

## Текущая ситуация
- Файлов в плоской структуре: ${fileCount}
- Рекомендуемые уровни директорий: ${optimalLevels}
- Ожидаемое количество директорий: ${expectedDirs}
- Среднее количество файлов на директорию: ${avgFilesPerDir}

## Команды для миграции

\`\`\`bash
# 1. Создать резервную копию
cp -r ${currentDataDir} ${currentDataDir}_backup

# 2. Создать новую структуру
mkdir -p ${currentDataDir}_new

# 3. Запустить миграцию (выполнить в Node.js)
import { migrateToHierarchicalStructure } from './src/utils/directoryStructure';
const result = await migrateToHierarchicalStructure('${currentDataDir}', '${currentDataDir}_new');

# 4. После успешной миграции заменить директории
mv ${currentDataDir} ${currentDataDir}_old
mv ${currentDataDir}_new ${currentDataDir}
\`\`\`

## Преимущества после миграции
- ✅ Улучшенная производительность файловой системы
- ✅ Масштабируемость до миллионов файлов
- ✅ Равномерное распределение нагрузки
- ✅ Оптимизированные операции поиска и чтения
`;
} 