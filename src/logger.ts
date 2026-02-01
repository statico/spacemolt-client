import { appendFile } from 'fs/promises';
import { join } from 'path';

const LOG_FILE = join(process.cwd(), 'spacemolt-error.log');

export async function logError(source: string, error: unknown): Promise<void> {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const entry = `[${timestamp}] [${source}] ${message}${stack ? `\n${stack}` : ''}\n`;

  try {
    await appendFile(LOG_FILE, entry);
  } catch {
    // Can't log, ignore
  }
}
