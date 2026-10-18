# Imagem do serviço "backup": pg_dump/pg_restore 16 + openssl (criptografia por senha) + age (criptografia por chave pública).
# Mesma versão major do servidor (postgres:16) — pg_dump precisa ser >= versão do servidor.
FROM postgres:16-alpine
RUN apk add --no-cache openssl age tzdata \
 && mkdir -p /backups && chown postgres:postgres /backups
# O volume nomeado "backups" herda esta dona/permissão na primeira criação.
USER postgres
WORKDIR /backups
