FROM node:22-alpine

WORKDIR /app
COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

# O banco SQLite fica aqui: monte um volume persistente neste caminho.
VOLUME /data
EXPOSE 3000

CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
