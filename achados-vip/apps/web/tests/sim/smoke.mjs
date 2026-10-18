// Teste de fumaça do painel (Chromium) contra a API SIMULADA (tests/sim/mock-api.mjs).
// Pré-requisitos: mock em :4010, painel (build com API_INTERNAL_URL=http://127.0.0.1:4010) em :3100.
// Uso: node tests/sim/smoke.mjs   (variáveis: BASE_URL, PW_MODULE)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'out');
fs.mkdirSync(OUT, { recursive: true });

let passed = 0;
const failures = [];
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok   ${name}`); } else { failures.push(name); console.log(`  FAIL ${name} ${extra}`); }
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

const shot = async (n) => { await page.waitForTimeout(450); return page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: true }); };
const hasHScroll = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

console.log('# Guarda de rota e login');
await page.goto(`${BASE}/ofertas`);
await page.waitForURL(/\/login\?next=%2Fofertas/, { timeout: 15000 });
check('sem sessão, /ofertas redireciona para /login?next=/ofertas', true);
await page.getByLabel('E-mail').fill('admin@sim.local');
await page.getByLabel('Senha').fill('errada');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByText('E-mail ou senha incorretos.').waitFor();
check('erro de login exibido', true);
await shot('login-erro');
await page.getByLabel('Senha').fill('senha-simulada-123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL(`${BASE}/ofertas`, { timeout: 15000 });
check('login volta para a página pedida (next)', true);

console.log('# Dashboard');
await page.goto(`${BASE}/`);
await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
await page.getByText('Ofertas descobertas', { exact: true }).waitFor();
check('KPIs de hoje', await page.getByText('Aprovadas').first().isVisible());
check('badge honesto Autenticação necessária', await page.getByText('Autenticação necessária').first().isVisible());
check('métricas de afiliado indisponíveis (sem números)', await page.getByText('Sem fonte autorizada de cliques/vendas/comissões.').isVisible());
check('gráfico SVG renderizado', (await page.locator('svg[role="img"]').count()) >= 1);
await shot('dashboard');

console.log('# Ofertas');
await page.goto(`${BASE}/ofertas`);
await page.getByText('Smartphone Simulado 128GB').first().waitFor();
check('selo Desconto verificado', await page.getByText('Desconto verificado', { exact: true }).first().isVisible());
check('selo Sem desconto verificado (sem % inventado)', await page.getByText('Sem desconto verificado', { exact: true }).first().isVisible());
check('percentual só do verificado (-32%)', await page.getByText('-32%').count() === 1);
await shot('ofertas');
await page.getByRole('button', { name: 'Fone Bluetooth Simulado com cancelamento de ruído' }).click();
const drawer = page.getByRole('dialog');
await drawer.getByRole('heading', { name: 'Histórico de preço' }).waitFor();
check('selo Desconto apenas anunciado no detalhe', await drawer.getByText('Desconto apenas anunciado', { exact: true }).first().isVisible());
check('aviso de não verificado', await drawer.getByText('não foi verificado').isVisible());
check('gráfico de histórico', (await drawer.locator('svg[role="img"]').count()) >= 1);
check('quebra do score com "sem dado"', await drawer.getByText('sem dado').first().isVisible());
await shot('oferta-detalhe');
await drawer.getByRole('button', { name: 'Aprovar' }).click();
await page.getByRole('dialog', { name: 'Aprovar oferta' }).getByRole('button', { name: 'Aprovar' }).click();
await page.getByText('Oferta aprovada').waitFor();
check('aprovar (mutação com CSRF) funciona', true);
await page.keyboard.press('Escape');
// Publicar oferta sem link validado → botão desabilitado com explicação; via API o 409 é explicado
const row3 = page.locator('tr', { hasText: 'Air Fryer Simulada' });
check('sem botão Publicar para oferta sem link validado', (await row3.getByRole('button', { name: 'Publicar' }).count()) === 0);
await row3.getByRole('button', { name: 'Detalhes' }).click();
const d3 = page.getByRole('dialog');
await d3.getByText('Publicar indisponível:').waitFor();
check('detalhe explica por que não pode publicar', await d3.getByRole('button', { name: 'Publicar' }).isDisabled());
await page.keyboard.press('Escape');
// Oferta o1 já APROVADA com link: publicar abre confirmação e cria publicação manual
await page.locator('tr', { hasText: 'Smartphone Simulado 128GB' }).getByRole('button', { name: 'Publicar' }).click();
const dlg = page.getByRole('dialog', { name: 'Publicar oferta' });
await dlg.getByText('Canal', { exact: true }).waitFor();
await dlg.getByRole('button', { name: 'Publicar' }).click();
await page.getByText(/publicação\(ões\) criada\(s\)/).waitFor();
check('publicar cria publicação (toast)', true);

console.log('# Afiliados');
await page.goto(`${BASE}/afiliados`);
await page.getByText('Não existe API oficial para gerar links de afiliado; use importação em lote.').waitFor();
check('geração indisponível com motivo', true);
check('badge Indisponível', await page.getByText('Indisponível', { exact: true }).first().isVisible());
await shot('afiliados');
await page.getByRole('tab', { name: 'Importar em lote' }).click();
await page.getByLabel('Linhas para importar').fill('MLB1 ; https://meli.la/a\nMLB2 ; https://evil.example/x');
await page.getByRole('button', { name: 'Importar', exact: true }).click();
await page.getByText('Resultado da importação').waitFor();
check('resultado detalhado da importação', await page.getByText('Host não permitido: evil.example').isVisible());
await shot('afiliados-import');
await page.getByRole('tab', { name: /Pendentes/ }).click();
check('link de exportação CSV', (await page.locator('a[href="/api/affiliate/pending.csv"]').count()) === 1);
await page.getByRole('button', { name: 'Adicionar link' }).first().click();
const addDlg = page.getByRole('dialog', { name: 'Adicionar link de afiliado' });
await addDlg.getByLabel('URL de afiliado').fill('https://meli.la/novo');
await addDlg.getByRole('button', { name: 'Cadastrar e validar' }).click();
await page.getByText('Link cadastrado e validado').first().waitFor();
check('adicionar link de afiliado para produto pendente', true);

console.log('# Publicações');
await page.goto(`${BASE}/publicacoes`);
await page.getByText('Smartphone Simulado 128GB').first().waitFor();
check('aba Enviadas lista SENT', await page.getByText('Enviada (confirmada)').first().isVisible());
await page.getByRole('tab', { name: /Fila manual/ }).click();
await page.getByText('Texto pronto para publicar').waitFor();
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
await page.getByRole('button', { name: 'Copiar', exact: true }).click();
await page.getByText('Texto copiado').first().waitFor();
const clip = await page.evaluate(() => navigator.clipboard.readText());
check('Copiar coloca o texto pronto na área de transferência', clip.includes('Smartphone Simulado 128GB') && clip.includes('Link de afiliado'));
check('botão Baixar imagem', await page.getByRole('button', { name: 'Baixar imagem' }).isVisible());
await shot('fila-manual');
await page.getByRole('button', { name: 'Marcar como publicada' }).first().click();
await page.getByRole('dialog', { name: 'Marcar como publicada' }).getByRole('button', { name: 'Sim, já publiquei' }).click();
await page.getByText('Marcada como publicada').waitFor();
check('marcar como publicada (confirmação)', true);
await page.getByRole('tab', { name: 'Falhas' }).click();
await page.getByText('HTTP 401 Unauthorized').first().waitFor();
await page.getByRole('button', { name: 'Detalhes' }).first().click();
await page.getByRole('dialog').getByRole('heading', { name: 'Tentativas de envio' }).waitFor();
check('detalhe com tentativas', true);
await page.keyboard.press('Escape');

console.log('# Automação');
await page.goto(`${BASE}/automacao`);
await page.getByText('Controles principais').waitFor();
await page.getByRole('switch', { name: 'Publicação automática' }).click();
const conf = page.getByRole('dialog', { name: 'Ligar a publicação automática?' });
await conf.waitFor();
check('confirmação ao ligar publicação automática', true);
await conf.getByRole('button', { name: 'Ligar publicação automática' }).click();
await page.getByText('Publicação automática ligada').first().waitFor();
const st = await (await fetch('http://127.0.0.1:4010/__sim/state')).json();
check('PUT /settings enviado só com o campo alterado e aplicado', st.settings.publishing.autoPublish === true);
check('nenhuma falha de CSRF', st.csrfFailures === 0);
check('soma dos pesos exibida', await page.getByText('Soma: 100').isVisible());
await page.getByLabel('Máximo por hora').fill('3');
await page.getByText('Alterações não salvas').waitFor();
await page.getByRole('button', { name: 'Salvar alterações' }).click();
await page.getByText('Configurações salvas').first().waitFor();
check('salvar alterações', true);
await page.getByLabel('Limiar “Excelente”').fill('95');
check('validação de limiares', await page.getByText('Deve ser menor que “Excepcional”.').isVisible());
check('salvar desabilitado com erro', await page.getByRole('button', { name: 'Salvar alterações' }).isDisabled());
await shot('automacao');
await page.getByRole('button', { name: 'Descartar alterações' }).click();
await page.locator('tr', { hasText: 'Casa (SIM)' }).getByRole('button', { name: 'Editar' }).click();
const catDlg = page.getByRole('dialog');
await catDlg.getByLabel('IDs de categoria do Mercado Livre').fill('ABC');
check('validação de ID de categoria (MLB…)', await catDlg.getByText('Use o formato MLB seguido de números').isVisible());
await catDlg.getByLabel('IDs de categoria do Mercado Livre').fill('mlb123');
await catDlg.getByRole('button', { name: 'Salvar' }).click();
await page.getByText('Categoria atualizada').first().waitFor();
await page.getByRole('switch', { name: 'Ativar categoria Casa (SIM)' }).click();
await page.getByText('Categoria “Casa (SIM)” ativada').waitFor();
check('editar e ativar categoria individualmente', true);
await page.getByRole('button', { name: 'Executar busca agora' }).click();
await page.getByText('Busca enfileirada').waitFor();
check('executar busca agora', true);

console.log('# Integrações');
await page.goto(`${BASE}/integracoes`);
await page.getByText('Modos de publicação').waitFor();
check('explicação dos modos A/B/C', (await page.getByText(/^Modo [ABC] —/).count()) >= 3);
await page.getByRole('button', { name: 'Testar conexão' }).nth(1).click();
await page.getByText('Token rejeitado (resposta SIMULADA)').waitFor();
check('resultado do teste de conexão exibido', true);
await shot('integracoes');
await page.locator('section, div.rounded-xl', { hasText: 'Webhook' }).getByRole('button', { name: 'Adicionar canal' }).last().click();
const chDlg = page.getByRole('dialog');
await chDlg.getByLabel('Nome do canal').fill('Webhook n8n (SIM)');
await chDlg.getByLabel('URL do webhook (https)').fill('http://inseguro.example');
check('webhook exige https', await chDlg.getByText('Use uma URL https.').isVisible());
await chDlg.getByLabel('URL do webhook (https)').fill('https://hooks.example/x');
await chDlg.getByRole('button', { name: 'Criar canal' }).click();
await page.getByText('Canal criado').first().waitFor();
check('criar canal (Webhook)', await page.getByText('Webhook n8n (SIM)').first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
await page.getByRole('button', { name: 'Nova credencial…' }).last().click();
const cdlg = page.getByRole('dialog');
check('campo de segredo é password (write-only)', (await cdlg.locator('input[type="password"]').count()) >= 1);
await cdlg.getByLabel('Nome da credencial').fill('bot-teste');
await cdlg.getByLabel('Token do bot (do @BotFather)').fill('123456:SEGREDO-SIMULADO-XYZ');
await cdlg.getByRole('button', { name: 'Salvar credencial' }).click();
await page.getByText('Credencial salva').first().waitFor();
const html = await page.content();
check('segredo não fica no DOM depois de salvo', !html.includes('SEGREDO-SIMULADO-XYZ'));

console.log('# Configurações');
await page.goto(`${BASE}/configuracoes?tab=conta`);
await page.getByRole('heading', { name: 'Trocar senha' }).waitFor();
await page.getByLabel('Senha atual').fill('senha-simulada-123');
await page.getByLabel(/^Nova senha/).fill('curta');
check('política de senha no cliente', await page.getByText('Use ao menos 12 caracteres.').isVisible());
await page.getByLabel(/^Nova senha/).fill('outra-senha-bem-longa-1');
await page.getByLabel('Confirmar nova senha').fill('outra-senha-bem-longa-1');
await page.getByRole('button', { name: 'Alterar senha' }).click();
await page.getByText('Senha alterada').first().waitFor();
check('troca de senha', true);
await page.getByRole('tab', { name: 'Logs' }).click();
await page.getByText('Falha ao enviar (simulado)').waitFor();
check('logs listados', true);
await page.getByRole('tab', { name: 'Auditoria' }).click();
await page.getByText('settings.update').waitFor();
check('auditoria listada', true);
await page.getByRole('tab', { name: 'Mensagens' }).click();
await page.getByLabel('Divulgação (rodapé da mensagem)').waitFor();
await page.getByRole('tab', { name: 'Variáveis operacionais' }).click();
check('variáveis operacionais somente leitura', await page.getByText('Somente leitura').first().isVisible());
await shot('configuracoes');

console.log('# Mobile (375px)');
await page.setViewportSize({ width: 375, height: 800 });
for (const p of ['/', '/ofertas', '/afiliados', '/publicacoes', '/automacao', '/integracoes', '/configuracoes']) {
  await page.goto(`${BASE}${p}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  check(`sem rolagem horizontal da página em ${p}`, !(await hasHScroll()));
}
await page.goto(`${BASE}/`);
check('menu lateral oculto no mobile', !(await page.locator('#menu-lateral').isVisible()));
await page.getByRole('button', { name: 'Abrir menu' }).click();
check('hambúrguer abre o menu', await page.locator('#menu-lateral').isVisible());
await shot('mobile-menu');
await page.getByRole('link', { name: 'Ofertas' }).click();
await page.waitForURL(`${BASE}/ofertas`);
await page.locator('#menu-lateral').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
check('navegar fecha o menu', !(await page.locator('#menu-lateral').isVisible()));

console.log('# Modo escuro');
const dark = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', locale: 'pt-BR' });
const dp = await dark.newPage();
await dp.goto(`${BASE}/login`);
await dp.getByLabel('E-mail').fill('admin@sim.local');
await dp.getByLabel('Senha').fill('outra-senha-bem-longa-1');
await dp.getByRole('button', { name: 'Entrar' }).click();
await dp.waitForURL(`${BASE}/`);
await dp.getByText('Ofertas descobertas', { exact: true }).waitFor();
const bg = await dp.evaluate(() => getComputedStyle(document.body).backgroundColor);
check('tema escuro aplicado (prefers-color-scheme)', bg === 'rgb(9, 13, 22)', bg);
await dp.screenshot({ path: path.join(OUT, 'dashboard-dark.png'), fullPage: true });

console.log('# Sessão expirada');
await ctx.clearCookies();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/ofertas`);
await page.waitForURL(/\/login/, { timeout: 15000 });
check('401 em qualquer tela volta ao login', true);

const relevant = consoleErrors.filter((e) => !/Failed to load resource.*(401|mlstatic|ERR_)/i.test(e) && !/mlstatic/i.test(e));
check('sem erros de console/CSP inesperados', relevant.length === 0, JSON.stringify(relevant.slice(0, 5)));

await browser.close();
console.log(`\n${passed} verificações ok, ${failures.length} falhas`);
if (failures.length) { console.log('Falhas:', failures.join(' | ')); process.exit(1); }
