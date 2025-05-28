#!/bin/bash

# TON API Indexer Daemon Runner
# Автоматически перезапускает индексатор при сбоях
# Всегда продолжает с cursor.txt

set -e

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
RESTART_DELAY=10  # секунд до перезапуска
MAX_RESTARTS=100  # максимум перезапусков за сессию

# Создаем директорию для логов
mkdir -p "$LOG_DIR"

# Функция логирования
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/daemon.log"
}

# Функция graceful shutdown
cleanup() {
    log "🛑 Получен сигнал остановки"
    if [ ! -z "$INDEXER_PID" ] && kill -0 "$INDEXER_PID" 2>/dev/null; then
        log "📤 Отправляем SIGTERM процессу $INDEXER_PID"
        kill -TERM "$INDEXER_PID"
        
        # Ждем graceful shutdown
        for i in {1..30}; do
            if ! kill -0 "$INDEXER_PID" 2>/dev/null; then
                log "✅ Процесс завершен gracefully"
                break
            fi
            sleep 1
        done
        
        # Принудительное завершение если не отвечает
        if kill -0 "$INDEXER_PID" 2>/dev/null; then
            log "⚠️ Принудительное завершение процесса"
            kill -KILL "$INDEXER_PID"
        fi
    fi
    log "🏁 Daemon остановлен"
    exit 0
}

# Установка обработчиков сигналов
trap cleanup SIGINT SIGTERM

# Переходим в директорию проекта
cd "$PROJECT_DIR"

# Проверяем что проект собран
if [ ! -f "dist/index.js" ]; then
    log "🔨 Сборка проекта..."
    npm run build
fi

log "🚀 Запуск TON API Indexer Daemon"
log "📁 Рабочая директория: $PROJECT_DIR"
log "📊 Логи: $LOG_DIR"
log "🔄 Максимум перезапусков: $MAX_RESTARTS"
log "⏱️ Задержка перезапуска: ${RESTART_DELAY}s"
log "⏹️ Остановка: Ctrl+C или kill $($$)"

restart_count=0

while [ $restart_count -lt $MAX_RESTARTS ]; do
    # Проверяем курсор
    if [ -f "cursor.txt" ]; then
        cursor_content=$(cat cursor.txt 2>/dev/null || echo "empty")
        log "📄 Найден cursor.txt: $cursor_content"
    else
        log "📄 cursor.txt не найден - будет создан при первом запуске"
    fi
    
    # Статистика файлов
    data_files=$(find data -name "*.json" 2>/dev/null | wc -l || echo "0")
    log "📊 Обработано файлов: $data_files"
    
    log "🔄 Запуск #$((restart_count + 1)): npm start infinite"
    
    # Запускаем индексатор в infinite режиме
    node dist/index.js infinite > "$LOG_DIR/indexer.log" 2>&1 &
    INDEXER_PID=$!
    
    log "🆔 PID процесса: $INDEXER_PID"
    
    # Ждем завершения процесса
    wait $INDEXER_PID
    exit_code=$?
    
    log "💥 Процесс завершен с кодом: $exit_code"
    
    # Анализируем причину завершения
    if [ $exit_code -eq 0 ]; then
        log "✅ Процесс завершен нормально (graceful shutdown)"
        break
    elif [ $exit_code -eq 130 ]; then
        log "⚠️ Процесс прерван пользователем (Ctrl+C)"
        break
    else
        restart_count=$((restart_count + 1))
        log "❌ Ошибка ($exit_code). Перезапуск через ${RESTART_DELAY}s... ($restart_count/$MAX_RESTARTS)"
        
        # Показываем последние строки лога для диагностики
        if [ -f "$LOG_DIR/indexer.log" ]; then
            log "📋 Последние строки лога:"
            tail -n 5 "$LOG_DIR/indexer.log" | while read line; do
                log "   > $line"
            done
        fi
        
        if [ $restart_count -lt $MAX_RESTARTS ]; then
            sleep $RESTART_DELAY
        fi
    fi
done

if [ $restart_count -eq $MAX_RESTARTS ]; then
    log "🚨 Достигнуто максимальное количество перезапусков ($MAX_RESTARTS)"
    log "🔍 Проверьте логи в $LOG_DIR/ для диагностики"
fi

log "�� Daemon завершен" 