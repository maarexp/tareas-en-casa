FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY data-seed.js server.js ./
COPY public/ ./public/
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV NODE_ENV=production PORT=3000 DATA_FILE=/data/hogar.json PERSISTENT_STORAGE=1
EXPOSE 3000
CMD ["node", "server.js"]
