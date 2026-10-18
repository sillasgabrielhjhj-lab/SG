import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, ConflictError, NotFoundError, PublishBlockedError, ValidationError, parseInput } from '../../src/lib/errors.js';
import { PageQuerySchema, pageParams, pageResult } from '../../src/lib/pagination.js';
import { addDays, addMinutes, dayKeyInTz, isValidTimeZone, minutesOfDayInTz, startOfDayInTz, withTimeout } from '../../src/lib/time.js';

describe('time', () => {
  it('somas de tempo', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    expect(addMinutes(d, 90).toISOString()).toBe('2026-01-01T01:30:00.000Z');
    expect(addDays(d, 2).toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });

  it('dia e hora locais em America/Sao_Paulo (UTC-3)', () => {
    const d = new Date('2026-10-17T02:30:00Z'); // 23:30 do dia 16 em SP
    expect(dayKeyInTz(d, 'America/Sao_Paulo')).toBe('2026-10-16');
    expect(minutesOfDayInTz(d, 'America/Sao_Paulo')).toBe(23 * 60 + 30);
    expect(startOfDayInTz(d, 'America/Sao_Paulo').toISOString()).toBe('2026-10-16T03:00:00.000Z');
  });

  it('início do dia respeita horário de verão (America/New_York)', () => {
    expect(startOfDayInTz(new Date('2026-03-07T15:00:00Z'), 'America/New_York').toISOString()).toBe('2026-03-07T05:00:00.000Z'); // EST
    expect(startOfDayInTz(new Date('2026-03-09T15:00:00Z'), 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z'); // EDT
  });

  it('isValidTimeZone e withTimeout', async () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('Marte/Olympus')).toBe(false);
    await expect(withTimeout(new Promise(() => undefined), 20, 'x')).rejects.toThrow(/timeout/);
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });
});

describe('errors', () => {
  it('AppError aceita as duas ordens de argumentos', () => {
    const a = new AppError(404, 'NOT_FOUND', 'não achei');
    const b = new AppError('NOT_FOUND', 'não achei', 404);
    for (const e of [a, b]) {
      expect(e).toMatchObject({ status: 404, statusCode: 404, code: 'NOT_FOUND', message: 'não achei' });
      expect(e.toJSON()).toEqual({ error: { code: 'NOT_FOUND', message: 'não achei' } });
    }
    expect(new AppError('X', 'm').status).toBe(400);
    expect(new NotFoundError().status).toBe(404);
    expect(new ConflictError('c', 'DUP', { a: 1 }).toJSON()).toEqual({ error: { code: 'DUP', message: 'c', details: { a: 1 } } });
    expect(new ValidationError().code).toBe('VALIDATION_ERROR');
  });

  it('PublishBlockedError => 409 com o code do bloqueio e mensagem pt-BR', () => {
    const e = new PublishBlockedError('NO_VALIDATED_LINK');
    expect(e).toMatchObject({ status: 409, code: 'NO_VALIDATED_LINK', blockCode: 'NO_VALIDATED_LINK' });
    expect(e.message).toMatch(/link de afiliado validado/);
    expect(e).toBeInstanceOf(AppError);
  });

  it('parseInput devolve o dado tipado ou ValidationError com campos em pt-BR', () => {
    const schema = z.strictObject({ nome: z.string().min(3), idade: z.number().int().min(18).max(99), tipo: z.enum(['a', 'b']) });
    expect(parseInput(schema, { nome: 'Ana', idade: 20, tipo: 'a' })).toEqual({ nome: 'Ana', idade: 20, tipo: 'a' });
    try {
      parseInput(schema, { nome: 'Al', idade: 5, extra: 1 });
      expect.unreachable();
    } catch (err) {
      const e = err as ValidationError;
      expect(e.status).toBe(400);
      const byPath = Object.fromEntries((e.details as { path: string; message: string }[]).map((d) => [d.path || '(raiz)', d.message]));
      expect(byPath.nome).toBe('tamanho mínimo: 3');
      expect(byPath.idade).toBe('valor mínimo: 18');
      expect(byPath.tipo).toBe('campo obrigatório');
      expect(byPath['(raiz)']).toMatch(/campo\(s\) desconhecido\(s\): extra/);
    }
  });
});

describe('paginação', () => {
  it('padrões, coerção e limites', () => {
    expect(PageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(PageQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
    expect(PageQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(pageParams({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
    expect(pageResult(['a'], 41, { page: 2, pageSize: 20 })).toEqual({ items: ['a'], total: 41, page: 2, pageSize: 20 });
  });
});
