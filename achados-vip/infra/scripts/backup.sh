#!/bin/sh
# Backup do PostgreSQL do Achados VIP.
#
# Uso:
#   ./infra/scripts/backup.sh          roda UM backup agora (no host: executa dentro do contêiner "backup")
#   backup.sh --loop                   (somente dentro do contêiner) backup diário em BACKUP_TIME, para sempre
#
# O que faz: pg_dump em formato custom (já comprimido) -> valida o arquivo -> criptografa (opcional) ->
# grava SHA-256 -> apaga backups mais antigos que BACKUP_RETENTION_DAYS -> marca sucesso (.last_success).
#
# Variáveis (definidas pelo docker-compose; ver infra/.env.example):
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE    conexão (padrão do libpq)
#   BACKUP_DIR              pasta de destino              (padrão /backups)
#   BACKUP_PREFIX           prefixo dos arquivos          (padrão achados)
#   BACKUP_TIME             HH:MM do backup diário        (padrão 03:30)
#   BACKUP_RETENTION_DAYS   dias de retenção, >= 1        (padrão 14)
#   BACKUP_AGE_RECIPIENT    chave pública age1...  -> arquivo .dump.age (prioridade)
#   BACKUP_PASSPHRASE       senha                  -> arquivo .dump.enc (openssl AES-256-CBC + PBKDF2)
#   BACKUP_PING_URL         opcional: GET em URL (sucesso) ou URL/fail (falha)
#
# Compatível com POSIX sh (dash/busybox ash).
set -eu

log() { printf '%s [backup] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# ---- no host: delega para o contêiner (onde estão pg_dump, a senha e a pasta de backups)
if [ "${IN_BACKUP_CONTAINER:-0}" != "1" ]; then
  for a in "$@"; do
    [ "$a" = "--loop" ] && { echo "--loop só existe dentro do contêiner (já roda no serviço 'backup')." >&2; exit 2; }
  done
  SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
  exec docker compose -f "$SCRIPT_DIR/../docker-compose.yml" exec -T backup sh /scripts/backup.sh "$@"
fi

BACKUP_DIR=${BACKUP_DIR:-/backups}
BACKUP_PREFIX=${BACKUP_PREFIX:-achados}
BACKUP_TIME=${BACKUP_TIME:-03:30}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
BACKUP_PASSPHRASE=${BACKUP_PASSPHRASE:-}
BACKUP_AGE_RECIPIENT=${BACKUP_AGE_RECIPIENT:-}
BACKUP_PING_URL=${BACKUP_PING_URL:-}
export BACKUP_PASSPHRASE   # openssl lê via "-pass env:" (a senha nunca aparece na linha de comando)

printf '%s' "$BACKUP_RETENTION_DAYS" | grep -Eq '^[1-9][0-9]*$' \
  || { log "ERRO: BACKUP_RETENTION_DAYS deve ser um inteiro >= 1"; exit 2; }
printf '%s' "$BACKUP_TIME" | grep -Eq '^([01][0-9]|2[0-3]):[0-5][0-9]$' \
  || { log "ERRO: BACKUP_TIME deve estar no formato HH:MM"; exit 2; }

# Notifica um serviço de "dead man's switch" (opcional). Nunca registra a URL (ela é um segredo).
ping_url() {
  [ -n "$BACKUP_PING_URL" ] || return 0
  wget -q -T 10 -O /dev/null "${BACKUP_PING_URL}${1:-}" 2>/dev/null || log "aviso: não foi possível notificar BACKUP_PING_URL"
}

# Segundos até a próxima ocorrência de HH:MM (1$x - 100 evita que "08"/"09" sejam lidos como octal).
seconds_until() {
  th=${1%%:*}; tm=${1##*:}
  th=$((1$th - 100)); tm=$((1$tm - 100))
  nh=$(date +%H); nm=$(date +%M); ns=$(date +%S)
  nh=$((1$nh - 100)); nm=$((1$nm - 100)); ns=$((1$ns - 100))
  d=$(( (th * 3600 + tm * 60) - (nh * 3600 + nm * 60 + ns) ))
  [ "$d" -le 0 ] && d=$((d + 86400))
  echo "$d"
}

# Roda sempre dentro de um subshell "( run_backup )": cada etapa checa o próprio erro, porque o "set -e" é
# ignorado quando o subshell é usado como condição de "if".
run_backup() {
  umask 077
  mkdir -p "$BACKUP_DIR" || exit 1
  # restos de uma execução interrompida (ex.: contêiner parado no meio do pg_dump)
  find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.partial*' -mmin +60 -exec rm -f {} + 2>/dev/null || true

  ts=$(date -u '+%Y%m%dT%H%M%SZ')
  base="$BACKUP_DIR/$BACKUP_PREFIX-$ts"
  raw="$base.dump.partial"
  trap 'rm -f "$raw" "$raw.enc" "$raw.age"' EXIT

  log "iniciando pg_dump de ${PGDATABASE:-?}@${PGHOST:-?}"
  pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$raw" \
    || { log "ERRO: pg_dump falhou"; exit 1; }
  # confirma que o arquivo é um dump legível antes de considerá-lo um backup
  pg_restore --list "$raw" >/dev/null \
    || { log "ERRO: o dump gerado não pôde ser lido (pg_restore --list)"; exit 1; }

  if [ -n "$BACKUP_AGE_RECIPIENT" ]; then
    final="$base.dump.age"
    age -r "$BACKUP_AGE_RECIPIENT" -o "$raw.age" "$raw" || { log "ERRO: falha ao criptografar com age (BACKUP_AGE_RECIPIENT válido?)"; exit 1; }
    mv "$raw.age" "$final" || exit 1
  elif [ -n "$BACKUP_PASSPHRASE" ]; then
    final="$base.dump.enc"
    openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSPHRASE -in "$raw" -out "$raw.enc" \
      || { log "ERRO: falha ao criptografar com openssl"; exit 1; }
    mv "$raw.enc" "$final" || exit 1
  else
    final="$base.dump"
    mv "$raw" "$final" || exit 1
    log "AVISO: backup SEM criptografia (defina BACKUP_PASSPHRASE ou BACKUP_AGE_RECIPIENT)"
  fi
  rm -f "$raw"

  (cd "$BACKUP_DIR" && sha256sum "$(basename "$final")" > "$(basename "$final").sha256") \
    || { log "ERRO: não foi possível gravar o SHA-256"; exit 1; }
  size=$(wc -c < "$final" | tr -d ' ')
  log "backup concluído: $(basename "$final") (${size} bytes)"

  # retenção: só depois de um backup novo e válido existir
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "$BACKUP_PREFIX-*" -mtime +"$BACKUP_RETENTION_DAYS" -exec rm -f {} + 2>/dev/null || true
  touch "$BACKUP_DIR/.last_success" || exit 1
  trap - EXIT
}

# executa run_backup e notifica; nunca derruba o laço diário
run_and_notify() {
  if ( run_backup ); then
    ping_url ""
  else
    log "ERRO: o backup FALHOU (veja as mensagens acima)"
    ping_url "/fail"
    return 1
  fi
}

case "${1:-}" in
  --loop)
    trap 'log "encerrando"; exit 0' TERM INT
    log "serviço de backup ativo: diário às ${BACKUP_TIME} (TZ=${TZ:-UTC}), retenção ${BACKUP_RETENTION_DAYS} dia(s)"
    # primeira execução imediata se não houver backup recente (instalação nova ou servidor parado)
    if [ -z "$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$BACKUP_PREFIX-*" ! -name '*.sha256' -mmin -1440 2>/dev/null | head -n 1)" ]; then
      run_and_notify || true
    fi
    while :; do
      secs=$(seconds_until "$BACKUP_TIME")
      log "próximo backup em ${secs}s"
      sleep "$secs" &
      wait $! || true
      run_and_notify || true
    done
    ;;
  ''|--once)
    run_and_notify
    ;;
  -h|--help)
    sed -n '2,20p' "$0"
    ;;
  *)
    echo "Argumento desconhecido: $1 (use --once, --loop ou --help)" >&2
    exit 2
    ;;
esac
