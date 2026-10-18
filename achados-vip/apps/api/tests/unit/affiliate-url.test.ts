import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings.js';
import { checkAffiliateUrlShape, extractMlItemId } from '../../src/services/affiliate-url.js';

const hosts = defaultSettings().affiliate.allowedHosts;
const check = (u: string, h: readonly string[] = hosts) => checkAffiliateUrlShape(u, h);

describe('extractMlItemId', () => {
  it('ids soltos (com e sem hífen, qualquer caixa)', () => {
    expect(extractMlItemId('MLB123')).toBe('MLB123');
    expect(extractMlItemId('MLB-123')).toBe('MLB123');
    expect(extractMlItemId('  mlb-3456789012 ')).toBe('MLB3456789012');
    expect(extractMlItemId('MLBU98765')).toBe('MLBU98765');
  });
  it('URL de anúncio', () => {
    expect(extractMlItemId('https://produto.mercadolivre.com.br/MLB-3456789012-fone-bluetooth-_JM')).toBe('MLB3456789012');
    expect(extractMlItemId('https://produto.mercadolivre.com.br/MLB3456789012-fone-_JM?searchVariation=1#polycard')).toBe('MLB3456789012');
  });
  it('URL de catálogo /p/MLB...', () => {
    expect(extractMlItemId('https://www.mercadolivre.com.br/fone-jbl/p/MLB19805472')).toBe('MLB19805472');
    expect(extractMlItemId('https://www.mercadolivre.com.br/up/MLBU123456')).toBe('MLBU123456');
  });
  it('procura na query quando o caminho não tem id', () => {
    expect(extractMlItemId('https://meli.la/abc?item_id=MLB-777')).toBe('MLB777');
    expect(extractMlItemId('https://www.mercadolivre.com.br/ofertas#MLB555')).toBe('MLB555');
  });
  it('texto que não é URL mas contém id', () => {
    expect(extractMlItemId('produto: MLB-42 hoje')).toBe('MLB42');
  });
  it('sem id => null', () => {
    expect(extractMlItemId('')).toBeNull();
    expect(extractMlItemId('   ')).toBeNull();
    expect(extractMlItemId('https://meli.la/2abcDEF')).toBeNull();
    expect(extractMlItemId('https://www.mercadolivre.com.br/ofertas')).toBeNull();
    expect(extractMlItemId('XMLB123')).toBeNull();
    expect(extractMlItemId('MLB')).toBeNull();
    expect(extractMlItemId(undefined as unknown as string)).toBeNull();
  });
  it('percent-encoding inválido não quebra', () => {
    expect(extractMlItemId('https://www.mercadolivre.com.br/%E0%A4%A/MLB-9-x')).toBe('MLB9');
  });
});

describe('checkAffiliateUrlShape: aceita', () => {
  it.each([
    'https://meli.la/2abcDEF',
    'https://www.mercadolivre.com.br/social/achados?matt_tool=1&matt_word=x',
    'https://mercadolivre.com/sec/2xYz',
    'HTTPS://MELI.LA/abc',
    'https://meli.la:443/abc',
    '  https://meli.la/abc  ',
  ])('%s', (u) => {
    expect(check(u)).toEqual({ ok: true });
  });
  it('wildcard "*.dominio" aceita subdomínios, não o domínio puro', () => {
    expect(check('https://produto.mercadolivre.com.br/MLB-1', ['*.mercadolivre.com.br']).ok).toBe(true);
    expect(check('https://mercadolivre.com.br/x', ['*.mercadolivre.com.br']).ok).toBe(false);
    expect(check('https://evilmercadolivre.com.br/x', ['*.mercadolivre.com.br']).ok).toBe(false);
  });
});

describe('checkAffiliateUrlShape: rejeita', () => {
  it('vazio, inválido, muito longa', () => {
    expect(check('')).toMatchObject({ ok: false, reason: 'URL vazia' });
    expect(check('   ').ok).toBe(false);
    expect(check('not a url').ok).toBe(false);
    expect(check('meli.la/abc')).toMatchObject({ ok: false, reason: 'URL inválida' });
    expect(check('https://meli.la/' + 'a'.repeat(2100)).ok).toBe(false);
  });
  it('http e outros esquemas', () => {
    expect(check('http://meli.la/abc')).toMatchObject({ ok: false, reason: 'A URL precisa usar https' });
    expect(check('javascript:alert(1)').ok).toBe(false);
    expect(check('data:text/html,<script>alert(1)</script>').ok).toBe(false);
    expect(check('ftp://meli.la/x').ok).toBe(false);
  });
  it('host fora da lista (inclui lookalikes e subdomínios não listados)', () => {
    expect(check('https://example.com/abc')).toMatchObject({ ok: false });
    expect(check('https://example.com/abc').reason).toContain('Host não permitido');
    expect(check('https://meli.la.evil.com/abc').ok).toBe(false);
    expect(check('https://evil.com/meli.la').ok).toBe(false);
    expect(check('https://mercadolivre.com.br.evil.com/').ok).toBe(false);
    expect(check('https://produto.mercadolivre.com.br/MLB-1').ok).toBe(false); // subdomínio não listado
    expect(check('https://xn--mercadolivre-9fb.com.br/').ok).toBe(false); // IDN
  });
  it('credenciais na URL (incl. truque user@host)', () => {
    expect(check('https://user:pass@meli.la/abc')).toMatchObject({ ok: false, reason: 'A URL não pode conter usuário/senha' });
    expect(check('https://meli.la@evil.com/abc').ok).toBe(false);
    expect(check('https://evil.com@meli.la/abc').ok).toBe(false);
  });
  it('IP literal (v4, v6, formas numéricas)', () => {
    expect(check('https://127.0.0.1/abc', ['127.0.0.1'])).toMatchObject({ ok: false, reason: 'A URL não pode usar endereço IP' });
    expect(check('https://192.168.0.10/x', ['192.168.0.10']).ok).toBe(false);
    expect(check('https://[::1]/x', ['[::1]', '::1']).ok).toBe(false);
    expect(check('https://2130706433/x', ['2130706433', '127.0.0.1']).ok).toBe(false);
    expect(check('https://0x7f.1/x', ['127.0.0.1']).ok).toBe(false);
  });
  it('porta não padrão', () => {
    expect(check('https://meli.la:8443/abc')).toMatchObject({ ok: false, reason: 'A URL não pode usar porta não padrão' });
  });
  it('espaços e caracteres de controle', () => {
    expect(check('https://meli.la/a b').ok).toBe(false);
    expect(check('https://meli.la/a\nb').ok).toBe(false);
    expect(check('https://meli.la/a\u0000b').ok).toBe(false);
  });
  it('lista de hosts vazia rejeita tudo', () => {
    expect(check('https://meli.la/abc', []).ok).toBe(false);
    expect(check('https://meli.la/abc', ['', '  ']).ok).toBe(false);
  });
});
