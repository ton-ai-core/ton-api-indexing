#!/usr/bin/env tsx

import { 
  calculateOptimalDirectoryLevels,
  analyzeDirectoryDistribution,
  getDirectoryPath,
  createMigrationScript,
  DIRECTORY_CONSTANTS 
} from '../src/utils/directoryStructure';

/**
 * Демонстрирует масштабируемость алгоритма
 */
function demonstrateScalability() {
  console.log('🔢 АНАЛИЗ МАСШТАБИРУЕМОСТИ АЛГОРИТМА\n');
  
  const testCases = [
    { files: 1000, description: '1K файлов' },
    { files: 10000, description: '10K файлов' },
    { files: 100000, description: '100K файлов' },
    { files: 489915, description: 'Текущие данные (489K файлов)' },
    { files: 1000000, description: '1M файлов' },
    { files: 10000000, description: '10M файлов' },
    { files: 100000000, description: '100M файлов' },
  ];
  
  console.log('| Количество файлов | Уровни | Директорий | Файлов/папку | Производительность |');
  console.log('|------------------|--------|------------|--------------|-------------------|');
  
  testCases.forEach(({ files, description }) => {
    const levels = calculateOptimalDirectoryLevels(files);
    const totalDirs = Math.pow(256, levels);
    const filesPerDir = Math.ceil(files / totalDirs);
    const performance = filesPerDir <= 1000 ? '✅ Отлично' : '⚠️ Требует больше уровней';
    
    console.log(`| ${description.padEnd(16)} | ${levels.toString().padEnd(6)} | ${totalDirs.toLocaleString().padEnd(10)} | ${filesPerDir.toString().padEnd(12)} | ${performance.padEnd(17)} |`);
  });
}

/**
 * Демонстрирует примеры путей
 */
function demonstratePathGeneration() {
  console.log('\n🗂️ ПРИМЕРЫ ГЕНЕРАЦИИ ПУТЕЙ\n');
  
  const sampleAddresses = [
    'EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS',
    'UQB1234567890abcdef1234567890abcdef1234567890abcdef',
    'kQC9876543210fedcba9876543210fedcba9876543210fedcba',
  ];
  
  [2, 3, 4].forEach(levels => {
    console.log(`\n--- ${levels} уровня директорий ---`);
    sampleAddresses.forEach(address => {
      const dirPath = getDirectoryPath(address, './data', levels);
      console.log(`${address.substring(0, 20)}... → ${dirPath}`);
    });
  });
}

/**
 * Показывает математику за алгоритмом
 */
function showMathBehindAlgorithm() {
  console.log('\n🧮 МАТЕМАТИКА АЛГОРИТМА\n');
  
  console.log('Базовые принципы:');
  console.log('• MD5 хеш = 32 символа (0-9, a-f)');
  console.log('• Каждый уровень = 2 символа = 256 возможных папок (00-ff)');
  console.log('• Максимальные файлы на папку = 1000');
  console.log('');
  
  console.log('Расчет уровней:');
  console.log('• Уровень 1: 256^1 = 256 папок');
  console.log('• Уровень 2: 256^2 = 65,536 папок');  
  console.log('• Уровень 3: 256^3 = 16,777,216 папок');
  console.log('• Уровень 4: 256^4 = 4,294,967,296 папок');
  console.log('• Уровень 5: 256^5 = 1,099,511,627,776 папок');
  console.log('• Уровень 6: 256^6 = 281,474,976,710,656 папок');
  console.log('');
  
  console.log('Максимальная ёмкость:');
  for (let level = 1; level <= 6; level++) {
    const maxDirs = Math.pow(256, level);
    const maxFiles = maxDirs * 1000;
    console.log(`• ${level} уровень: до ${maxFiles.toLocaleString()} файлов`);
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('🚀 ТЕСТИРОВАНИЕ ИЕРАРХИЧЕСКОЙ СИСТЕМЫ ПАПОК TON ИНДЕКСАТОРА\n');
    console.log('='.repeat(80));
    
    // Демонстрация масштабируемости
    demonstrateScalability();
    
    // Примеры путей
    demonstratePathGeneration();
    
    // Математика
    showMathBehindAlgorithm();
    
    // Анализ текущих данных
    console.log('\n📊 АНАЛИЗ ТЕКУЩИХ ДАННЫХ\n');
    try {
      const stats = await analyzeDirectoryDistribution('./data');
      
      if (stats.totalFiles > 0) {
        console.log(`✅ Найдено файлов: ${stats.totalFiles.toLocaleString()}`);
        console.log(`📁 Директорий: ${stats.totalDirectories.toLocaleString()}`);
        console.log(`📄 Среднее файлов на папку: ${stats.averageFilesPerDirectory.toFixed(2)}`);
        console.log(`📈 Максимум файлов в папке: ${stats.maxFilesInDirectory}`);
        console.log(`📉 Минимум файлов в папке: ${stats.minFilesInDirectory}`);
        
        const recommended = calculateOptimalDirectoryLevels(stats.totalFiles);
        console.log(`💡 Рекомендуемые уровни: ${recommended}`);
        
        if (stats.maxFilesInDirectory > 1000) {
          console.log('⚠️ ВНИМАНИЕ: Некоторые папки превышают лимит 1000 файлов!');
          console.log('🔄 Рекомендуется миграция к иерархической структуре.');
        }
      } else {
        console.log('ℹ️ Данные еще не найдены или структура пуста');
      }
    } catch (error) {
      console.log('ℹ️ Не удалось проанализировать данные (возможно, папка пуста)');
    }
    
    // Создание скрипта миграции
    console.log('\n📝 СОЗДАНИЕ СКРИПТА МИГРАЦИИ\n');
    try {
      const migrationScript = await createMigrationScript('./data');
      console.log('Скрипт миграции создан:');
      console.log(migrationScript);
    } catch (error) {
      console.log('ℹ️ Не удалось создать скрипт миграции');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
    process.exit(1);
  }
}

// Запуск если скрипт вызван напрямую
if (require.main === module) {
  main();
} 