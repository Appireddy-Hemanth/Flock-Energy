/**
 * Lightweight structured logger.
 * In production, swap this for winston/pino with JSON output.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[currentLevel];
}

function formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}`;
}

export const logger = {
    debug(message: string, meta?: Record<string, unknown>): void {
        if (shouldLog('debug')) console.debug(formatMessage('debug', message, meta));
    },
    info(message: string, meta?: Record<string, unknown>): void {
        if (shouldLog('info')) console.log(formatMessage('info', message, meta));
    },
    warn(message: string, meta?: Record<string, unknown>): void {
        if (shouldLog('warn')) console.warn(formatMessage('warn', message, meta));
    },
    error(message: string, meta?: Record<string, unknown>): void {
        if (shouldLog('error')) console.error(formatMessage('error', message, meta));
    },
};
