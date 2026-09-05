// Minimal structured logger. JSON lines so log aggregators can parse; never log secrets/PII
// (hash or omit emails/IPs). The AuditLog table — not this logger — is the durable record.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...meta });
  // The single sanctioned `console` call in the codebase — every other log goes through here.
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const logger: Logger = {
  debug: (m, meta) => {
    if (process.env.NODE_ENV !== 'production') emit('debug', m, meta);
  },
  info: (m, meta) => emit('info', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  error: (m, meta) => emit('error', m, meta),
};
