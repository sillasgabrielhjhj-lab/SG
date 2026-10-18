# Deploy em produção (VPS Ubuntu + Docker Compose)

Guia para colocar o Achados VIP no ar em um servidor Ubuntu 22.04/24.04 LTS, com HTTPS automático, banco e filas internos, backup diário e verificação pós-deploy.

> **O que foi e o que não foi testado.** Os arquivos de infraestrutura foram validados **sem Docker daemon** (o ambiente de desenvolvimento não o executava): `docker compose config` e a sintaxe dos scripts passaram; o `Caddyfile` foi validado e exercitado com um binário real do Caddy (roteamento, cabeçalhos, redirecionamento HTTP→HTTPS com certificado interno, redação de cookies nos logs); os scripts de backup/restauração/verificação rodaram contra um PostgreSQL 16 local; o `smoke.sh` rodou contra a API compilada. **As imagens Docker (`docker build`) e o `docker compose up` completo não foram executados** — o primeiro deploy no seu servidor é, na prática, o primeiro teste real da pilha Docker. Por isso há um checklist e o `smoke.sh`. Veja "O que não foi possível testar" em [`TESTES.md`](TESTES.md).

## 1. Visão da pilha

| Serviço | Imagem | Função | Rede | Porta publicada |
|---|---|---|---|---|
| `caddy` | `caddy:2-alpine` | HTTPS (Let's Encrypt), proxy reverso, cabeçalhos de segurança | edge | **80, 443 (tcp), 443 (udp)** |
| `web` | build local (`apps/web`) | painel Next.js | edge | nenhuma |
| `api` | build local (`apps/api`) | API Fastify | edge + data | nenhuma |
| `worker` | mesma imagem da `api` | filas BullMQ (busca, publicação, manutenção) | data + outbound | nenhuma |
| `migrate` | alvo `tools` da imagem da API | `prisma migrate deploy` + seed idempotente (one-shot) | data | nenhuma |
| `postgres` | `postgres:16-alpine` | banco (volume `pgdata`) | **data (interna)** | **nenhuma** |
| `redis` | `redis:7-alpine` | filas (AOF + senha, `noeviction`) | **data (interna)** | **nenhuma** |
| `backup` | build local (`infra/backup`) | `pg_dump` diário comprimido, retenção, criptografia opcional | data + outbound | nenhuma |

Redes: `edge` (caddy/web/api), `data` (**interna**, sem acesso à internet: postgres, redis, api, worker, migrate, backup) e `outbound` (somente worker e backup, para sair à internet). Todos os serviços têm `restart: unless-stopped`, healthchecks, limite de memória e logs com rotação (10 MB × 5). `api`, `worker` e `web` rodam com sistema de arquivos somente leitura, sem *capabilities* extras e `no-new-privileges`.

Tamanho sugerido da VPS: 2 vCPU / 4 GB RAM / 40 GB de disco (mínimo viável: 1 vCPU / 2 GB + swap). A soma dos limites de memória dos serviços é ~3 GB (o uso real costuma ser bem menor); em servidores de 2 GB, crie swap (seção 2.6).

## 2. Preparar o servidor

### 2.1 Acesso e usuário

```bash
ssh root@IP_DO_SERVIDOR
adduser deploy && usermod -aG sudo deploy         # use uma senha forte
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
```

Em outro terminal teste `ssh deploy@IP_DO_SERVIDOR`. Depois, endureça o SSH (`/etc/ssh/sshd_config`): `PermitRootLogin no`, `PasswordAuthentication no` (somente chaves). `sudo systemctl restart ssh`. **Não feche a sessão atual antes de confirmar que a nova funciona.**

### 2.2 Atualizações automáticas de segurança e horário

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install unattended-upgrades fail2ban curl git ca-certificates
sudo dpkg-reconfigure -plow unattended-upgrades
timedatectl status            # "System clock synchronized: yes" (necessário para TLS/ACME)
```

### 2.3 Docker Engine e Compose v2 (repositório oficial)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker deploy        # saia e entre de novo para valer
docker compose version                # precisa ser v2.20 ou superior
```

(Confirme os passos na página oficial "Install Docker Engine on Ubuntu"; eles mudam de vez em quando.)

### 2.4 DNS

No provedor do seu domínio crie um registro **A** (e **AAAA**, se o servidor tiver IPv6) de `painel.seudominio.com.br` para o IP do servidor. Confirme a propagação **antes** do primeiro deploy (o Let's Encrypt precisa enxergar o domínio):

```bash
dig +short painel.seudominio.com.br        # deve mostrar o IP do servidor
```

Sem domínio não há HTTPS válido — o Caddy exige um nome. Para testes locais use `DOMAIN=localhost` (certificado interno, não confiável).

### 2.5 Firewall (ufw)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp          # desafio HTTP do Let's Encrypt e redirecionamento para HTTPS
sudo ufw allow 443/tcp
sudo ufw allow 443/udp         # HTTP/3
sudo ufw enable
sudo ufw status verbose
```

> **Atenção (Docker × ufw):** o Docker publica portas diretamente no iptables e **ignora** as regras do ufw para elas. Por isso a pilha só publica `80/443` (Caddy) e **PostgreSQL e Redis não têm `ports:`** — mantenha assim. Nunca adicione `ports: "5432:5432"` ou `"6379:6379"`. Para conferir de fora: `nmap -Pn IP_DO_SERVIDOR` deve mostrar só 22, 80 e 443 (o `smoke.sh` também confere que postgres/redis não publicam portas).

### 2.6 Swap (servidores com 2 GB)

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Instalar a aplicação

```bash
sudo mkdir -p /opt/achados-vip && sudo chown deploy:deploy /opt/achados-vip
git clone <URL_DO_SEU_REPOSITORIO> /opt/achados-vip      # repositório privado: use uma deploy key somente leitura
cd /opt/achados-vip
```

> Todos os comandos deste guia assumem que você está na **pasta do projeto: a que contém `apps/`, `infra/` e `docs/`**. Se o seu repositório guarda o projeto numa subpasta (ex.: `achados-vip/`), entre nela (`cd /opt/achados-vip/achados-vip`) e use essa pasta nos caminhos de cron e de `cd` abaixo.

### 3.1 Configurar o `infra/.env`

```bash
cp infra/.env.example infra/.env
./infra/scripts/generate-secrets.sh --fill       # preenche só os segredos vazios (senhas, chaves)
nano infra/.env                                  # ajuste DOMAIN e ACME_EMAIL (e revise o resto)
chmod 600 infra/.env
```

O que cada variável faz está comentado no próprio [`infra/.env.example`](../infra/.env.example). Pontos críticos:

- `APP_ENCRYPTION_KEY` — criptografa as credenciais salvas no painel. **Sem ela, as credenciais são irrecuperáveis.**
- `BACKUP_PASSPHRASE` (ou `BACKUP_AGE_RECIPIENT`) — sem ela os backups cifrados não abrem.
- **Guarde uma cópia do `infra/.env` em um gerenciador de senhas, fora do servidor.** O backup do banco *não* inclui o `.env`.
- `docker compose config` imprime os segredos; não cole a saída em chats/tickets.

### 3.2 Deploy

```bash
./infra/scripts/deploy.sh
```

O que o script faz: valida o `.env` (domínio de exemplo, formato das chaves, senhas URL-safe) → valida o `docker-compose.yml` → avisa se o DNS ainda não resolve → faz backup (se já havia instalação) → marca as imagens atuais como `:previous` → `docker compose build --pull` → `docker compose up -d` (o serviço **`migrate`** aplica as migrations e o seed ANTES de a API e o worker subirem; se falhar, nada sobe) → espera todos ficarem saudáveis (até 4 min).

A primeira construção leva alguns minutos. Se algo falhar: `./infra/scripts/deploy.sh logs migrate` (ou `api`, `worker`, `web`, `caddy`).

### 3.3 Criar o administrador

```bash
./infra/scripts/deploy.sh admin        # pergunta e-mail e senha (mín. 12 caracteres; a senha não aparece)
```

Para redefinir a senha depois, rode o mesmo comando com o mesmo e-mail (todas as sessões são encerradas).

### 3.4 Verificar

```bash
./infra/scripts/smoke.sh                                   # usa https://<DOMAIN do .env>
SMOKE_EMAIL=voce@exemplo.com SMOKE_PASSWORD='...' ./infra/scripts/smoke.sh   # inclui o fluxo de login/CSRF/logout
```

O `smoke.sh` confere: `/health`, HSTS, redirecionamento 80→443, validade do certificado, API protegida (401 sem sessão), `/docs` protegido em produção, painel no ar, cookies `HttpOnly/SameSite=Strict/Secure`, CSRF ativo, estado dos contêineres, migrations, `/ready` por dentro e **postgres/redis sem porta publicada**. Termina com código ≠ 0 se algo falhar. Depois abra `https://SEU_DOMINIO`, entre e siga "Primeiros passos" no [`README`](../README.md).

## 4. Atualizar

```bash
cd /opt/achados-vip
./infra/scripts/deploy.sh update        # git pull --ff-only + backup + build + migrate + up + espera saúde
./infra/scripts/smoke.sh
```

- O deploy faz um **backup antes** de mexer (use `--skip-backup` só se souber o que faz).
- Há uma breve indisponibilidade (segundos) enquanto os contêineres são recriados.
- Leia o `git log` antes: migrations novas são aplicadas automaticamente pelo serviço `migrate` (forward-only; cada uma roda em transação).
- **Rollback de código:** `./infra/scripts/deploy.sh rollback` volta às imagens `:previous`. **As migrations não são desfeitas.** Se a versão nova alterou o schema de forma incompatível, restaure também o banco do backup pré-deploy (seção 6.4) — ou, melhor, corrija para frente com um novo deploy.
- Limpeza de imagens antigas: `docker image prune -f` (não use `docker system prune -a`: apaga o `:previous`).

## 5. Operação diária

| Quero... | Comando (na pasta do projeto) |
|---|---|
| Ver o estado dos serviços | `./infra/scripts/deploy.sh status` |
| Acompanhar logs | `./infra/scripts/deploy.sh logs api` (ou `worker`, `web`, `caddy`, `postgres`, `redis`, `backup`) |
| Reiniciar um serviço | `docker compose -f infra/docker-compose.yml restart worker` |
| Parar tudo (dados mantidos) | `./infra/scripts/deploy.sh down` |
| Ver uso de disco | `df -h /` e `docker system df` |

## 6. Backup e restauração

### 6.1 Como funciona

O serviço `backup` roda todo dia às `BACKUP_TIME` (padrão 03:30, fuso `TZ`) e também uma vez ao iniciar se não houver backup nas últimas 24 h: `pg_dump` em formato *custom* (já comprimido) → validação do arquivo (`pg_restore --list`) → criptografia opcional → SHA-256 → apaga o que for mais antigo que `BACKUP_RETENTION_DAYS` (padrão 14; só depois de um backup novo e válido existir) → marca sucesso. Arquivos: `achados-AAAAMMDDTHHMMSSZ.dump` (+ `.enc` ou `.age` se cifrado) e `.sha256`.

- **Criptografia por senha** (`BACKUP_PASSPHRASE`): `openssl enc -aes-256-cbc -pbkdf2 -iter 600000`. Protege a confidencialidade; a integridade é conferida pelo SHA-256 (que não impede adulteração por quem altere arquivo e hash juntos).
- **Criptografia por chave pública** (`BACKUP_AGE_RECIPIENT`, recomendada se possível): o servidor só tem a chave **pública**; a chave privada (`age-keygen -o chave.txt`) fica com você, fora do servidor. Cifra autenticada.
- Sem nenhuma das duas, o backup fica **em claro** (o script avisa em todo backup). O banco contém e-mails, hashes de senha e credenciais criptografadas pelo `APP_ENCRYPTION_KEY`.
- O Redis **não** entra no backup: o PostgreSQL é a fonte da verdade (idempotência, agendas e histórico); as filas se reconstroem na subida do worker.

Backup manual agora: `./infra/scripts/backup.sh`. Listar: `./infra/scripts/restore.sh`.

### 6.2 Copiar para fora do servidor (obrigatório!)

Backup só no mesmo disco da VPS não protege contra perda do servidor. Duas formas:

**a) Pasta no host + rsync/rclone.** No `infra/.env`: `BACKUP_PATH=/var/backups/achados`, e antes de subir:

```bash
sudo mkdir -p /var/backups/achados && sudo chown 70:70 /var/backups/achados    # UID do usuário postgres no contêiner
```

Depois, de um cron do **root** (os arquivos são do UID 70, modo 600):

```bash
# /etc/cron.d/achados-offsite  — copia para outro servidor (ssh) às 05:10
10 5 * * * root rsync -a --chmod=F600 /var/backups/achados/ backup@OUTRO_SERVIDOR:/srv/achados-backups/
# ou, com rclone configurado (S3, Backblaze B2, Google Drive...):
# 10 5 * * * root rclone copy /var/backups/achados remoto:achados-vip --include "achados-*"
```

**b) Puxar do volume Docker** (sem `BACKUP_PATH`), do seu computador:

```bash
ssh deploy@SERVIDOR 'cd /opt/achados-vip && docker compose -f infra/docker-compose.yml exec -T backup cat /backups/ARQUIVO.dump.enc' > ARQUIVO.dump.enc
```

Se o backup é cifrado, o destino não precisa ser confiável — mas **guarde a senha/chave em outro lugar**.

### 6.3 Testar a restauração (faça todo mês)

Um backup que nunca foi restaurado é uma esperança, não um backup:

```bash
./infra/scripts/restore.sh --verify latest
```

Restaura o arquivo mais recente num banco **temporário** (o banco real não é tocado), confere o SHA-256, a decifragem, o número de tabelas/migrations e contagens de linhas das tabelas principais, e remove o temporário.

### 6.4 Restaurar de verdade

```bash
./infra/scripts/restore.sh                       # lista os backups
./infra/scripts/restore.sh achados-20261017T033000Z.dump.enc     # pede para digitar RESTAURAR
```

Sequência: para `api` e `worker` → faz um **backup de segurança do estado atual** (`achados-prerestore-...`) → `pg_restore --clean --if-exists --single-transaction` (tudo ou nada: se falhar, o banco fica como estava) → sobe `api` e `worker` (o `migrate` reaplica migrations pendentes se o backup for de uma versão antiga). Depois confira o painel e rode o `smoke.sh`. Se as filas parecerem inconsistentes com o banco restaurado: `docker compose -f infra/docker-compose.yml exec redis redis-cli FLUSHDB` (as agendas são recriadas pelo worker).

Backup cifrado com **age**: decifre no seu computador (`age -d -i chave.txt -o backup.dump arquivo.dump.age`), envie o `.dump` ao servidor e rode `./infra/scripts/restore.sh /caminho/backup.dump`.

### 6.5 Recuperação de desastre (servidor novo)

1. Prepare o servidor (seções 2 e 3), copie o `infra/.env` **original** (com a mesma `APP_ENCRYPTION_KEY`!) e ajuste o DNS para o novo IP.
2. `./infra/scripts/deploy.sh` (sobe uma instalação vazia, já com migrations).
3. Envie o backup mais recente e rode `./infra/scripts/restore.sh /caminho/arquivo.dump[.enc]` (para `.enc`, a `BACKUP_PASSPHRASE` do `.env` precisa ser a usada no backup).
4. `./infra/scripts/smoke.sh`, entre no painel, rode **Testar conexão** em todas as integrações e confira **Automação** (publicação automática só deve voltar a ficar ligada depois dessa conferência).

## 7. Monitoramento e alertas

- **Logs:** `./infra/scripts/deploy.sh logs <serviço>` (JSON; rotação automática de 10 MB × 5 por serviço). API, worker e Caddy não registram cookies, tokens nem senhas (a API sanitiza; o Caddy remove `Cookie`, `Authorization`, `X-Csrf-Token` e `Set-Cookie` do log de acesso). Dentro do painel: **Configurações → Logs** e **Auditoria**.
- **Saúde dos contêineres:** `docker compose -f infra/docker-compose.yml ps` mostra `healthy/unhealthy`; o `backup` fica *healthy* se houve backup bem-sucedido nas últimas 26 h.
- **Monitor externo (essencial):** monitore `https://SEU_DOMINIO/health` com um serviço externo (UptimeRobot, Better Stack, Healthchecks.io...) com alerta por e-mail/Telegram. Se o servidor inteiro cair, só um monitor *de fora* avisa.
- **Alerta ativo de backup:** defina `BACKUP_PING_URL` (URL de um check do healthchecks.io): o serviço faz `GET` a cada backup bem-sucedido e em `/fail` quando falha; o serviço externo alerta se o ping não chegar no prazo (cobre também "backup parou de rodar").
- **Verificação periódica automática** (dead man's switch), por cron do usuário `deploy`:

  ```bash
  # crontab -e   (a cada 15 min; se o smoke passar, avisa o check do healthchecks.io; se falhar, o alerta dispara por falta de ping)
  */15 * * * * cd /opt/achados-vip && ./infra/scripts/smoke.sh >/dev/null 2>&1 && curl -fsS -m 10 -o /dev/null https://hc-ping.com/SEU-UUID
  ```

- **Alertas do próprio sistema:** o sino do painel mostra notificações (job travado, integração que exige autenticação, falha definitiva de publicação). Os limites de alerta (`stuckJobMinutes`, `stuckPublicationMinutes`) ficam em **Configurações → Alertas**.
- **Disco:** alerte quando `df -h /` passar de 80%. Volumes: `pgdata` (cresce com o histórico de preços; a retenção configurável poda dados antigos), `backups`, `caddy_data` (certificados — **não apague**).

## 8. Rotação de segredos

| Segredo | Como trocar | Efeito |
|---|---|---|
| **Senha do administrador** | `./infra/scripts/deploy.sh admin` (mesmo e-mail) ou **Configurações → Segurança** | Encerra as demais sessões |
| **`SESSION_SECRET`** | `./infra/scripts/generate-secrets.sh --only SESSION_SECRET` → colar no `.env` → `./infra/scripts/deploy.sh` | Todas as sessões caem; é seguro e simples |
| **`POSTGRES_PASSWORD`** | (1) `docker compose -f infra/docker-compose.yml exec -it postgres psql -U achados -d achados` e dentro do `psql` rode `\password achados` (a senha não fica no histórico); (2) coloque a **mesma** senha (somente letras/números) no `.env`; (3) `./infra/scripts/deploy.sh`. A variável do `.env` só vale na criação do banco; é preciso trocar no banco também. | Reinicia API/worker/backup |
| **`REDIS_PASSWORD`** | Gere (`--only REDIS_PASSWORD`), cole no `.env`, `./infra/scripts/deploy.sh` | Filas reiniciam; os dados importantes estão no PostgreSQL |
| **`APP_ENCRYPTION_KEY`** | **Não há re-criptografia automática.** Trocar a chave torna ilegíveis as credenciais já salvas (tokens do Telegram, WhatsApp, Mercado Livre...). Procedimento: anote quais credenciais existem → gere a nova chave → atualize o `.env` e faça o deploy → recadastre cada credencial em **Integrações** (e refaça os testes) → faça um backup novo. Backups antigos continuam com as credenciais cifradas pela chave antiga: guarde a chave antiga junto deles. | Integrações ficam "Autenticação necessária" até recadastrar |
| **`BACKUP_PASSPHRASE`** | Gere uma nova, atualize o `.env`, `./infra/scripts/deploy.sh` e rode `./infra/scripts/backup.sh`. **Guarde a senha antiga**: ela é necessária para abrir backups antigos. | Novos backups usam a nova senha |
| **Tokens de integrações** (ML, Telegram, WhatsApp, webhook) | Revogue no provedor (BotFather `/revoke`, DevCenter, Meta) e cadastre o novo no painel | Veja [`INTEGRACOES.md`](INTEGRACOES.md) |
| **Chaves SSH / deploy key** | Padrão do seu provedor/Git | — |

Se suspeitar de vazamento do `.env`: troque **todos** os itens acima, revogue os tokens externos e verifique **Configurações → Auditoria**.

## 9. Segurança: o que a pilha faz e o que fica por sua conta

Já feito: HTTPS com HSTS, redirecionamento 80→443, cabeçalhos de segurança (Caddy + Helmet + Next), CSRF, cookie `HttpOnly`/`SameSite=Strict`/`Secure`, rate limit e bloqueio progressivo de login, senhas com argon2, credenciais cifradas (AES-256-GCM), redes separadas (banco e Redis inalcançáveis de fora), contêineres da aplicação sem root e sem *capabilities*, logs sem segredos, `/docs` protegido em produção, `/ready` não exposto.

Por sua conta: o painel **não tem autenticação em dois fatores** — use senha longa e única. Para reduzir a superfície, restrinja o acesso por IP (ou por VPN, p. ex. Tailscale). Exemplo de bloqueio por IP no `infra/Caddyfile`, **dentro do bloco do site e antes dos `handle`** (teste de fora do seu IP e mantenha um acesso SSH para desfazer; atrás do Docker em IPv6 o IP de origem pode aparecer como o do gateway):

```caddyfile
	@bloqueado {
		not remote_ip 203.0.113.10 198.51.100.0/24
		not path /health
	}
	handle @bloqueado {
		respond "Acesso restrito." 403
	}
```

Depois: `docker compose -f infra/docker-compose.yml restart caddy`.

## 10. Checklist de produção

- [ ] Domínio com registro A/AAAA correto; `dig +short` retorna o IP do servidor
- [ ] Usuário não-root com chave SSH; login por senha e `root` desabilitados
- [ ] `ufw` ativo: só 22, 80, 443; `nmap` de fora confirma
- [ ] Atualizações automáticas de segurança ativas; relógio sincronizado
- [ ] `infra/.env` com `chmod 600`, **sem** valores de exemplo, **copiado para um gerenciador de senhas**
- [ ] `./infra/scripts/deploy.sh` terminou com "todos os serviços saudáveis"
- [ ] `./infra/scripts/smoke.sh` sem FAIL (e com `SMOKE_EMAIL/SMOKE_PASSWORD` uma vez)
- [ ] Administrador criado; senha forte e única guardada em gerenciador
- [ ] Backup cifrado (`BACKUP_PASSPHRASE` ou `BACKUP_AGE_RECIPIENT`), primeiro backup visível em `restore.sh`
- [ ] Cópia **fora do servidor** dos backups configurada (cron/rsync/rclone) e testada
- [ ] `./infra/scripts/restore.sh --verify latest` executado com sucesso
- [ ] Monitor externo em `https://DOMINIO/health` com alerta; `BACKUP_PING_URL` configurado
- [ ] Integrações: **Testar conexão** de cada uma com resultado real (veja [`TESTES.md`](TESTES.md), checklist de validação)
- [ ] **Publicação automática desligada** até validar canais, links de afiliado e janela anti-spam; horário de silêncio ativo
- [ ] Alertas/notificações do painel verificados; plano para trocar tokens se algum vazar (seção 8)

## 11. Problemas comuns

| Sintoma | Causa provável / ação |
|---|---|
| `deploy.sh` reclama do `.env` | Leia a lista: domínio/e-mail de exemplo, senha com caractere inválido, chave com tamanho errado. Corrija e repita |
| Navegador mostra erro de certificado | DNS não aponta para o servidor, porta 80/443 bloqueada, ou limite do Let's Encrypt. `docker compose -f infra/docker-compose.yml logs caddy` mostra o motivo. Não apague o volume `caddy_data` |
| `migrate` falhou | `./infra/scripts/deploy.sh logs migrate`. Nada sobe até corrigir; o banco permanece na versão anterior |
| `api` *unhealthy* | `logs api`: normalmente `DATABASE_URL`/`REDIS_URL` ou variável obrigatória ausente (a API lista só os **nomes** que faltam) |
| `worker` *unhealthy* | Redis inacessível ou senha divergente. Compare `REDIS_PASSWORD` e reinicie `redis`, `api`, `worker` |
| `backup` *unhealthy* | Sem backup bem-sucedido em 26 h: `logs backup` (senha do banco, disco cheio, `BACKUP_PATH` sem permissão para o UID 70) |
| 502/503 no painel logo após o deploy | Serviços ainda subindo; aguarde o healthcheck. Se persistir: `deploy.sh status` |
| Fonte em "Autenticação necessária" | Credenciais do Mercado Livre ausentes/expiradas: [`INTEGRACOES.md`](INTEGRACOES.md) |
| Falta de memória (OOM) | `docker stats`; aumente a RAM/swap ou ajuste os `mem_limit` do compose |
