#!/usr/bin/env bash
# Gera segredos fortes (openssl) para o Achados VIP.
#
#   ./infra/scripts/generate-secrets.sh                  imprime NOME=valor na tela (para copiar com cuidado)
#   ./infra/scripts/generate-secrets.sh --write          cria infra/.env a partir de infra/.env.example, já com os
#                                                        segredos preenchidos (chmod 600); NÃO imprime os valores
#   ./infra/scripts/generate-secrets.sh --write --force  substitui um infra/.env existente (guarda cópia .env.bak.<data>)
#   ./infra/scripts/generate-secrets.sh --fill           preenche só os segredos VAZIOS de um infra/.env existente
#   ./infra/scripts/generate-secrets.sh --only NOME      imprime só um valor (útil na rotação de segredos)
#
# NOME ∈ POSTGRES_PASSWORD | REDIS_PASSWORD | APP_ENCRYPTION_KEY | SESSION_SECRET | BACKUP_PASSPHRASE
#
# Formatos (todos gerados com "openssl rand"):
#   POSTGRES_PASSWORD, REDIS_PASSWORD  hex de 32 bytes (64 caracteres) — só [0-9a-f], seguro para usar em URLs
#   APP_ENCRYPTION_KEY                 base64 de 32 bytes (exigido pela API): openssl rand -base64 32
#   SESSION_SECRET                     base64 de 48 bytes (64 caracteres):    openssl rand -base64 48
#   BACKUP_PASSPHRASE                  base64 de 33 bytes (44 caracteres):    openssl rand -base64 33
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXAMPLE="$INFRA_DIR/.env.example"
TARGET="$INFRA_DIR/.env"

SECRET_NAMES=(POSTGRES_PASSWORD REDIS_PASSWORD APP_ENCRYPTION_KEY SESSION_SECRET BACKUP_PASSPHRASE)

die() { echo "Erro: $*" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || die "openssl não encontrado (sudo apt install openssl)"

gen() {
  case "$1" in
    POSTGRES_PASSWORD|REDIS_PASSWORD) openssl rand -hex 32 ;;
    APP_ENCRYPTION_KEY) openssl rand -base64 32 ;;
    SESSION_SECRET) openssl rand -base64 48 ;;
    BACKUP_PASSPHRASE) openssl rand -base64 33 ;;
    *) die "segredo desconhecido: $1 (use: ${SECRET_NAMES[*]})" ;;
  esac
}

MODE='print'
FORCE=0
ONLY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --write) MODE='write' ;;
    --fill) MODE='fill' ;;
    --force) FORCE=1 ;;
    --only) shift; ONLY="${1:-}"; [[ -n "$ONLY" ]] || die "--only exige um NOME"; MODE='only' ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "opção desconhecida: $1 (use --help)" ;;
  esac
  shift
done

# Reescreve um arquivo .env substituindo valores de chaves; $1 = origem, $2 = destino, $3 = "all" | "empty"
# (all = sobrescreve qualquer valor; empty = só chaves cujo valor está vazio). Sem sed: não há problema com "/", "+" ou "=".
render_env() {
  local src="$1" dst="$2" only_empty="$3" line key val name hit
  : > "$dst"
  while IFS= read -r line || [[ -n "$line" ]]; do
    hit=0
    if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      for name in "${SECRET_NAMES[@]}"; do
        if [[ "$key" == "$name" ]] && { [[ "$only_empty" == "all" ]] || [[ -z "$val" ]]; }; then
          printf '%s=%s\n' "$key" "$(gen "$key")" >> "$dst"
          hit=1
          break
        fi
      done
    fi
    [[ $hit -eq 1 ]] || printf '%s\n' "$line" >> "$dst"
  done < "$src"
}

case "$MODE" in
  print)
    echo "# Cole no infra/.env (ou use --write). Não compartilhe nem versione estes valores."
    for n in "${SECRET_NAMES[@]}"; do printf '%s=%s\n' "$n" "$(gen "$n")"; done
    ;;
  only)
    gen "$ONLY"
    ;;
  write)
    [[ -f "$EXAMPLE" ]] || die "não encontrei $EXAMPLE"
    if [[ -f "$TARGET" ]]; then
      [[ $FORCE -eq 1 ]] || die "$TARGET já existe. Use --fill (só preencher vazios) ou --force (substituir, com cópia de segurança)."
      cp -p "$TARGET" "$TARGET.bak.$(date +%Y%m%d%H%M%S)"
      echo "Cópia de segurança do .env antigo criada (contém segredos: apague quando não precisar mais)."
    fi
    umask 077
    render_env "$EXAMPLE" "$TARGET" all
    chmod 600 "$TARGET"
    echo "Criado $TARGET (permissão 600) com: ${SECRET_NAMES[*]}"
    echo "Falta editar manualmente: DOMAIN e ACME_EMAIL. Guarde uma cópia do .env em um gerenciador de senhas (fora do servidor)."
    ;;
  fill)
    [[ -f "$TARGET" ]] || die "$TARGET não existe. Rode primeiro: cp infra/.env.example infra/.env (ou use --write)"
    umask 077
    tmp="$(mktemp "$INFRA_DIR/.env.XXXXXX")"
    trap 'rm -f "$tmp"' EXIT
    render_env "$TARGET" "$tmp" empty
    chmod 600 "$tmp"
    mv "$tmp" "$TARGET"
    trap - EXIT
    echo "Segredos vazios de $TARGET foram preenchidos (os já preenchidos não foram alterados)."
    ;;
esac
