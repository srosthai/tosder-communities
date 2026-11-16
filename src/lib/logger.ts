type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function newRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

interface LogFields {
  [key: string]: unknown;
}

const order: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel;
  return order[configured] ?? order.info;
}

export function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (order[level] < threshold()) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'tosder-communities',
    release: process.env.RELEASE ?? process.env.NODE_ENV ?? 'development',
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function reportError(error: unknown, fields: LogFields = {}): void {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };

  log('error', normalized.message, { ...fields, error: normalized });
}

/**
 * Optional error-tracking seam. Set SENTRY_DSN and replace this with the
 * provider's capture call; keeping the interface here prevents feature code
 * from depending on a vendor.
 */
export function captureException(error: unknown, fields: LogFields = {}): void {
  reportError(error, fields);
}
