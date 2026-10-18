/**
 * Servidor HTTP SIMULADO em localhost (SOMENTE testes). Base dos simuladores da API do Mercado Livre, do Telegram e
 * dos "hosts virtuais" usados para simular redirecionamentos de links de afiliado. Nenhuma rede externa é usada.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface SimRequest {
  method: string;
  /** caminho + query, como recebido */
  url: string;
  path: string;
  query: URLSearchParams;
  headers: http.IncomingHttpHeaders;
  body: string;
  /** Corpo application/x-www-form-urlencoded. */
  form(): URLSearchParams;
  json<T = any>(): T;
}

export type SimHandler = (req: SimRequest, res: http.ServerResponse) => void | Promise<void>;

export interface SimServer {
  port: number;
  /** http://127.0.0.1:<porta> */
  url: string;
  requests: SimRequest[];
  close(): Promise<void>;
}

export async function startSimServer(handler: SimHandler): Promise<SimServer> {
  const requests: SimRequest[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const parsed = new URL(req.url ?? '/', 'http://sim.local');
      const sim: SimRequest = {
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        path: parsed.pathname,
        query: parsed.searchParams,
        headers: req.headers,
        body,
        form: () => new URLSearchParams(body),
        json: <T>() => JSON.parse(body) as T,
      };
      requests.push(sim);
      void Promise.resolve(handler(sim, res)).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export function sendJson(res: http.ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}): void {
  const payload = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(payload);
}

export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Porta TCP que (muito provavelmente) está fechada: sobe um servidor, anota a porta e o derruba. */
export async function closedPort(): Promise<number> {
  const s = await startSimServer(() => undefined);
  const { port } = s;
  await s.close();
  return port;
}
