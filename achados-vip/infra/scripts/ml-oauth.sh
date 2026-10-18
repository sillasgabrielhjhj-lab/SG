#!/usr/bin/env bash
# Assistente guiado para obter o REFRESH TOKEN do Mercado Livre (OAuth 2.0, fluxo "authorization code").
# Rode no SEU computador ou no servidor — qualquer lugar com internet, bash e curl.
#
#   ./infra/scripts/ml-oauth.sh [--pkce] [--out ARQUIVO]
#
#   --pkce          usa PKCE (S256). Use SE o seu app no DevCenter tiver PKCE habilitado.
#   --out ARQUIVO   grava "ML_REFRESH_TOKEN=..." no arquivo (permissão 600) em vez de imprimir na tela
#
# Você precisa antes (veja docs/INTEGRACOES.md, seção Mercado Livre): um app criado no DevCenter com
# App ID (client_id), Chave secreta (client_secret) e a Redirect URI cadastrada.
# Pode informar os dados por variáveis (ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI) ou digitar quando solicitado.
#
# O que o script faz: (1) mostra a URL de autorização; (2) você abre no navegador, autoriza e cola aqui a URL
# para a qual foi redirecionado (ou só o "code"); (3) troca o code por tokens em POST /oauth/token;
# (4) confirma o acesso com GET /users/me; (5) entrega o refresh_token. O access_token NUNCA é impresso.
#
# Observação (documentação do Mercado Livre — confirme no DevCenter): o "code" vale poucos minutos e é de uso único;
# o refresh_token também é de USO ÚNICO: a cada renovação o ML devolve um novo e invalida o anterior.
#
# Variáveis para testes com um servidor simulado: ML_AUTH_BASE, ML_API_BASE.
set -euo pipefail

AUTH_BASE="${ML_AUTH_BASE:-https://auth.mercadolivre.com.br}"
API_BASE="${ML_API_BASE:-https://api.mercadolibre.com}"
USE_PKCE=0
OUT=""

die() { echo "Erro: $*" >&2; exit 1; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pkce) USE_PKCE=1 ;;
    --out) shift; OUT="${1:-}"; [[ -n "$OUT" ]] || die "--out exige um arquivo" ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "opção desconhecida: $1" ;;
  esac
  shift
done
command -v curl >/dev/null 2>&1 || die "curl não encontrado"
command -v openssl >/dev/null 2>&1 || die "openssl não encontrado"

urlencode() { # urlencode TEXTO
  local s="$1" out="" c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in [A-Za-z0-9._~-]) out+="$c" ;; *) out+="$(printf '%%%02X' "'$c")" ;; esac
  done
  printf '%s' "$out"
}
# valores que vão entre aspas num arquivo de configuração do curl não podem ter aspas/barra invertida/quebra de linha
safe() { [[ "$1" != *\"* && "$1" != *\\* && "$1" != *$'\n'* && "$1" != *$'\r'* ]] || die "$2 contém caracteres inválidos"; }
json_get() { # json_get CHAVE <<< JSON   (JSON simples e plano, como o do ML)
  grep -oE "\"$1\"[[:space:]]*:[[:space:]]*(\"[^\"]*\"|[0-9]+)" | head -n 1 | sed -E 's/^[^:]*:[[:space:]]*"?([^"]*)"?$/\1/'
}

echo "=== Mercado Livre: obter refresh token ==="
CLIENT_ID="${ML_CLIENT_ID:-}"
CLIENT_SECRET="${ML_CLIENT_SECRET:-}"
REDIRECT_URI="${ML_REDIRECT_URI:-}"
[[ -n "$CLIENT_ID" ]] || read -r -p "App ID (client_id): " CLIENT_ID
[[ -n "$CLIENT_SECRET" ]] || { read -r -s -p "Chave secreta (client_secret; não aparece na tela): " CLIENT_SECRET; echo; }
[[ -n "$REDIRECT_URI" ]] || read -r -p "Redirect URI (exatamente como cadastrada no DevCenter): " REDIRECT_URI
[[ -n "$CLIENT_ID" && -n "$CLIENT_SECRET" && -n "$REDIRECT_URI" ]] || die "client_id, client_secret e redirect_uri são obrigatórios"
safe "$CLIENT_ID" client_id; safe "$CLIENT_SECRET" client_secret; safe "$REDIRECT_URI" redirect_uri

STATE="$(openssl rand -hex 16)"
AUTH_URL="$AUTH_BASE/authorization?response_type=code&client_id=$(urlencode "$CLIENT_ID")&redirect_uri=$(urlencode "$REDIRECT_URI")&state=$STATE"
VERIFIER=""
if [[ $USE_PKCE -eq 1 ]]; then
  VERIFIER="$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n' | cut -c1-64)"
  CHALLENGE="$(printf '%s' "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')"
  AUTH_URL+="&code_challenge=$CHALLENGE&code_challenge_method=S256"
fi

cat <<EOF

PASSO MANUAL — faça agora no navegador:
  1. Abra a URL abaixo (entre no Mercado Livre com a conta que vai autorizar o app, se pedir):

     $AUTH_URL

  2. Clique em "Permitir"/"Autorizar".
  3. O navegador será redirecionado para a sua Redirect URI com "?code=TG-...&state=..." no endereço.
     É normal a página mostrar erro ou "não encontrada" se essa URL não existir: o que importa é o ENDEREÇO.
  4. Copie o endereço COMPLETO da barra do navegador (ou só o valor depois de "code=") e cole abaixo.
     Faça isso logo: o code expira em poucos minutos e só pode ser usado uma vez.

EOF
read -r -p "Cole a URL completa (ou só o code): " PASTED
[[ -n "$PASTED" ]] || die "nada informado"

CODE="$PASTED"
if [[ "$PASTED" == *code=* ]]; then
  CODE="$(printf '%s' "$PASTED" | sed -E 's/.*[?&]code=([^&#[:space:]]+).*/\1/')"
  RET_STATE="$(printf '%s' "$PASTED" | sed -nE 's/.*[?&]state=([^&#[:space:]]+).*/\1/p')"
  if [[ -n "$RET_STATE" && "$RET_STATE" != "$STATE" ]]; then die "o 'state' da URL não confere com o desta sessão. Reinicie o script e use a URL gerada agora."; fi
fi
safe "$CODE" code

echo "Trocando o code por tokens..."
TOKEN_BODY="$(mktemp)"
trap 'rm -f "$TOKEN_BODY"' EXIT
# --config - : os segredos vão por stdin, nunca aparecem na linha de comando (ps) nem no histórico
{
  echo 'data-urlencode = "grant_type=authorization_code"'
  echo "data-urlencode = \"client_id=$CLIENT_ID\""
  echo "data-urlencode = \"client_secret=$CLIENT_SECRET\""
  echo "data-urlencode = \"code=$CODE\""
  echo "data-urlencode = \"redirect_uri=$REDIRECT_URI\""
  [[ -z "$VERIFIER" ]] || echo "data-urlencode = \"code_verifier=$VERIFIER\""
} | curl -sS --max-time 30 -o "$TOKEN_BODY" -w '%{http_code}' -X POST "$API_BASE/oauth/token" \
      -H 'accept: application/json' -H 'content-type: application/x-www-form-urlencoded' --config - > "$TOKEN_BODY.status" || true
HTTP="$(cat "$TOKEN_BODY.status" 2>/dev/null || echo 000)"; rm -f "$TOKEN_BODY.status"

if [[ "$HTTP" != "200" ]]; then
  err="$(json_get error < "$TOKEN_BODY" || true)"; msg="$(json_get message < "$TOKEN_BODY" || true)"
  echo "O Mercado Livre recusou a troca (HTTP $HTTP): ${err:-sem detalhe} ${msg:+— $msg}" >&2
  case "${err:-}" in
    invalid_grant) echo "Dica: code expirado/já usado, ou redirect_uri diferente da cadastrada. Rode o script de novo." >&2 ;;
    invalid_client|invalid_request) echo "Dica: confira client_id/client_secret e se o app está ativo no DevCenter." >&2 ;;
  esac
  exit 1
fi

REFRESH="$(json_get refresh_token < "$TOKEN_BODY" || true)"
ACCESS="$(json_get access_token < "$TOKEN_BODY" || true)"
SCOPE="$(json_get scope < "$TOKEN_BODY" || true)"
EXPIRES="$(json_get expires_in < "$TOKEN_BODY" || true)"
USER_ID="$(json_get user_id < "$TOKEN_BODY" || true)"
[[ -n "$REFRESH" ]] || die "a resposta não trouxe refresh_token. No DevCenter, habilite o escopo/permissão 'offline_access' no app e repita."
[[ -n "$ACCESS" ]] || die "a resposta não trouxe access_token"

echo "Tokens recebidos (escopos: ${SCOPE:-n/d}; access_token válido por ${EXPIRES:-?}s; user_id: ${USER_ID:-n/d})."

# confirmação: GET /users/me com o access token (cabeçalho via --config para não aparecer no ps)
ME_HTTP="$(printf 'header = "Authorization: Bearer %s"\n' "$ACCESS" | curl -sS --max-time 30 -o "$TOKEN_BODY" -w '%{http_code}' "$API_BASE/users/me" --config - || true)"
if [[ "$ME_HTTP" == "200" ]]; then
  echo "Conferência OK (GET /users/me): id=$(json_get id < "$TOKEN_BODY") nickname=$(json_get nickname < "$TOKEN_BODY")"
else
  echo "Aviso: GET /users/me respondeu HTTP $ME_HTTP — o token foi emitido, mas confirme o acesso pelo painel (Integrações > Testar conexão)." >&2
fi
unset ACCESS CLIENT_SECRET VERIFIER

if [[ -n "$OUT" ]]; then
  ( umask 077; printf 'ML_REFRESH_TOKEN=%s\n' "$REFRESH" > "$OUT" )
  echo "Refresh token gravado em $OUT (permissão 600). Copie a linha para infra/.env e apague o arquivo."
else
  echo
  echo "Adicione esta linha ao infra/.env (e guarde-a com cuidado; é uma senha):"
  echo
  echo "ML_REFRESH_TOKEN=$REFRESH"
fi
echo
echo "Próximos passos: preencha também ML_CLIENT_ID e ML_CLIENT_SECRET no infra/.env, rode ./infra/scripts/deploy.sh e,"
echo "no painel, Integrações > Testar fonte. Lembre: o refresh token é de uso único (veja docs/INTEGRACOES.md)."
