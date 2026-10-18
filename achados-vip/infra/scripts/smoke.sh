#!/usr/bin/env bash
# Smoke test pós-deploy do Achados VIP: confere se o que deveria estar no ar está, e se o que deveria estar fechado está fechado.
# NÃO testa Mercado Livre, Telegram nem WhatsApp (isso é feito pelos botões "Testar conexão" do painel — veja docs/TESTES.md).
#
#   ./infra/scripts/smoke.sh [URL_BASE] [opções]       (ou: npm run smoke)
#
#   URL_BASE        padrão: https://<DOMAIN do infra/.env>   ex.: https://painel.seudominio.com.br
#   --insecure      aceita certificado inválido/autoassinado (testes locais com DOMAIN=localhost)
#   --skip-web      não testa o painel Next.js (use ao apontar direto para a API, ex.: http://127.0.0.1:3001)
#   --skip-docker   não consulta o Docker (use quando rodar fora do servidor)
#
# Variáveis opcionais (login real, só leitura; nada é gravado e a sessão é encerrada no fim):
#   SMOKE_EMAIL / SMOKE_PASSWORD   -> testa login, /api/auth/me, /api/dashboard e logout
#
# Saída: uma linha por verificação (PASS / FAIL / WARN / SKIP). Código de saída 1 se houver qualquer FAIL.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$INFRA_DIR/.env"

BASE=""; INSECURE=0; SKIP_WEB=0; SKIP_DOCKER=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --insecure) INSECURE=1 ;;
    --skip-web) SKIP_WEB=1 ;;
    --skip-docker) SKIP_DOCKER=1 ;;
    -h|--help) sed -n '2,17p' "${BASH_SOURCE[0]}"; exit 0 ;;
    -*) echo "opção desconhecida: $1" >&2; exit 2 ;;
    *) BASE="$1" ;;
  esac
  shift
done

if [[ -z "$BASE" ]]; then
  if [[ -f "$ENV_FILE" ]]; then
    domain="$(grep -E '^DOMAIN=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '\r')"
    [[ -n "$domain" ]] && BASE="https://$domain"
  fi
  [[ -n "$BASE" ]] || { echo "Informe a URL base (ex.: https://painel.seudominio.com.br) ou configure DOMAIN em infra/.env" >&2; exit 2; }
fi
BASE="${BASE%/}"
command -v curl >/dev/null 2>&1 || { echo "curl não encontrado (sudo apt install curl)" >&2; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
CURL_OPTS=(-sS --max-time 20)
[[ $INSECURE -eq 1 ]] && CURL_OPTS+=(-k)

PASS=0; FAILS=0; WARNS=0
pass() { PASS=$((PASS + 1)); printf 'PASS  %s\n' "$*"; }
fail() { FAILS=$((FAILS + 1)); printf 'FAIL  %s\n' "$*"; }
warn() { WARNS=$((WARNS + 1)); printf 'WARN  %s\n' "$*"; }
skip() { printf 'SKIP  %s\n' "$*"; }

# req METODO CAMINHO [curl-args...]  -> define STATUS, e deixa cabeçalhos em $TMP/h e corpo em $TMP/b
req() {
  local method="$1" path="$2"; shift 2
  STATUS="$(curl "${CURL_OPTS[@]}" -X "$method" -o "$TMP/b" -D "$TMP/h" -w '%{http_code}' "$@" "$BASE$path" 2>"$TMP/e")" || STATUS="000"
}
header() { grep -i "^$1:" "$TMP/h" 2>/dev/null | head -n 1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'; }

echo "Smoke test em $BASE"
echo "----------------------------------------------------------------"

# 1) liveness pelo proxy
req GET /health
if [[ "$STATUS" == "200" ]] && grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' "$TMP/b"; then
  pass "GET /health -> 200 {status: ok}"
else
  fail "GET /health -> $STATUS (esperado 200). $(head -c 200 "$TMP/e" 2>/dev/null)"
fi

# 2) TLS / HTTPS
if [[ "$BASE" == https://* ]]; then
  hsts="$(header strict-transport-security)"
  [[ -n "$hsts" ]] && pass "HSTS presente ($hsts)" || fail "cabeçalho Strict-Transport-Security ausente"

  hostport="${BASE#https://}"; hostport="${hostport%%/*}"; host="${hostport%%:*}"; port=443
  [[ "$hostport" == *:* ]] && port="${hostport##*:}"
  if [[ "$port" == "443" ]]; then
    # HTTP (porta 80) deve redirecionar para HTTPS
    code="$(curl -sS --max-time 15 -o /dev/null -w '%{http_code} %{redirect_url}' "http://$host/" 2>/dev/null || echo '000 ')"
    if [[ "$code" =~ ^30[1278]\ https:// ]]; then pass "http://$host/ redireciona para HTTPS ($code)"; else fail "http://$host/ não redireciona para HTTPS (obtido: $code)"; fi
  fi

  if command -v openssl >/dev/null 2>&1; then
    end="$(echo | timeout 15 openssl s_client -servername "$host" -connect "$host:$port" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
    if [[ -n "$end" ]]; then
      days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
      if (( days < 0 )); then fail "certificado EXPIRADO ($end)"
      elif (( days < 14 )); then warn "certificado expira em $days dia(s) ($end) — a renovação automática do Caddy deveria ter ocorrido"
      else pass "certificado com validade restante de $days dia(s)"; fi
    else
      warn "não foi possível ler o certificado TLS"
    fi
  fi
else
  skip "verificações de HTTPS (URL base é http://)"
fi

# 3) cabeçalhos de segurança básicos
[[ "$(header x-content-type-options)" == "nosniff" ]] && pass "X-Content-Type-Options: nosniff" || fail "X-Content-Type-Options ausente em /health"

# 4) a API exige autenticação
req GET /api/auth/me
if [[ "$STATUS" == "401" ]]; then pass "GET /api/auth/me sem sessão -> 401"; else fail "GET /api/auth/me sem sessão -> $STATUS (esperado 401)"; fi
req GET /api/dashboard
if [[ "$STATUS" == "401" ]]; then pass "GET /api/dashboard sem sessão -> 401 (rotas protegidas)"; else fail "GET /api/dashboard sem sessão -> $STATUS (esperado 401!)"; fi

# 5) /docs: em produção exige sessão
req GET /docs
case "$STATUS" in
  401) pass "GET /docs sem sessão -> 401 (documentação protegida em produção)" ;;
  200|302) warn "GET /docs acessível SEM login ($STATUS): confirme que NODE_ENV=production na API" ;;
  *) fail "GET /docs -> $STATUS (esperado 401)" ;;
esac

# 6) /ready não deve estar exposto publicamente pelo Caddy (só o healthcheck interno)
if [[ $SKIP_WEB -eq 0 ]]; then
  req GET /ready
  if [[ "$STATUS" == "200" ]] && grep -q '"checks"' "$TMP/b"; then warn "/ready está exposto publicamente (o Caddyfile padrão não o expõe)"; else pass "/ready não exposto publicamente ($STATUS)"; fi

  # 7) painel
  req GET /login
  if [[ "$STATUS" == "200" ]] && [[ "$(header content-type)" == text/html* ]]; then pass "GET /login -> 200 text/html (painel no ar)"; else fail "GET /login -> $STATUS (esperado 200 text/html)"; fi
  csp="$(header content-security-policy)"
  [[ -n "$csp" ]] && pass "painel envia Content-Security-Policy" || warn "painel sem Content-Security-Policy"
  [[ "$(header x-frame-options)" == "DENY" ]] && pass "X-Frame-Options: DENY no painel" || warn "X-Frame-Options ausente/diferente de DENY no painel"
else
  skip "painel (--skip-web)"
fi

# 8) Docker (somente no servidor)
if [[ $SKIP_DOCKER -eq 0 ]] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && [[ -f "$INFRA_DIR/docker-compose.yml" ]]; then
  compose=(docker compose -f "$INFRA_DIR/docker-compose.yml")
  for svc in postgres redis api worker web caddy backup; do
    cid="$("${compose[@]}" ps -q "$svc" 2>/dev/null || true)"
    if [[ -z "$cid" ]]; then fail "serviço $svc não está criado"; continue; fi
    st="$(docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}n/d{{end}}' "$cid" 2>/dev/null)"
    case "$st" in
      running/healthy) pass "serviço $svc: saudável" ;;
      running/starting) warn "serviço $svc: ainda iniciando ($st)" ;;
      *) fail "serviço $svc: $st" ;;
    esac
  done
  mig="$("${compose[@]}" ps -a -q migrate 2>/dev/null | head -n 1)"
  if [[ -n "$mig" ]]; then
    ec="$(docker inspect -f '{{.State.ExitCode}}' "$mig" 2>/dev/null || echo '?')"
    [[ "$ec" == "0" ]] && pass "migrations aplicadas (serviço migrate terminou com código 0)" || fail "serviço migrate terminou com código $ec — veja: docker compose logs migrate"
  fi
  # readiness real (banco + Redis) por dentro da rede Docker
  if "${compose[@]}" exec -T api node /app/healthcheck.cjs http http://127.0.0.1:3001/ready >/dev/null 2>&1; then
    pass "API /ready (PostgreSQL + Redis) -> OK"
  else
    fail "API /ready falhou (PostgreSQL ou Redis indisponível para a API)"
  fi
  # portas: postgres e redis NÃO podem ter porta publicada no host
  for svc in postgres redis; do
    cid="$("${compose[@]}" ps -q "$svc" 2>/dev/null || true)"
    if [[ -n "$cid" ]]; then
      pub="$(docker inspect -f '{{range $p, $b := .NetworkSettings.Ports}}{{if $b}}{{$p}} {{end}}{{end}}' "$cid" 2>/dev/null)"
      [[ -z "${pub// /}" ]] && pass "$svc sem porta publicada no host" || fail "$svc publica portas no host: $pub"
    fi
  done
else
  skip "verificações do Docker (--skip-docker, ou Docker indisponível)"
fi

# 9) fluxo de login real (opcional)
if [[ -n "${SMOKE_EMAIL:-}" && -n "${SMOKE_PASSWORD:-}" ]]; then
  esc() { local s="$1"; s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; printf '%s' "$s"; }
  printf '{"email":"%s","password":"%s"}' "$(esc "$SMOKE_EMAIL")" "$(esc "$SMOKE_PASSWORD")" > "$TMP/login.json"
  req POST /api/auth/login -c "$TMP/jar" -H 'content-type: application/json' --data @"$TMP/login.json"
  rm -f "$TMP/login.json"
  if [[ "$STATUS" == "200" ]]; then
    pass "login com SMOKE_EMAIL -> 200"
    csrf="$(grep -o '"csrfToken"[[:space:]]*:[[:space:]]*"[^"]*"' "$TMP/b" | head -n 1 | sed 's/.*:[[:space:]]*"\(.*\)"/\1/')"
    cookie_line="$(grep -i '^set-cookie:' "$TMP/h" | head -n 1)"
    [[ "$cookie_line" == *HttpOnly* ]] && pass "cookie de sessão é HttpOnly" || fail "cookie de sessão sem HttpOnly"
    [[ "$cookie_line" == *SameSite=Strict* ]] && pass "cookie de sessão é SameSite=Strict" || fail "cookie de sessão sem SameSite=Strict"
    if [[ "$BASE" == https://* ]]; then
      [[ "$cookie_line" == *Secure* ]] && pass "cookie de sessão é Secure" || fail "cookie de sessão sem Secure em HTTPS"
    fi
    req GET /api/auth/me -b "$TMP/jar"
    [[ "$STATUS" == "200" ]] && pass "GET /api/auth/me com sessão -> 200" || fail "GET /api/auth/me com sessão -> $STATUS"
    req GET /api/dashboard -b "$TMP/jar"
    if [[ "$STATUS" == "200" ]] && grep -q '"monitoring"' "$TMP/b"; then pass "GET /api/dashboard com sessão -> 200"; else fail "GET /api/dashboard com sessão -> $STATUS"; fi
    # CSRF: uma mutação sem o token deve ser recusada
    req POST /api/auth/logout -b "$TMP/jar"
    [[ "$STATUS" == "403" ]] && pass "mutação sem X-CSRF-Token -> 403 (CSRF ativo)" || fail "mutação sem X-CSRF-Token -> $STATUS (esperado 403)"
    req POST /api/auth/logout -b "$TMP/jar" -H "X-CSRF-Token: $csrf"
    [[ "$STATUS" == "200" ]] && pass "logout com X-CSRF-Token -> 200" || fail "logout -> $STATUS"
    req GET /api/auth/me -b "$TMP/jar"
    [[ "$STATUS" == "401" ]] && pass "sessão invalidada após o logout" || fail "sessão ainda válida após o logout ($STATUS)"
  else
    fail "login com SMOKE_EMAIL -> $STATUS (credenciais incorretas, usuário inexistente ou bloqueio temporário)"
  fi
else
  skip "fluxo de login (defina SMOKE_EMAIL e SMOKE_PASSWORD para testar)"
fi

echo "----------------------------------------------------------------"
echo "Resultado: $PASS PASS, $WARNS WARN, $FAILS FAIL"
if (( FAILS > 0 )); then
  echo "Há falhas. Veja: ./infra/scripts/deploy.sh status   e   ./infra/scripts/deploy.sh logs <serviço>"
  exit 1
fi
exit 0
