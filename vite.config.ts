import { appendFile, mkdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { PreviewServer, ViteDevServer } from 'vite';

const LOG_DIR = fileURLToPath(new URL('./logs/', import.meta.url));
const MAX_BODY_BYTES = 32 * 1024;
let writes: Promise<void> = Promise.resolve();

function respond(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
  response.end(message);
}

function isLogEntry(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return 'event' in value && typeof value.event === 'string' && value.event.length <= 100 &&
    value.event.length > 0 &&
    'sessionId' in value && typeof value.sessionId === 'string' &&
    /^[a-zA-Z0-9-]{1,100}$/.test(value.sessionId) &&
    'sequence' in value && typeof value.sequence === 'number' &&
    Number.isSafeInteger(value.sequence) && value.sequence > 0 &&
    'timeMs' in value && typeof value.timeMs === 'number' &&
    Number.isFinite(value.timeMs) && value.timeMs >= 0 &&
    'timestamp' in value && typeof value.timestamp === 'string' &&
    Number.isFinite(Date.parse(value.timestamp));
}

async function receiveLog(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    respond(response, 405, 'Use POST for log events.');
    return;
  }
  const origin = request.headers.origin;
  if (origin && origin !== `http://${request.headers.host}` && origin !== `https://${request.headers.host}`) {
    respond(response, 403, 'Cross-origin log writes are not allowed.');
    return;
  }
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    respond(response, 415, 'Expected application/json.');
    return;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size <= MAX_BODY_BYTES) chunks.push(bytes);
    else chunks.length = 0;
  }
  if (size > MAX_BODY_BYTES) {
    respond(response, 413, 'Log event exceeds 32 KiB.');
    return;
  }

  let entry: unknown;
  try {
    entry = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    respond(response, 400, 'Invalid JSON.');
    return;
  }
  if (!isLogEntry(entry)) {
    respond(response, 400, 'Invalid log event metadata.');
    return;
  }

  const receivedAt = new Date().toISOString();
  const filename = join(LOG_DIR, `cubeman-${receivedAt.slice(0, 10)}.jsonl`);
  const line = JSON.stringify({ ...entry, receivedAt }) + '\n';
  const write = async (): Promise<void> => {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(filename, line, 'utf8');
  };
  // Serialize appends across tabs; a failed request must not block later writes.
  const pending = writes.then(write, write);
  writes = pending;
  await pending;
  respond(response, 204, '');
}

function installLogEndpoint(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use((request, response, next) => {
    if (request.url?.split('?')[0] !== '/__cubeman/logs') {
      next();
      return;
    }
    void receiveLog(request, response).catch((error: unknown) => {
      server.config.logger.error(`[cubeman] Could not persist log: ${String(error)}`);
      if (!response.headersSent) respond(response, 503, 'Could not persist log to disk.');
      else response.end();
    });
  });
}

export default defineConfig({
  // Bind to all interfaces so the app is reachable from other LAN devices.
  server: { host: true },
  preview: { host: true },
  plugins: [{
    name: 'cubeman-file-logs',
    configureServer: installLogEndpoint,
    configurePreviewServer: installLogEndpoint,
  }],
});
