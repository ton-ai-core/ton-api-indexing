# TON API Indexer

Incremental blockchain contracts indexer for TON network using tonapi.io API.

## What it does

- Fetches TON account addresses via GraphQL
- Downloads contract inspection data via REST API  
- Saves data as JSON files in hierarchical directory structure
- Resumes from last processed cursor (incremental)
- Handles rate limits and retries automatically

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp env.example .env
# Edit .env and add your TONAPI_KEY
```

3. **Build and run:**
```bash
npm run build
npm start
```

## Configuration

Environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TONAPI_KEY` | ✅ | API key from tonapi.io |
| `DATA_DIRECTORY` | ❌ | Output directory (default: `./data`) |
| `MAX_CONCURRENT_REQUESTS` | ❌ | Parallel requests (default: `4`) |
| `ACCOUNTS_PER_PAGE` | ❌ | Accounts per page (default: `100`) |

## File Structure

```
data/
├── 00/
│   ├── 00/ (JSON files)
│   ├── 01/ (JSON files)
│   └── ...
├── 01/
└── ...
```

Files are saved as: `inspect_{address}.json`

## Features

- ✅ Incremental pagination with cursor persistence
- ✅ Hierarchical file organization (scalable to billions of files)
- ✅ Rate limit handling with exponential backoff
- ✅ Parallel processing with configurable concurrency
- ✅ Automatic retries on network errors
- ✅ Graceful shutdown handling
- ✅ Structured JSON logging

## Scripts

```bash
npm start              # Run single iteration
npm run dev            # Development mode with hot reload
npm run build          # Build TypeScript
npm run lint           # Check code style
```

## Production Usage

Add to crontab for periodic execution:
```bash
*/5 * * * * cd /path/to/ton-api-indexing && npm start
``` 