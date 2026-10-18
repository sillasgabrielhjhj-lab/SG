import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertSafeUrl,
  isBlockedIp,
  ResponseTooLargeError,
  safeFetch,
  SafeFetchTimeoutError,
  SsrfBlockedError,
  TooManyRedirectsError,
  type Resolver,
} from '../../src/lib/ssrf.js';

/** Servidores HTTP LOCAIS (simulados) em 127.0.0.1; nenhuma rede externa é usada. */
interface SimServer {
  server: http.Server;
  port: number;
  hits: string[];
}
async function startServer(handler: (req: http.IncomingMessage, res: http.ServerResponse, hits: string[]) => void): Promise<SimServer> {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url ?? '');
    handler(req, res, hits);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: (server.address() as AddressInfo).port, hits };
}
const stop = (s: SimServer) =>
  new Promise<void>((r) => {
    s.server.closeAllConnections();
    s.server.close(() => r());
  });

// nome "público" fictício que o resolver injetado aponta para o servidor local
const SIM_HOST = 'sim-permitido.test';
const simResolver: Resolver = async (h) => {
  if (h === SIM_HOST) return [{ address: '127.0.0.1', family: 4 }];
  throw new Error(`NXDOMAIN ${h}`);
};
const onlySimHost = (h: string) => h === SIM_HOST;

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1', '127.255.255.254', '0.0.0.0', '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '169.254.0.1', '100.64.0.1', '100.127.255.255', '192.0.0.1', '192.0.2.10', '198.18.0.1', '198.51.100.7',
    '203.0.113.9', '224.0.0.1', '239.255.255.250', '240.0.0.1', '255.255.255.255',
    '::', '::1', 'fe80::1', 'fe80::abcd%eth0', 'fc00::1', 'fd12:3456::1', 'fec0::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.1.2.3', '::ffff:169.254.169.254', '::127.0.0.1',
    '64:ff9b::7f00:1', '64:ff9b::a9fe:a9fe', '64:ff9b:1::1', '2002:7f00:1::1', '2002:a9fe:a9fe::1',
    '2001:db8::1', '2001::1', '100::1', '3fff::1',
  ])('bloqueia %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1', '100.63.255.255', '192.169.0.1', '2606:4700:4700::1111', '2a00:1450:4001:81b::200e', '::ffff:8.8.8.8', '2002:0808:0808::1'])(
    'permite %s',
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );

  it('texto que não é IP é tratado como bloqueado (falha fechada)', () => {
    expect(isBlockedIp('não-é-ip')).toBe(true);
    expect(isBlockedIp('')).toBe(true);
  });
});

describe('assertSafeUrl', () => {
  const publicResolver: Resolver = async () => [{ address: '93.184.216.34', family: 4 }];

  it.each([
    'http://127.0.0.1/',
    'http://127.1/',
    'http://2130706433/', // 127.0.0.1 em decimal
    'http://0x7f.0.0.1/',
    'http://017700000001/', // octal
    'http://localhost/',
    'http://LOCALHOST./',
    'http://api.localhost/',
    'http://10.0.0.5:8080/admin',
    'http://172.16.5.4/',
    'http://192.168.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
    'http://[fe80::1]/',
    'http://0.0.0.0/',
  ])('bloqueia %s', async (url) => {
    await expect(assertSafeUrl(url, { resolver: publicResolver })).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it.each(['file:///etc/passwd', 'ftp://example.com/', 'gopher://example.com/', 'javascript:alert(1)', 'data:text/plain,oi', 'não é url'])(
    'bloqueia esquema/URL inválidos: %s',
    async (url) => {
      await expect(assertSafeUrl(url, { resolver: publicResolver })).rejects.toBeInstanceOf(SsrfBlockedError);
    },
  );

  it('bloqueia credenciais embutidas na URL', async () => {
    await expect(assertSafeUrl('https://user:pass@example.com/', { resolver: publicResolver })).rejects.toThrow(/credenciais/);
  });

  it('aceita host público e devolve os endereços validados', async () => {
    const r = await assertSafeUrl('https://www.mercadolivre.com.br/p/MLB123', { resolver: publicResolver });
    expect(r.hostname).toBe('www.mercadolivre.com.br');
    expect(r.addresses).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });

  it('bloqueia se QUALQUER endereço resolvido for privado (resposta mista)', async () => {
    const mixed: Resolver = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.7', family: 4 },
    ];
    await expect(assertSafeUrl('https://exemplo.com/', { resolver: mixed })).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('bloqueia hostname público que resolve para IPv6 privado ou loopback', async () => {
    for (const address of ['::1', 'fd00::5', '::ffff:192.168.1.1']) {
      const r: Resolver = async () => [{ address, family: 6 }];
      await expect(assertSafeUrl('https://exemplo.com/', { resolver: r })).rejects.toBeInstanceOf(SsrfBlockedError);
    }
  });

  it('falha de DNS ou resposta vazia => bloqueado', async () => {
    await expect(assertSafeUrl('https://nao-existe.test/', { resolver: async () => { throw new Error('NXDOMAIN'); } })).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertSafeUrl('https://vazio.test/', { resolver: async () => [] })).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('allowedHosts: exato e curinga', async () => {
    const allowedHosts = ['mercadolivre.com.br', '*.mercadolibre.com'];
    await expect(assertSafeUrl('https://mercadolivre.com.br/x', { allowedHosts, resolver: publicResolver })).resolves.toBeTruthy();
    await expect(assertSafeUrl('https://api.mercadolibre.com/x', { allowedHosts, resolver: publicResolver })).resolves.toBeTruthy();
    await expect(assertSafeUrl('https://mercadolibre.com/x', { allowedHosts, resolver: publicResolver })).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertSafeUrl('https://evil-mercadolivre.com.br/x', { allowedHosts, resolver: publicResolver })).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertSafeUrl('https://mercadolivre.com.br.evil.com/x', { allowedHosts, resolver: publicResolver })).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('allowPrivate (somente testes) libera apenas o que for permitido', async () => {
    await expect(assertSafeUrl('http://127.0.0.1:9/', { allowPrivate: true })).resolves.toBeTruthy();
    await expect(assertSafeUrl(`http://${SIM_HOST}/`, { allowPrivate: onlySimHost, resolver: simResolver })).resolves.toBeTruthy();
    await expect(assertSafeUrl('http://127.0.0.1:9/', { allowPrivate: onlySimHost })).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});

describe('safeFetch (servidores locais SIMULADOS)', () => {
  let ok: SimServer;
  let hang: SimServer;
  let big: SimServer;
  let loop: SimServer;
  let secret: SimServer; // alvo "interno" que NUNCA deve receber requisições
  let redirector: SimServer;

  beforeAll(async () => {
    secret = await startServer((_req, res) => res.end('SEGREDO-INTERNO'));
    ok = await startServer((req, res) => {
      if (req.url === '/json') {
        res.setHeader('content-type', 'application/json');
        return void res.end(JSON.stringify({ valor: 42 }));
      }
      if (req.url === '/echo-auth') return void res.end(String(req.headers.authorization ?? 'sem-auth'));
      res.end('olá');
    });
    hang = await startServer(() => undefined); // nunca responde
    big = await startServer((_req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end('x'.repeat(100_000));
    });
    loop = await startServer((req, res) => {
      res.statusCode = 302;
      res.setHeader('location', `http://${SIM_HOST}:${loop.port}/n${Math.random().toString(36).slice(2)}`);
      res.end();
      void req;
    });
    redirector = await startServer((req, res) => {
      const redirect = (to: string, status = 302) => {
        res.statusCode = status;
        res.setHeader('location', to);
        res.end();
      };
      switch (req.url) {
        case '/to-final':
          return redirect('/final');
        case '/final':
          return void res.end('destino final');
        case '/to-loopback-ip':
          return redirect(`http://127.0.0.1:${secret.port}/segredo`);
        case '/to-localhost':
          return redirect(`http://localhost:${secret.port}/segredo`);
        case '/to-metadata':
          return redirect('http://169.254.169.254/latest/meta-data/iam/security-credentials/');
        case '/to-ipv6-loopback':
          return redirect(`http://[::1]:${secret.port}/segredo`);
        case '/to-mapped':
          return redirect(`http://[::ffff:127.0.0.1]:${secret.port}/segredo`);
        case '/to-file':
          return redirect('file:///etc/passwd');
        case '/to-decimal':
          return redirect(`http://2130706433:${secret.port}/segredo`);
        case '/to-internal-name':
          return redirect(`http://interno.rebind.test:${secret.port}/segredo`);
        case '/chain':
          return redirect('/chain2');
        case '/chain2':
          return redirect('/final');
        case '/post-redirect':
          return redirect('/final', 303);
        default:
          res.statusCode = 404;
          res.end('nada');
      }
    });
  });
  afterAll(async () => {
    await Promise.all([ok, hang, big, loop, secret, redirector].map(stop));
  });
  beforeEach(() => {
    secret.hits.length = 0;
  });

  const base = (s: SimServer) => `http://${SIM_HOST}:${s.port}`;
  const opts = { allowPrivate: onlySimHost, resolver: simResolver };

  it('busca normalmente quando o host é liberado (texto e JSON)', async () => {
    const res = await safeFetch(`${base(ok)}/json`, opts);
    expect(res.status).toBe(200);
    expect(res.json()).toEqual({ valor: 42 });
    expect((await safeFetch(`${base(ok)}/`, opts)).text()).toBe('olá');
  });

  it('por padrão (sem allowPrivate) recusa loopback sem sequer conectar', async () => {
    const before = ok.hits.length;
    await expect(safeFetch(`http://127.0.0.1:${ok.port}/`)).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(safeFetch(`http://localhost:${ok.port}/`)).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(ok.hits.length).toBe(before);
  });

  it('segue redirecionamento relativo e registra os saltos', async () => {
    const res = await safeFetch(`${base(redirector)}/chain`, opts);
    expect(res.text()).toBe('destino final');
    expect(res.redirects).toHaveLength(2);
    expect(res.url).toBe(`${base(redirector)}/final`);
  });

  it('303 após POST vira GET e descarta o corpo', async () => {
    const res = await safeFetch(`${base(redirector)}/post-redirect`, { ...opts, method: 'POST', body: 'dados' });
    expect(res.text()).toBe('destino final');
  });

  it.each([
    ['IP loopback', '/to-loopback-ip'],
    ['localhost', '/to-localhost'],
    ['metadata de nuvem 169.254.169.254', '/to-metadata'],
    ['IPv6 loopback', '/to-ipv6-loopback'],
    ['IPv4 mapeado em IPv6', '/to-mapped'],
    ['IP em decimal', '/to-decimal'],
    ['esquema file:', '/to-file'],
  ])('redirecionamento para %s é bloqueado e o alvo nunca é contatado', async (_name, path) => {
    await expect(safeFetch(`${base(redirector)}${path}`, opts)).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(secret.hits).toEqual([]);
  });

  it('redirecionamento para nome que resolve a IP privado (via resolver) é bloqueado', async () => {
    const resolver: Resolver = async (h) => (h === 'interno.rebind.test' ? [{ address: '127.0.0.1', family: 4 }] : simResolver(h));
    await expect(safeFetch(`${base(redirector)}/to-internal-name`, { allowPrivate: onlySimHost, resolver })).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(secret.hits).toEqual([]);
  });

  it('limita a 5 redirecionamentos', async () => {
    await expect(safeFetch(`${base(loop)}/inicio`, opts)).rejects.toBeInstanceOf(TooManyRedirectsError);
    expect(loop.hits.length).toBe(6); // requisição inicial + 5 saltos seguidos
  });

  it('followRedirects=false devolve o 3xx sem seguir', async () => {
    const res = await safeFetch(`${base(redirector)}/to-final`, { ...opts, followRedirects: false });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/final');
  });

  it('não repassa Authorization para outra origem no redirecionamento', async () => {
    const echo = await startServer((req, res) => res.end(String(req.headers.authorization ?? 'sem-auth')));
    const cross = await startServer((_req, res) => {
      res.statusCode = 302;
      res.setHeader('location', `http://${SIM_HOST}:${echo.port}/x`);
      res.end();
    });
    try {
      const res = await safeFetch(`${base(cross)}/`, { ...opts, headers: { Authorization: 'Bearer SEGREDO' } });
      expect(res.text()).toBe('sem-auth');
      // na mesma origem o header é mantido
      expect((await safeFetch(`${base(ok)}/echo-auth`, { ...opts, headers: { Authorization: 'Bearer SEGREDO' } })).text()).toBe('Bearer SEGREDO');
    } finally {
      await Promise.all([stop(echo), stop(cross)]);
    }
  });

  it('DNS rebinding SIMULADO: resolve uma única vez por salto e fixa o IP validado', async () => {
    // 1ª resolução: IP público; qualquer 2ª resolução devolveria loopback (ataque de rebinding)
    let calls = 0;
    const rebinding: Resolver = async () => {
      calls++;
      return calls === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }];
    };
    const before = ok.hits.length;
    // O IP público não é alcançável no sandbox: a conexão falha/expira, mas NUNCA chega ao servidor loopback.
    await expect(safeFetch(`http://rebind.exemplo.test:${ok.port}/`, { resolver: rebinding, timeoutMs: 800 })).rejects.toThrow();
    expect(calls).toBe(1);
    expect(ok.hits.length).toBe(before);
  });

  it('DNS rebinding SIMULADO: validação que já enxerga o IP privado bloqueia', async () => {
    let calls = 0;
    const rebinding: Resolver = async () => {
      calls++;
      return calls === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }];
    };
    const target = 'https://rebind.exemplo.test/';
    await expect(assertSafeUrl(target, { resolver: rebinding })).resolves.toBeTruthy(); // 1ª: público
    await expect(assertSafeUrl(target, { resolver: rebinding })).rejects.toBeInstanceOf(SsrfBlockedError); // 2ª: privado
  });

  it('respeita o limite de tamanho (corpo e Content-Length)', async () => {
    await expect(safeFetch(`${base(big)}/`, { ...opts, maxBytes: 1000 })).rejects.toBeInstanceOf(ResponseTooLargeError);
    const chunked = await startServer((_req, res) => {
      res.write('a'.repeat(5000));
      res.write('b'.repeat(5000));
      res.end();
    });
    try {
      await expect(safeFetch(`${base(chunked)}/`, { ...opts, maxBytes: 6000 })).rejects.toBeInstanceOf(ResponseTooLargeError);
    } finally {
      await stop(chunked);
    }
    expect((await safeFetch(`${base(big)}/`, { ...opts, maxBytes: 200_000 })).body.length).toBe(100_000);
  });

  it('aplica timeout total', async () => {
    const started = Date.now();
    await expect(safeFetch(`${base(hang)}/`, { ...opts, timeoutMs: 300 })).rejects.toBeInstanceOf(SafeFetchTimeoutError);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
