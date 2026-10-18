/**
 * Seed idempotente: categorias iniciais (TODAS desabilitadas), configurações padrão e o canal
 * "Fila manual" (não envia nada sozinho). Reexecutar NÃO sobrescreve edições feitas no painel.
 *
 * IDs de categoria do Mercado Livre Brasil: só entram os que são conhecidos com segurança
 * (categorias-raiz do site). Onde não há certeza, a lista fica vazia e usamos termos de busca;
 * o administrador pode ajustar tudo em Configurações > Categorias.
 */
import { pathToFileURL } from 'node:url';
import type { Prisma, PrismaClient } from '@prisma/client';
import { defaultSettings } from '../src/domain/settings.js';
import { disconnectDb, prisma } from '../src/lib/db.js';

export interface SeedCategory {
  key: string;
  name: string;
  mlCategoryIds: string[];
  searchTerms: string[];
  relevance: number;
}

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { key: 'smartphones', name: 'Smartphones e acessórios', mlCategoryIds: ['MLB1055'], searchTerms: ['carregador turbo', 'capa para celular', 'película para celular'], relevance: 80 },
  { key: 'informatica', name: 'Informática e notebooks', mlCategoryIds: ['MLB1648'], searchTerms: ['notebook', 'monitor', 'ssd'], relevance: 75 },
  { key: 'eletrodomesticos', name: 'Eletrodomésticos', mlCategoryIds: ['MLB5726'], searchTerms: [], relevance: 70 },
  { key: 'casa-cozinha', name: 'Casa e cozinha', mlCategoryIds: ['MLB1574'], searchTerms: ['air fryer', 'panela', 'utensílios de cozinha'], relevance: 65 },
  { key: 'eletronicos', name: 'Eletrônicos', mlCategoryIds: ['MLB1000'], searchTerms: [], relevance: 70 },
  { key: 'games', name: 'Games e consoles', mlCategoryIds: ['MLB1144'], searchTerms: [], relevance: 70 },
  { key: 'beleza', name: 'Beleza e cuidados pessoais', mlCategoryIds: ['MLB1246'], searchTerms: [], relevance: 55 },
  { key: 'moda-calcados', name: 'Moda e calçados', mlCategoryIds: ['MLB1430'], searchTerms: [], relevance: 50 },
  // sem ID confirmado: busca por termos
  { key: 'audio-fones', name: 'Áudio e fones de ouvido', mlCategoryIds: [], searchTerms: ['fone de ouvido bluetooth', 'fone de ouvido', 'caixa de som bluetooth', 'headset gamer'], relevance: 70 },
  { key: 'ferramentas', name: 'Ferramentas domésticas', mlCategoryIds: ['MLB263532'], searchTerms: [], relevance: 55 },
  // categoria transversal: depende de dado real de "mais vendidos"/popularidade; fica sem fonte até o admin configurar
  { key: 'populares', name: 'Produtos populares em alta', mlCategoryIds: [], searchTerms: [], relevance: 60 },
];

export const MANUAL_QUEUE_CHANNEL_NAME = 'Fila manual – ACHADOS VIP';

export async function runSeed(client: PrismaClient = prisma): Promise<{ categories: number; channelCreated: boolean }> {
  for (const [index, c] of DEFAULT_CATEGORIES.entries()) {
    await client.category.upsert({
      where: { key: c.key },
      update: {}, // preserva alterações feitas pelo administrador
      create: { ...c, enabled: false, sortOrder: index },
    });
  }

  await client.automationSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, data: defaultSettings() as unknown as Prisma.InputJsonValue },
  });

  // O canal manual só gera mensagens prontas (MANUAL_READY); nunca envia por conta própria => pode nascer habilitado.
  const existing = await client.publishingChannel.findFirst({ where: { type: 'WHATSAPP_MANUAL_QUEUE' } });
  if (!existing) {
    await client.publishingChannel.create({
      data: { type: 'WHATSAPP_MANUAL_QUEUE', name: MANUAL_QUEUE_CHANNEL_NAME, enabled: true, config: { groupName: 'ACHADOS VIP' } },
    });
  }
  return { categories: DEFAULT_CATEGORIES.length, channelCreated: !existing };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = await runSeed();
    console.log(`Seed concluído: ${r.categories} categorias (desabilitadas), configurações padrão${r.channelCreated ? ', canal "Fila manual" criado' : ''}.`);
  } catch (err) {
    console.error('Falha no seed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await disconnectDb();
  }
}
