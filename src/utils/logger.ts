import pino from 'pino';
import { IndexerConfig } from '../types';

/**
 * Create and configure logger instance
 */
export function createLogger(config: IndexerConfig) {
  const loggerOptions: pino.LoggerOptions = {
    level: config.logLevel,
    formatters: {
      level: (label: string) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // Add pretty printing for development
  if (config.logPretty) {
    return pino(
      loggerOptions,
      pino.destination({
        sync: false,
      })
    ).child({
      name: 'ton-indexer',
    });
  }

  return pino(loggerOptions).child({
    name: 'ton-indexer',
  });
}

/**
 * Logger type alias
 */
export type Logger = ReturnType<typeof createLogger>; 