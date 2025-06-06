#!/usr/bin/env tsx

import { migrateToHierarchicalStructure, analyzeDirectoryDistribution } from '../src/utils/directoryStructure';

async function main() {
  console.log('🚀 ЗАПУСК МИГРАЦИИ ДАННЫХ TON ИНДЕКСАТОРА');
  console.log('='.repeat(60));
  
  const sourceDir = './data';
  const targetDir = './data_new';
  
  try {
    // Анализ исходных данных
    console.log('\n📊 Анализ исходных данных...');
    const initialStats = await analyzeDirectoryDistribution(sourceDir);
    console.log(`✅ Найдено файлов: ${initialStats.totalFiles.toLocaleString()}`);
    console.log(`📁 Текущих директорий: ${initialStats.totalDirectories}`);
    
    if (initialStats.totalFiles === 0) {
      console.log('⚠️ Нет файлов для миграции');
      return;
    }
    
    // Запуск миграции
    console.log('\n🔄 Начинаем миграцию...');
    console.log('⏱️ Это может занять несколько минут...');
    
    const startTime = Date.now();
    
    const result = await migrateToHierarchicalStructure(
      sourceDir,
      targetDir,
      500 // Батч размер для быстрой миграции
    );
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Результаты миграции
    console.log('\n✅ МИГРАЦИЯ ЗАВЕРШЕНА!');
    console.log(`⏱️ Время выполнения: ${duration.toFixed(2)} секунд`);
    console.log(`📦 Мигрировано файлов: ${result.migrated.toLocaleString()}`);
    console.log(`❌ Ошибок: ${result.errors.length}`);
    console.log(`🗂️ Использовано уровней: ${result.optimalLevels}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Ошибки:');
      result.errors.slice(0, 10).forEach(error => console.log(`  • ${error}`));
      if (result.errors.length > 10) {
        console.log(`  ... и еще ${result.errors.length - 10} ошибок`);
      }
    }
    
    // Статистика новой структуры
    console.log('\n📈 Статистика новой структуры:');
    console.log(`📁 Всего директорий: ${result.stats.totalDirectories.toLocaleString()}`);
    console.log(`📄 Среднее файлов на папку: ${result.stats.averageFilesPerDirectory.toFixed(2)}`);
    console.log(`📈 Максимум файлов в папке: ${result.stats.maxFilesInDirectory}`);
    console.log(`📉 Минимум файлов в папке: ${result.stats.minFilesInDirectory}`);
    
    // Оценка производительности
    const performance = result.stats.maxFilesInDirectory <= 1000 ? 'ОТЛИЧНАЯ' : 'ТРЕБУЕТ ОПТИМИЗАЦИИ';
    console.log(`🎯 Производительность: ${performance}`);
    
    console.log('\n📝 СЛЕДУЮЩИЕ ШАГИ:');
    console.log('1. Проверьте новую структуру в ./data_new');
    console.log('2. Если все корректно, выполните:');
    console.log('   mv ./data ./data_old');
    console.log('   mv ./data_new ./data');
    console.log('3. Обновите индексер для использования новой структуры');
    
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main();
} 