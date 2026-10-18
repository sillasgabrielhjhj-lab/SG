#!/usr/bin/env bash
# Deploy do Achados VIP em um servidor com Docker (Compose v2).
#
#   ./infra/scripts/deploy.sh [comando]
#
#   up (padrão)   valida infra/.env, constrói as imagens, aplica migrations (serviço "migrate"), sobe tudo e confere a saúde
#   check         só valida infra/.env e o docker-compose.yml (não constrói nem sobe nada)
#   update        git pull --ff-only (se for um clone git) + deploy
#   admin         cria ou redefine o administrador (pergunta e-mail e senha, sem ecoar a senha)
#   status        mostra os serviços e a saúde de cada um
#   logs [svc]    acompanha os logs (todos os serviços, ou só o informado)
#   rollback      volta para as imagens anteriores (atenção: migrations NÃO são desfeitas — veja docs/DEPLOY.md)
#   down          para os contêineres (os dados, em volumes Docker, são mantidos)
#
# Opções do "up/update":  --skip-backup  não faz o backup antes de atualizar (não recomendado)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$INFRA_DIR/.." && pwd)"
COMPOSE_FILE="$INFRA_DIR/docker-compose.yml"
ENV_FILE="$INFRA_DIR/.env"

if [[ -t 1 ]]; then RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; BOLD=$'\e[1m'; RESET=$'\e[0m'; else RED=""; GREEN=""; YELLOW=""; BOLD=""; RESET=""; fi
info() { echo "${BOLD}==>${RESET} $*"; }
ok()   { echo "${GREEN}OK${RESET}  $*"; }
warn() { echo "${YELLOW}AVISO${RESET} $*" >&2; }
die()  { echo "${RED}ERRO${RESET} $*" >&2; exit 1; }

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# Lê VAR de infra/.env SEM executar o arquivo (nada de "source").
env_get() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n 1 || true)"
  line="${line#*=}"
  printf '%s' "${line%$'\r'}"
}

check_env() {
  info "Validando $ENV_FILE"
  [[ -f "$ENV_FILE" ]] || die "infra/.env não existe. Rode: cp infra/.env.example infra/.env && ./infra/scripts/generate-secrets.sh --fill"

  local mode
  mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || echo '')"
  if [[ -n "$mode" && "${mode: -2}" != "00" ]]; then warn "infra/.env está legível por outros usuários (modo $mode). Corrija: chmod 600 infra/.env"; fi

  local problems=0 v
  fail() { echo "  - $*" >&2; problems=$((problems + 1)); }

  for v in DOMAIN ACME_EMAIL POSTGRES_PASSWORD REDIS_PASSWORD APP_ENCRYPTION_KEY SESSION_SECRET; do
    [[ -n "$(env_get "$v")" ]] || fail "$v está vazio (para gerar segredos: ./infra/scripts/generate-secrets.sh --fill)"
  done

  local domain email pg redis key sess
  domain="$(env_get DOMAIN)"; email="$(env_get ACME_EMAIL)"; pg="$(env_get POSTGRES_PASSWORD)"
  redis="$(env_get REDIS_PASSWORD)"; key="$(env_get APP_ENCRYPTION_KEY)"; sess="$(env_get SESSION_SECRET)"

  if [[ -n "$domain" ]]; then
    [[ "$domain" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || fail "DOMAIN deve ser só o nome do domínio (sem https:// nem /): ex. painel.seudominio.com.br"
    [[ "$domain" != *seudominio* && "$domain" != *exemplo* ]] || fail "DOMAIN ainda é o valor de exemplo ($domain)"
    [[ "$domain" == "localhost" ]] && warn "DOMAIN=localhost: certificado interno do Caddy (não confiável) — só para testes locais"
  fi
  if [[ -n "$email" ]]; then
    [[ "$email" == *@*.* ]] || fail "ACME_EMAIL não parece um e-mail"
    [[ "$email" != *seudominio* && "$email" != *exemplo* ]] || fail "ACME_EMAIL ainda é o valor de exemplo ($email)"
  fi
  [[ -z "$pg" || "$pg" =~ ^[A-Za-z0-9]{16,}$ ]] || fail "POSTGRES_PASSWORD deve ter 16+ caracteres só com letras e números (entra numa URL). Gere com: openssl rand -hex 32"
  [[ -z "$redis" || "$redis" =~ ^[A-Za-z0-9]{16,}$ ]] || fail "REDIS_PASSWORD deve ter 16+ caracteres só com letras e números. Gere com: openssl rand -hex 32"
  [[ -z "$key" || "$key" =~ ^[A-Za-z0-9+/]{43}=$ ]] || fail "APP_ENCRYPTION_KEY deve ser base64 de 32 bytes (44 caracteres terminando em '='). Gere com: openssl rand -base64 32"
  [[ -z "$sess" || ${#sess} -ge 32 ]] || fail "SESSION_SECRET deve ter ao menos 32 caracteres. Gere com: openssl rand -base64 48"

  if [[ "$problems" -gt 0 ]]; then die "$problems problema(s) em infra/.env (acima). Corrija e rode de novo."; fi

  if [[ -z "$(env_get BACKUP_PASSPHRASE)" && -z "$(env_get BACKUP_AGE_RECIPIENT)" ]]; then
    warn "Backups SEM criptografia (BACKUP_PASSPHRASE e BACKUP_AGE_RECIPIENT vazios)."
  fi
  ok "infra/.env válido"

  command -v docker >/dev/null 2>&1 || die "docker não encontrado. Veja docs/DEPLOY.md (instalação do Docker)."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 não encontrado (comando 'docker compose'). Veja docs/DEPLOY.md."
  compose config -q || die "docker-compose.yml inválido com o seu infra/.env (mensagem acima)."
  ok "docker-compose.yml válido"
}

require_daemon() {
  docker info >/dev/null 2>&1 || die "o daemon do Docker não responde. Inicie-o (sudo systemctl start docker) e confirme que seu usuário está no grupo 'docker'."
}

check_dns() {
  local domain; domain="$(env_get DOMAIN)"
  [[ "$domain" == "localhost" ]] && return 0
  if command -v getent >/dev/null 2>&1 && ! getent hosts "$domain" >/dev/null 2>&1; then
    warn "O domínio $domain ainda não resolve no DNS deste servidor. Sem o registro A/AAAA apontando para cá o Let's Encrypt não emite o certificado."
  fi
}

IMAGES=(achados-vip/api achados-vip/api-tools achados-vip/web)

tag_previous() {
  local img
  for img in "${IMAGES[@]}"; do
    if docker image inspect "$img:latest" >/dev/null 2>&1; then docker tag "$img:latest" "$img:previous"; fi
  done
}

wait_healthy() {
  info "Aguardando os serviços ficarem saudáveis (até 4 min)"
  local svc deadline=$((SECONDS + 240)) pending cid state
  local services=(postgres redis api worker web caddy)
  while true; do
    pending=()
    for svc in "${services[@]}"; do
      cid="$(compose ps -q "$svc" 2>/dev/null || true)"
      state="$([[ -n "$cid" ]] && docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}sem-healthcheck{{end}}' "$cid" 2>/dev/null || echo 'ausente/-')"
      [[ "$state" == "running/healthy" ]] || pending+=("$svc=$state")
    done
    if [[ ${#pending[@]} -eq 0 ]]; then ok "todos os serviços saudáveis"; return 0; fi
    if (( SECONDS >= deadline )); then
      warn "ainda não saudáveis: ${pending[*]}"
      warn "veja os logs: ./infra/scripts/deploy.sh logs ${pending[0]%%=*}"
      return 1
    fi
    sleep 5
  done
}

cmd_up() {
  local skip_backup=0 a
  for a in "$@"; do [[ "$a" == "--skip-backup" ]] && skip_backup=1; done
  check_env
  require_daemon
  check_dns

  # backup antes de mexer (só se já existe uma instalação rodando)
  if compose ps --status running --services 2>/dev/null | grep -qx postgres; then
    if [[ "$skip_backup" -eq 1 ]]; then
      warn "pulando o backup pré-deploy (--skip-backup)"
    elif compose ps --status running --services 2>/dev/null | grep -qx backup; then
      info "Backup antes do deploy"
      "$SCRIPT_DIR/backup.sh" || die "o backup pré-deploy falhou; deploy cancelado (use --skip-backup por sua conta e risco)."
    fi
  fi

  tag_previous
  info "Construindo imagens (a primeira vez demora alguns minutos)"
  compose build --pull
  info "Subindo os serviços (o serviço 'migrate' aplica as migrations antes da API e do worker)"
  if ! compose up -d --remove-orphans; then
    warn "falha ao subir. Últimos logs do migrate:"
    compose logs --no-color --tail=40 migrate >&2 || true
    die "deploy interrompido. Se foi a migration, o banco permanece na versão anterior (cada migration roda em transação)."
  fi
  wait_healthy || die "o deploy subiu, mas nem todos os serviços ficaram saudáveis."
  echo
  ok "Deploy concluído."
  echo "  Próximos passos: ./infra/scripts/smoke.sh    (verificação pós-deploy)"
  echo "                   ./infra/scripts/deploy.sh admin   (criar o administrador, na primeira vez)"
}

cmd_update() {
  if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    info "Atualizando o código (git pull --ff-only)"
    git -C "$ROOT_DIR" pull --ff-only
  else
    warn "não é um clone git; usando o código que já está na pasta"
  fi
  cmd_up "$@"
}

cmd_admin() {
  check_env
  require_daemon
  local email pass pass2
  read -r -p "E-mail do administrador: " email
  read -r -s -p "Senha (mínimo 12 caracteres; não aparece na tela): " pass; echo
  read -r -s -p "Repita a senha: " pass2; echo
  [[ "$pass" == "$pass2" ]] || die "as senhas não conferem"
  [[ ${#pass} -ge 12 ]] || die "a senha precisa ter ao menos 12 caracteres"
  ADMIN_EMAIL="$email" ADMIN_PASSWORD="$pass" \
    compose run --rm --no-deps -T -e ADMIN_EMAIL -e ADMIN_PASSWORD api node dist/scripts/create-admin.js
  unset pass pass2
}

cmd_status() {
  require_daemon
  compose ps
  echo
  local svc cid
  for svc in postgres redis api worker web caddy backup; do
    cid="$(compose ps -q "$svc" 2>/dev/null || true)"
    printf '  %-9s %s\n' "$svc" "$([[ -n "$cid" ]] && docker inspect -f '{{.State.Status}} / saúde: {{if .State.Health}}{{.State.Health.Status}}{{else}}n/d{{end}}' "$cid" || echo 'não criado')"
  done
}

cmd_rollback() {
  check_env
  require_daemon
  local img
  for img in "${IMAGES[@]}"; do
    docker image inspect "$img:previous" >/dev/null 2>&1 || die "não há imagem anterior ($img:previous): nenhum deploy anterior neste servidor."
  done
  warn "Rollback troca apenas o CÓDIGO. As migrations já aplicadas NÃO são desfeitas; se a versão nova alterou o schema, restaure também o banco (docs/DEPLOY.md)."
  read -r -p "Digite VOLTAR para continuar: " answer
  [[ "$answer" == "VOLTAR" ]] || die "cancelado"
  for img in "${IMAGES[@]}"; do docker tag "$img:previous" "$img:latest"; done
  compose up -d --no-build --remove-orphans
  wait_healthy || true
}

main() {
  local cmd="${1:-up}"
  [[ $# -gt 0 ]] && shift
  case "$cmd" in
    up|deploy) cmd_up "$@" ;;
    check) check_env ;;
    update) cmd_update "$@" ;;
    admin) cmd_admin ;;
    status) cmd_status ;;
    logs) require_daemon; compose logs -f --tail=100 "$@" ;;
    rollback) cmd_rollback ;;
    down) require_daemon; compose down ;;
    -h|--help|help) sed -n '2,18p' "${BASH_SOURCE[0]}" ;;
    *) die "comando desconhecido: $cmd (use --help)" ;;
  esac
}

main "$@"
