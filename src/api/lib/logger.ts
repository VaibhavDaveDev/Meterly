type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  trace: 10, debug: 20, info: 30, warn: 40, error: 50,
};

function getMinLevel(): LogLevel {
  const raw = (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).__logLevel) as string | undefined;
  return (raw as LogLevel) ?? 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[getMinLevel()];
}

function emit(level: LogLevel, fields: Record<string, unknown>, msg: string) {
  if (!shouldLog(level)) return;
  const entry = JSON.stringify({ level, msg, t: Date.now(), ...fields });
  if (level === 'error' || level === 'warn') {
    console.error(entry);
  } else {
    console.log(entry);
  }
}

export const logger = {
  trace: (fields: Record<string, unknown>, msg: string) => emit('trace', fields, msg),
  debug: (fields: Record<string, unknown>, msg: string) => emit('debug', fields, msg),
  info:  (fields: Record<string, unknown>, msg: string) => emit('info',  fields, msg),
  warn:  (fields: Record<string, unknown>, msg: string) => emit('warn',  fields, msg),
  error: (fields: Record<string, unknown>, msg: string) => emit('error', fields, msg),
};
