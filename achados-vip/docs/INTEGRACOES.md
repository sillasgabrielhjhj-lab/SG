# Manual de integrações

Como conectar o Achados VIP ao Mercado Livre, ao Programa de Afiliados, ao WhatsApp, ao Telegram e a um webhook, **o que você precisa fornecer** e **onde cadastrar cada coisa**.

> **Honestidade sobre o que foi testado.** Quando este manual foi escrito, o ambiente de desenvolvimento não tinha acesso ao Mercado Livre, ao Telegram nem à Meta. Os passos *dentro dos sites dessas empresas* (nomes de menus, telas, campos, limites) vêm da documentação pública e da pesquisa de [`VIABILIDADE.md`](VIABILIDADE.md) e **podem ter mudado** — confirme na documentação oficial vigente. Os passos *no Achados VIP* foram exercitados apenas com servidores **simulados** (veja [`TESTES.md`](TESTES.md)). Os botões **Testar conexão** do painel são a forma de confirmar, com as suas credenciais, que cada integração realmente funciona.

## 1. Escolha o modo de publicação

| Modo | Canal no painel | Automático? | Quando usar |
|---|---|---|---|
| **B — Fila manual** | `WHATSAPP_MANUAL_QUEUE` ("Fila manual") | Não: o sistema entrega texto + imagem prontos; você publica e marca | **Funciona hoje, sem credenciais.** É o caminho para o seu grupo atual do WhatsApp. |
| **C — Telegram** | `TELEGRAM` | Sim | Audiência grande com automação total (canal ilimitado de inscritos). |
| **C — Webhook** | `WEBHOOK` | Sim | Integrar com n8n, Make, Zapier ou serviço seu (JSON assinado com HMAC). |
| **A — WhatsApp Groups API** | `WHATSAPP_CLOUD_GROUP` | Sim, com restrições | Só grupos **criados pela API**, **até 8 participantes**, entrada por link de convite. Não serve para migrar um grupo grande existente. |

O WhatsApp Web não oficial (Baileys/whatsapp-web.js) **não é usado**: viola os termos e pode banir o número.

## 2. Credenciais: lista exata e onde cadastrar

Cadastro no painel: **Integrações**. Segredos entram por **credenciais** (somente escrita: são criptografados com AES-256-GCM e nunca voltam ao navegador). Dados não sensíveis entram na **configuração do canal**. Para trocar um segredo, salve novamente a credencial com o **mesmo nome**.

| Integração | O que fornecer | Tipo | Onde cadastrar | Obrigatório? |
|---|---|---|---|---|
| **Mercado Livre — busca** | **App ID** (`client_id`) | credencial `mercadolivre`, campo `clientId` (ou `ML_CLIENT_ID` no `infra/.env`) | Integrações → credenciais | Para a fonte `mercadolivre_api` |
| | **Chave secreta** (`client_secret`) | credencial `mercadolivre`, campo `clientSecret` (ou `ML_CLIENT_SECRET`) | idem | idem |
| | **Refresh token** | `ML_REFRESH_TOKEN` no `infra/.env` (obtido com `ml-oauth.sh`) — o painel só pede App ID e Chave secreta | `infra/.env` | idem (ver seção 3.5) |
| **Afiliados ML** | **Nada a cadastrar.** Você gera os links no portal oficial e os importa | — | Afiliados → Importar links em lote | Para publicar qualquer oferta |
| **Telegram** | **Token do bot** (do @BotFather) | credencial `telegram`, campo `botToken` | Integrações → credenciais | Para o canal Telegram |
| | **Chat ID ou @canal** | configuração do canal, campo `chatId` | Integrações → novo canal Telegram | idem |
| **Webhook** | **URL https** do receptor | configuração do canal, campo `url` | Integrações → novo canal Webhook | Para o canal Webhook |
| | **Segredo de assinatura HMAC** | credencial `webhook`, campo `secret` | Integrações → credenciais | idem |
| **WhatsApp Groups API** | **Token de acesso permanente** (usuário do sistema da Meta) | credencial `whatsapp_cloud`, campo `accessToken` | Integrações → credenciais | Para o canal Groups API |
| | **Phone Number ID** | configuração do canal, campo `phoneNumberId` | Integrações → novo canal WhatsApp (Groups API) | idem |
| | **ID do grupo** (`groupId`, do grupo criado pela API) | configuração do canal | idem | idem |
| **Fila manual** | Nada | — | Já criada pelo seed (habilitada) | — |

Nunca envie esses valores por e-mail/chat e nunca os coloque em arquivos versionados. Se um segredo vazar, **revogue-o no provedor** e cadastre outro (veja "Rotação de segredos" em [`DEPLOY.md`](DEPLOY.md)).

Ordem sugerida no painel para cada canal: **Nova credencial** → **Novo canal** (tipo, nome, configuração, credencial; ele nasce **desativado** se você não marcar "ativo") → **Testar conexão** → só com resultado "Conectado", **ative** o canal. O selo "Conectado" só aparece após um teste real bem-sucedido.

---

## 3. Mercado Livre (busca de ofertas)

A fonte `mercadolivre_api` consulta a API oficial com OAuth 2.0 do **seu** app. O adaptador trata 401 (autenticação necessária), 403 (bloqueio/escopo) e 429 (limite de taxa, respeitando `Retry-After`). Se a busca pública continuar bloqueada para o seu app, o painel mostra o motivo — não há contorno (nada de scraping, sessão roubada ou CAPTCHA).

### 3.1 Criar o app no DevCenter

1. Entre com a sua conta do Mercado Livre em **https://developers.mercadolivre.com.br** (DevCenter) e aceite os termos de desenvolvedor.
2. Abra **Minhas aplicações → Criar nova aplicação** (os nomes dos menus podem variar).
3. Preencha nome, descrição curta e a **Redirect URI** (seção 3.2). Marque as permissões da seção 3.3.
4. Salve. Anote o **App ID** (`client_id`) e a **Chave secreta / Secret key** (`client_secret`). A chave secreta é uma senha: guarde em gerenciador de senhas.
5. O ML pode exigir verificação do app ou do desenvolvedor; se a criação ficar pendente, siga as instruções do DevCenter.

### 3.2 Redirect URI

É o endereço para onde o ML devolve o navegador depois que você autoriza, com `?code=...` no final. Regras práticas (confirme no DevCenter):

- Deve ser **idêntica**, caractere por caractere, à cadastrada no app (inclusive `https://` e barra final).
- Use uma URL **https** sua, por exemplo `https://painel.seudominio.com.br/ml/callback`. **Não precisa existir página nesse endereço**: o navegador mostrará "não encontrada" e isso é normal — o que importa é copiar o endereço completo da barra, que contém o `code`.
- O sistema não implementa essa rota de propósito: o token é obtido uma vez, por você, com o script guiado.

### 3.3 Escopos / permissões

O sistema só **lê** anúncios (busca e revalidação de preço/estoque). Marque:

- **Leitura** (`read`) — suficiente para consultar itens.
- **`offline_access`** — permite receber o **refresh token** (sem isso o acesso expira em ~6 horas e não renova).

Não marque permissões de escrita (`write`): o Achados VIP **não** publica, edita nem compra nada no Mercado Livre. Quanto menos permissão, menor o estrago se o token vazar.

### 3.4 Obter o refresh token — fluxo OAuth e script guiado

Fluxo *authorization code* (resumo):

```
você ──(1) abre a URL de autorização──▶ auth.mercadolivre.com.br  (você faz login e clica em "Permitir")
      ◀─(2) redireciona para REDIRECT_URI?code=TG-xxxx&state=...   ← PASSO MANUAL: copiar este endereço
você ──(3) troca o code por tokens──▶ POST api.mercadolibre.com/oauth/token  (client_id, client_secret, code, redirect_uri)
      ◀─(4) access_token (≈6 h) + refresh_token
```

O script `infra/scripts/ml-oauth.sh` conduz esses passos. Rode no seu computador (ou no servidor), com `bash` e `curl`:

```bash
./infra/scripts/ml-oauth.sh              # pergunta App ID, Chave secreta (oculta) e Redirect URI
./infra/scripts/ml-oauth.sh --pkce       # use se o seu app tiver PKCE habilitado
./infra/scripts/ml-oauth.sh --out /tmp/ml.env   # grava ML_REFRESH_TOKEN=... num arquivo 600 em vez de imprimir
```

O que você faz:

1. O script imprime uma **URL de autorização** (com um `state` aleatório). **Abra no navegador**, entre no Mercado Livre e clique em **Permitir**.
2. O navegador vai para a Redirect URI com `?code=TG-...&state=...`. **Passo manual:** copie o **endereço completo** da barra (ou só o valor depois de `code=`) e cole no script. Faça logo — o `code` expira em poucos minutos e só vale uma vez.
3. O script confere o `state`, troca o `code` por tokens (os segredos vão por stdin do `curl`, nunca na linha de comando), confirma o acesso com `GET /users/me` (mostra id e apelido) e imprime `ML_REFRESH_TOKEN=...`. O `access_token` nunca é impresso.

Erros comuns: `invalid_grant` = `code` expirado/já usado ou Redirect URI diferente da cadastrada (rode de novo); `invalid_client` = App ID/Chave secreta errados ou app inativo; resposta sem `refresh_token` = faltou `offline_access` no app.

> O script foi testado apenas contra um servidor **simulado** (nesta fase não havia acesso ao ML real). Na primeira execução real, confira o resultado do **Testar fonte** no painel.

### 3.5 Cadastrar no sistema

1. No `infra/.env` (produção) defina `ML_CLIENT_ID`, `ML_CLIENT_SECRET` e `ML_REFRESH_TOKEN` e rode `./infra/scripts/deploy.sh`. Se o painel oferecer o cadastro dessas credenciais (Integrações → credencial *Mercado Livre*: App ID e Chave secreta), prefira-o para o App ID/Chave secreta: ficam criptografados no banco.
2. No painel, **Integrações → Testar fonte**. Resultado esperado: *Conectado*. *Autenticação necessária* = credencial ausente/expirada; *Erro* traz o detalhe (ex.: HTTP 403).

### 3.6 Expiração, renovação e revogação

- O **access token** vale cerca de 6 horas e deve ser renovado com o refresh token (função do adaptador de fonte). Depois de mais de 6 horas de operação, confira em **Integrações → Testar fonte** que a renovação funcionou.
- Segundo a documentação do ML, o **refresh token é de uso único**: cada renovação devolve um novo e invalida o anterior. Portanto o sistema precisa **guardar o novo token a cada renovação**; se o processo perder o novo token (falha de gravação) ou se você usar o mesmo refresh token em outro lugar (outro script, outro servidor), o token deixa de valer e é preciso rodar o `ml-oauth.sh` de novo. **Não reutilize o mesmo refresh token em dois ambientes** (ex.: desenvolvimento e produção): crie um app/token por ambiente.
- Para revogar: DevCenter → seu app, ou a conta do ML em *Aplicações conectadas*. Depois gere outro token.
- Se `ML_REFRESH_TOKEN` expirar (~6 meses sem uso) ou for revogado, a fonte passa a *Autenticação necessária* e o painel notifica.

### 3.7 Limites e termos

Respeite os limites de taxa do ML (o intervalo de busca padrão é de 10 minutos; reduzir demais pode causar 429), os Termos e Condições do DevCenter e a política de uso da API. O Achados VIP não faz *scraping* nem usa áreas autenticadas do site.

---

## 4. Programa de Afiliados do Mercado Livre (links)

**Não existe API pública oficial para gerar links de afiliado** (pesquisa em [`VIABILIDADE.md`](VIABILIDADE.md)); automatizar o portal com cookies/sessão seria fora de método autorizado e **não foi implementado**. Fluxo adotado:

```
Sistema encontra e qualifica produtos ──▶ lista "aguardando link de afiliado"
        ──▶ você exporta o CSV  ──▶ gera os links no PORTAL OFICIAL  ──▶ importa em lote
        ──▶ o sistema valida cada link  ──▶ só então a oferta pode ser publicada
```

### 4.1 Pré-requisitos

- Ser aceito no **Programa de Afiliados do Mercado Livre** (cadastro e aprovação pelo próprio ML; as regras de elegibilidade são deles). Portal: a área "Afiliados" do Mercado Livre (https://www.mercadolivre.com.br/afiliados — confirme o endereço atual).
- Ler os termos do programa sobre onde e como divulgar links (por exemplo, exigência de indicar que é link de afiliado — o rodapé configurável das mensagens, **Configurações → Mensagens**, já traz "Link de afiliado").

### 4.2 Gerar links no portal oficial

1. No Achados VIP, abra **Afiliados → Produtos aguardando link de afiliado** e clique em **Exportar CSV** (colunas: `id;titulo;url_ml;score`; também em `GET /api/affiliate/pending.csv`).
2. No portal de afiliados, use o **gerador de links** (cole a URL do produto → copie o link gerado, normalmente um link curto `meli.la/...` ou um link do domínio do ML com sua identificação). Se o portal oferecer geração em lote, use; senão gere um a um. Os nomes dos menus mudam — siga as instruções do portal.
3. Monte as linhas no formato abaixo.

### 4.3 Importar em lote

**Afiliados → Importar links em lote** (cole o texto ou carregue um CSV/TXT). Uma linha por produto, separador `;` (também aceitos `,` e TAB):

```
URL_DO_PRODUTO_NO_ML ; URL_DE_AFILIADO
MLB1234567890 ; URL_DE_AFILIADO
```

Exemplos (valores ilustrativos):

```
https://produto.mercadolivre.com.br/MLB-1234567890-fone-bluetooth-_JM ; https://meli.la/1AbCdEf
MLB9876543210 ; https://meli.la/2GhIjKl
```

O resultado mostra: **importados**, **validados**, **inválidos** (linha + motivo) e **sem produto correspondente** (a URL/ID não bate com nenhum produto já descoberto — o produto precisa ter sido encontrado pela busca antes).

### 4.4 O que a validação confere (antes de liberar a publicação)

1. URL **https**, sem usuário/senha embutidos, sem IP literal.
2. Host **permitido** (lista `affiliate.allowedHosts`, padrão: `mercadolivre.com`, `mercadolivre.com.br`, `meli.la` e as variações com `www.`).
3. Se "seguir redirecionamentos" estiver ativo (padrão), o sistema segue o redirecionamento — com proteção contra SSRF (não acessa rede interna, limita saltos) — e confirma que o **destino é o mesmo produto**.

Status: `PENDING` (aguardando/validando), `VALIDATED` (liberado), `INVALID` (com motivo). Só `VALIDATED` permite publicar. Para corrigir, remova o link inválido e importe outro. Links nunca são "gerados" pelo sistema.

---

## 5. WhatsApp

### 5.1 Fila manual (Modo B) — o caminho para o seu grupo atual

Nada a configurar. Com o canal **Fila manual** ativo, cada publicação vira *pronta para publicação manual* com texto formatado para WhatsApp (`*negrito*`, `~riscado~`, `_itálico_`) e imagem. Em **Publicações → Fila manual**: **Copiar** → cole no grupo (e anexe a imagem) → **Marcar como publicada**. O sistema nunca registra "enviada" sozinho para este canal.

### 5.2 Groups API oficial da Meta (Modo A) — restrita

**O que é possível (segundo a pesquisa; confirme na documentação da Meta):** enviar para grupos **criados pela própria API** de um número da WhatsApp Business Platform; máximo de **8 participantes** por grupo; entrada **somente por link de convite**; até 10.000 grupos por número. **Não** envia para o grupo comum que você já tem e **não** migra seus membros. É útil para equipe/testes, não para audiência grande.

**Pré-requisitos**

- Conta no **Meta Business** (Gerenciador de Negócios), com **verificação do negócio** concluída se a Meta exigir.
- Um **app** em https://developers.facebook.com (tipo *Business*) com o produto **WhatsApp**.
- Uma **WhatsApp Business Account (WABA)** e um **número** registrado na Platform. O número não pode estar em uso no aplicativo WhatsApp comum (ele passa a ser da Platform). A documentação da Meta indicava, para a Groups API, conta de negócio oficial/elegível — confirme se a sua conta é elegível.
- Um **usuário do sistema** (Business Settings → Usuários → Usuários do sistema) com o app e a WABA atribuídos e um **token permanente** com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.

**Passos**

1. No app → WhatsApp → *API Setup* (Configuração da API), anote o **Phone Number ID**.
2. Gere o token do usuário do sistema (sem expiração) e guarde-o em segredo.
3. **Crie o grupo pela API** (o formato abaixo segue a documentação consultada — confirme versão da Graph API e campos):

   ```bash
   read -rs WA_TOKEN                    # cole o token; não aparece na tela
   curl -sS -X POST "https://graph.facebook.com/<VERSAO>/<PHONE_NUMBER_ID>/groups" \
     -H "Authorization: Bearer $WA_TOKEN" -H "Content-Type: application/json" \
     -d '{"messaging_product":"whatsapp","subject":"ACHADOS VIP (teste)"}'
   ```

   A resposta traz o **`group_id`** e o **link de convite**. Compartilhe o link com no máximo 8 pessoas.
4. No painel: **Nova credencial** → provedor *WhatsApp Business Platform* → cole o token. **Novo canal** → *WhatsApp Groups API* → `phoneNumberId` e `groupId` → selecione a credencial → **Testar conexão** → ative.

**Limitações a ter em mente:** mensagens comerciais seguem as políticas da Meta (consentimento dos participantes, conteúdo permitido); pode haver cobrança por conversa/mensagem; o limite de 8 participantes inviabiliza uma audiência grande. A integração é "**a validar**" com as suas credenciais — o adaptador existe e foi testado só com um servidor simulado.

---

## 6. Telegram (Modo C)

1. **Criar o bot:** no Telegram, converse com **@BotFather** → `/newbot` → escolha nome e um *username* terminado em `bot`. Ele devolve o **token** (`123456789:AA...`). Isso é uma senha; se vazar, use `/revoke` no BotFather.
2. **Criar o canal:** Menu → *Novo canal* → nome (ex.: "ACHADOS VIP") → **público** (link `t.me/seucanal`) ou **privado**.
3. **Adicionar o bot como administrador do canal:** Canal → Informações → *Administradores* → *Adicionar administrador* → procure o bot → deixe **apenas "Publicar mensagens"** → Salvar. Sem ser administrador, o bot não consegue postar.
4. **Descobrir o `chat_id`:**
   - Canal **público**: use `@usernamedocanal` (com arroba).
   - Canal **privado**: publique qualquer mensagem no canal e, no seu computador, consulte as atualizações do bot (o token aparece no comando; faça num ambiente seu e limpe o histórico):

     ```bash
     read -rs TG_TOKEN
     curl -sS "https://api.telegram.org/bot${TG_TOKEN}/getUpdates"
     ```

     Procure `"channel_post":{..."chat":{"id":-100XXXXXXXXXX` — esse número (com o `-100`) é o `chat_id`. Se vier vazio, publique de novo no canal e repita. (Não funciona se o bot tiver um webhook configurado.)
5. No painel: **Nova credencial** → *Telegram Bot* → cole o token. **Novo canal** → *Telegram* → `chatId` (`@canal` ou `-100...`) → credencial → **Testar conexão** → ative.

**Limites e boas práticas:** cerca de 20 mensagens por minuto por grupo/canal (o anti-spam padrão é muito mais conservador); legenda de foto até 1024 caracteres (o formatador de mensagens respeita esse limite); mensagens em HTML com `& < >` escapados. Confirme que a divulgação de links de afiliado do ML no canal está de acordo com os termos do programa. Telegram é automação oficial (Bot API) — Modo C.

---

## 7. Webhook assinado (HMAC)

O canal *Webhook* envia um `POST` com JSON para a sua URL **https**. Serve para ligar o Achados VIP a n8n, Make, Zapier ou a um serviço seu que publica onde a automação é permitida.

**Cadastro:** credencial *Webhook* (campo `secret`: um segredo seu, gere com `openssl rand -base64 32`) + canal Webhook com a `url`.

**Conteúdo (campos mínimos):** `text` (mensagem já formatada), `imageUrl` (ou nulo) e `idempotencyKey` (`<offerId>:<channelId>`). Use `idempotencyKey` no receptor para **ignorar repetições** (reentregas podem ocorrer após falhas de rede).

**Assinatura:** HMAC-SHA256, em hexadecimal, calculado sobre o **corpo bruto** da requisição (bytes exatos recebidos — não reserialize o JSON) com o seu segredo. O receptor deve recalcular e comparar em **tempo constante**.

> **Conferir antes de usar:** o nome do cabeçalho que carrega a assinatura (e o eventual prefixo `sha256=`) é definido pelo adaptador (`apps/api/src/adapters/publishers/webhook.ts`). Nos exemplos abaixo usamos `X-Achados-Signature` como nome **provisório**; ajuste conforme o código/Swagger.

Node.js (Express/Fastify — leia o corpo bruto):

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

export function assinaturaValida(rawBody /* Buffer */, cabecalho /* string */, segredo) {
  const esperado = createHmac('sha256', segredo).update(rawBody).digest('hex');
  const recebido = (cabecalho || '').replace(/^sha256=/, '');
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Python:

```python
import hmac, hashlib

def assinatura_valida(raw_body: bytes, cabecalho: str, segredo: str) -> bool:
    esperado = hmac.new(segredo.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, cabecalho.removeprefix("sha256="))
```

Linha de comando (para conferir manualmente um corpo salvo em `corpo.json`):

```bash
openssl dgst -sha256 -hmac "$SEGREDO" -hex corpo.json
```

**n8n / Make:** crie um *Webhook* (método POST, só https), valide a assinatura em um nó de código antes de agir e responda **2xx rapidamente**. O sistema só registra "enviada" quando o canal **confirma** o recebimento; respostas fora de 2xx devem ser tratadas como falha (e podem gerar nova tentativa), por isso deduplique por `idempotencyKey`.

---

## 8. Limitações externas e termos (resumo)

- **Mercado Livre:** a disponibilidade e as regras da API (inclusive 403 sem token ou com app bloqueado) são decididas pelo ML. `original_price` é só "anunciado": o sistema só exibe "De/Por" com referência **verificada** pelo histórico próprio. Cupom, parcelamento, relâmpago e "mais vendidos" só aparecem se a API devolver o dado.
- **Afiliados:** sem API de geração de links; sem métricas de cliques/vendas/comissões (o painel indica "indisponível"). Siga os termos do programa.
- **WhatsApp:** Cloud API comum não envia a grupos comuns; Groups API restrita (≤ 8 participantes, grupos criados pela API, convite por link). Políticas de conteúdo e cobrança da Meta se aplicam.
- **Telegram:** limites de taxa da Bot API; o bot precisa ser administrador do canal.
- **Você é responsável** pelo conteúdo divulgado, pela conformidade com os termos de cada plataforma e pela LGPD no tratamento de dados de participantes.

## 9. Solução de problemas por status

| Selo no painel | Significado | O que fazer |
|---|---|---|
| **Não configurado** | Sem credencial/config | Cadastre conforme a seção correspondente |
| **Autenticação necessária** | Token ausente, expirado ou revogado | ML: rode `ml-oauth.sh` de novo; Telegram: confira o token; WhatsApp: gere novo token do usuário do sistema |
| **Erro** | Falha na chamada (detalhe no painel e em **Configurações → Logs**) | 403 = bloqueio/escopo; 429 = limite de taxa; 400/404 de chat = `chatId` errado ou bot sem permissão |
| **Conectado** | Último **teste real** funcionou | Ainda assim acompanhe as publicações: "Enviada" exige confirmação do canal |
