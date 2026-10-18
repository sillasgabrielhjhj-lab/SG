import { describe, expect, it } from 'vitest';
import { familyKey, isSameFamily } from '../../src/domain/dedupe.js';

const key = (title: string, catalogProductId?: string | null) => familyKey({ title, catalogProductId });

describe('familyKey: catálogo', () => {
  it('catálogo tem prioridade sobre o título', () => {
    expect(key('Qualquer título', 'MLB123')).toBe('cat:MLB123');
    expect(key('Outro título totalmente diferente', ' MLB123 ')).toBe('cat:MLB123');
  });
  it('catalogProductId vazio/espaços cai para o título', () => {
    expect(key('Mouse Gamer', '')).toBe(key('Mouse Gamer'));
    expect(key('Mouse Gamer', '   ')).toBe(key('Mouse Gamer'));
    expect(key('Mouse Gamer', null)).toBe(key('Mouse Gamer'));
  });
  it('catálogo diferente => famílias diferentes mesmo com título igual', () => {
    expect(isSameFamily({ title: 'Fone', catalogProductId: 'A1' }, { title: 'Fone', catalogProductId: 'B2' })).toBe(false);
  });
});

describe('familyKey: normalização do título', () => {
  it('ignora caixa, acentos e pontuação', () => {
    expect(key('Fone de Ouvido Bluetooth JBL Tune 510BT')).toBe(key('FONE DE OUVIDO BLUETOOTH, JBL TUNE 510BT!'));
    expect(key('Câmera Ação Vídeo')).toBe(key('camera acao video'));
  });
  it('remove stopwords PT', () => {
    expect(key('Fone de Ouvido com Microfone para Celular')).toBe(key('Fone Ouvido Microfone Celular'));
  });
  it('remove ruído de marketing (frete grátis, promoção, original, lacrado...)', () => {
    const base = key('Smartphone Samsung Galaxy A54 128GB');
    expect(key('Smartphone Samsung Galaxy A54 128GB Frete Grátis')).toBe(base);
    expect(key('PROMOÇÃO Smartphone Samsung Galaxy A54 128GB Original Lacrado')).toBe(base);
    expect(key('Smartphone Samsung Galaxy A54 128GB - Pronta Entrega - Nota Fiscal')).toBe(base);
    expect(key('Smartphone Samsung Galaxy A54 128GB Oferta Imperdível')).toBe(base);
  });
  it('ordem das palavras não importa', () => {
    expect(key('Galaxy A54 Samsung Smartphone 128GB')).toBe(key('Smartphone Samsung Galaxy A54 128GB'));
  });
  it('palavras repetidas contam uma vez', () => {
    expect(key('Mouse Mouse Gamer')).toBe(key('Mouse Gamer'));
  });
  it('grafia de número+unidade coincide (128 GB = 128GB; 6,5 pol)', () => {
    expect(key('Celular 128 GB')).toBe(key('Celular 128GB'));
    expect(key('Monitor 27 pol')).toBe(key('Monitor 27pol'));
    expect(key('Tela 6,5 pol')).toBe(key('Tela 6,5pol'));
    expect(key('Bateria 1.000 mAh')).toBe(key('Bateria 1000mah'));
  });
});

describe('familyKey: variações que NÃO devem ser unidas', () => {
  it('capacidades diferentes são famílias diferentes', () => {
    expect(isSameFamily({ title: 'Galaxy A54 128GB' }, { title: 'Galaxy A54 256GB' })).toBe(false);
  });
  it('cores diferentes (nome da cor) são famílias diferentes', () => {
    expect(isSameFamily({ title: 'Camiseta Básica Azul' }, { title: 'Camiseta Básica Preta' })).toBe(false);
  });
  it('modelos diferentes não se juntam', () => {
    expect(isSameFamily({ title: 'JBL Tune 510BT' }, { title: 'JBL Tune 520BT' })).toBe(false);
    expect(isSameFamily({ title: 'Fone sem fio' }, { title: 'Fone com fio' })).toBe(false);
    expect(isSameFamily({ title: 'Tela 6,5 pol' }, { title: 'Tela 65 pol' })).toBe(false);
  });
  it('catálogo vs. título nunca são considerados iguais', () => {
    expect(isSameFamily({ title: 'Fone', catalogProductId: 'MLB1' }, { title: 'Fone' })).toBe(false);
  });
});

describe('familyKey: numeração de cor', () => {
  it('"cor 03", "cor nº 12" são removidos (variação cosmética)', () => {
    expect(key('Batom Matte cor 03')).toBe(key('Batom Matte cor 12'));
    expect(key('Batom Matte Cor nº 7')).toBe(key('Batom Matte'));
    expect(key('Batom Matte cor: 05')).toBe(key('Batom Matte'));
  });
});

describe('familyKey: bordas', () => {
  it('título vazio/só ruído gera chave vazia e nunca é "igual"', () => {
    expect(key('')).toBe('');
    expect(key('   !!! ')).toBe('');
    expect(key('Frete Grátis Promoção')).toBe('');
    expect(isSameFamily({ title: '' }, { title: '' })).toBe(false);
    expect(isSameFamily({ title: 'Frete grátis' }, { title: 'Promoção' })).toBe(false);
  });
  it('é determinístico e limita o tamanho da chave', () => {
    const long = Array.from({ length: 80 }, (_, i) => `palavra${i}`).join(' ');
    expect(key(long)).toBe(key(long));
    expect(key(long).length).toBeLessThanOrEqual(200);
  });
  it('título nulo/indefinido em runtime não quebra', () => {
    expect(familyKey({ title: undefined as unknown as string })).toBe('');
  });
  it('isSameFamily para títulos equivalentes', () => {
    expect(isSameFamily({ title: 'Air Fryer 4L Mondial' }, { title: 'AIR FRYER Mondial 4 L - Frete Grátis' })).toBe(true);
  });
});
