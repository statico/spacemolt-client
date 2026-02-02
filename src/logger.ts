import { appendFile } from 'fs/promises';
import { join } from 'path';

const ERROR_LOG_FILE = join(process.cwd(), 'spacemolt-error.log');
const DEBUG_LOG_FILE = join(process.cwd(), 'spacemolt-debug.log');

let debugEnabled = false;

export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebugMode(): boolean {
  return debugEnabled;
}

export async function logError(source: string, error: unknown): Promise<void> {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const entry = `[${timestamp}] [${source}] ${message}${stack ? `\n${stack}` : ''}\n`;

  try {
    await appendFile(ERROR_LOG_FILE, entry);
  } catch {
    // Can't log, ignore
  }
}

export async function logDebug(source: string, message: string, data?: unknown): Promise<void> {
  if (!debugEnabled) return;

  const timestamp = new Date().toISOString();
  let entry = `[${timestamp}] [${source}] ${message}`;

  if (data !== undefined) {
    try {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      entry += `\n${dataStr}`;
    } catch {
      entry += `\n[Could not serialize data]`;
    }
  }

  entry += '\n\n';

  try {
    await appendFile(DEBUG_LOG_FILE, entry);
  } catch {
    // Can't log, ignore
  }
}
