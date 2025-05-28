# TON API Incremental Indexer

Инкрементальный индексатор для скачивания данных о контрактах из TON-блокчейна через API `tonapi.io`.

## Возможности

- 🔄 **Инкрементальная пагинация** - продолжение с последнего обработанного курсора
- 📡 **GraphQL + REST API** - использование GraphQL для получения списка аккаунтов и REST для инспекции контрактов
- ⚡ **Параллельная обработка** - настраиваемое количество одновременных запросов (до 4)
- 🔄 **Автоматические повторы** - обработка ошибок сети с экспоненциальной задержкой
- 📁 **Умное сохранение** - проверка существующих файлов для избежания дубликатов
- 📝 **Структурированное логирование** - детальные логи в JSON формате
- 🛡️ **Graceful shutdown** - корректное завершение работы по сигналам
- 🔄 **Обработка Rate Limits (429)** - Специальная логика для лимитов API:
  - Чтение заголовка `Retry-After` от сервера
  - Экспоненциальная задержка при отсутствии заголовка
  - Максимальная задержка 60 секунд
  - Логирование всех rate limit событий

## Установка

### Требования

- Node.js >= 18.0.0
- npm или yarn
- API ключ от tonapi.io

### Шаги установки

1. **Клонирование и установка зависимостей:**
```bash
git clone <repository-url>
cd ton-api-indexing
npm install
```

2. **Настройка переменных окружения:**
```bash
cp env.example .env
```

Отредактируйте `.env` файл:
```env
TONAPI_KEY=your_api_key_here
TONAPI_GRAPHQL_URL=https://tonapi.io/v2/graphql
TONAPI_REST_URL=https://tonapi.io/v2
CURSOR_FILE_PATH=./cursor.txt
DATA_DIRECTORY=./data
MAX_CONCURRENT_REQUESTS=4
ACCOUNTS_PER_PAGE=100
LOG_LEVEL=info
```

3. **Сборка проекта:**
```bash
npm run build
```

## Использование

### Режимы запуска

#### Одна итерация (рекомендуется для cron)
```bash
npm start
# или
node dist/index.js
```

#### Полная индексация (все страницы)
```bash
npm start complete
# или
node dist/index.js complete
```

#### Разработка с hot-reload
```bash
npm run dev
```

### Настройка cron

Для периодического запуска добавьте в crontab:

```bash
# Каждые 5 минут
*/5 * * * * cd /path/to/ton-api-indexing && npm start >> /var/log/ton-indexer.log 2>&1

# Каждый час
0 * * * * cd /path/to/ton-api-indexing && npm start

# Каждый день в 02:00
0 2 * * * cd /path/to/ton-api-indexing && npm start
```

## Конфигурация

### Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `TONAPI_KEY` | - | **Обязательно**: API ключ от tonapi.io |
| `TONAPI_GRAPHQL_URL` | `https://tonapi.io/v2/graphql` | GraphQL endpoint |
| `TONAPI_REST_URL` | `https://tonapi.io/v2` | REST API base URL |
| `CURSOR_FILE_PATH` | `./cursor.txt` | Путь к файлу с курсором |
| `DATA_DIRECTORY` | `./data` | Директория для сохранения JSON файлов |
| `MAX_CONCURRENT_REQUESTS` | `4` | Максимум параллельных запросов |
| `REQUEST_DELAY_MS` | `100` | Задержка между запросами |
| `ACCOUNTS_PER_PAGE` | `100` | Количество аккаунтов за один запрос |
| `MAX_RETRIES` | `3` | Максимум попыток при ошибке |
| `RETRY_DELAY_MS` | `1000` | Задержка между повторами |
| `LOG_LEVEL` | `info` | Уровень логирования (`debug`, `info`, `warn`, `error`) |
| `LOG_PRETTY` | `false` | Красивое форматирование логов |

## Структура проекта

```
ton-api-indexing/
├── src/
│   ├── config/
│   │   └── index.ts           # Загрузка конфигурации
│   ├── services/
│   │   ├── GraphQLClient.ts   # GraphQL клиент
│   │   ├── RestClient.ts      # REST API клиент
│   │   └── IndexerService.ts  # Основная логика индексации
│   ├── types/
│   │   └── index.ts           # TypeScript типы
│   ├── utils/
│   │   ├── fileUtils.ts       # Работа с файлами
│   │   └── logger.ts          # Логирование
│   └── index.ts               # Точка входа
├── data/                      # Сохраненные JSON файлы
├── cursor.txt                 # Файл с курсором
├── package.json
├── tsconfig.json
└── README.md
```

### Формат сохраненных файлов

Файлы сохраняются в формате:
- Имя файла: `inspect_{rawAddress_with_underscores}.json`
- Содержимое: полные данные из `/blockchain/accounts/{address}/inspect`

Пример:
```
data/inspect_0_11bb825750ffcffc4cebc7846910a87f3.json
```

## API интеграция

### GraphQL запрос
```graphql
query($first: Int!, $after: Cursor) {
  allAccounts(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      rawAddress
    }
  }
}
```

### REST endpoint
```
GET https://tonapi.io/v2/blockchain/accounts/{rawAddress}/inspect
Authorization: Bearer {API_KEY}
```

## Логирование

Приложение использует структурированное логирование с библиотекой `pino`. Все логи содержат временные метки и контекстную информацию.

### Уровни логирования

- **debug**: Детальная информация о каждой операции
- **info**: Общая информация о ходе выполнения
- **warn**: Предупреждения и повторные попытки
- **error**: Ошибки и исключения

### Примеры логов

```json
{
  "level": "INFO",
  "time": "2024-01-15T10:30:00.000Z",
  "name": "ton-indexer",
  "msg": "Successfully fetched accounts",
  "accountsCount": 100,
  "hasNextPage": true,
  "endCursor": "eyJhZGRyZXNzIjoiMCJ9"
}
```

## Мониторинг и отладка

### Проверка состояния

1. **Проверка курсора:**
```bash
cat cursor.txt
```

2. **Просмотр последних логов:**
```bash
npm start 2>&1 | tail -f
```

3. **Количество обработанных контрактов:**
```bash
ls -la data/ | wc -l
```

### Возможные проблемы

#### Ошибка авторизации
```
API error (401): Unauthorized
```
**Решение**: Проверьте правильность API ключа в `.env`

#### Превышение лимитов
```
API error (429): Too Many Requests
```
**Решение**: Уменьшите `MAX_CONCURRENT_REQUESTS` или увеличьте `REQUEST_DELAY_MS`

#### Сетевые ошибки
```
Network error: ECONNRESET
```
**Решение**: Автоматические повторы включены. Проверьте стабильность соединения.

## Развитие

### Запуск тестов
```bash
npm test
```

### Линтинг
```bash
npm run lint
```

### Сборка
```bash
npm run build
```

### Очистка
```bash
npm run clean
```

## Docker (опционально)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
CMD ["node", "dist/index.js"]
```

## Лицензия

MIT License

## Поддержка

Для вопросов и поддержки обращайтесь к команде TON Foundation. 