FROM node:20-alpine AS builder

WORKDIR /app

COPY src/package*.json ./
RUN npm ci

COPY src/ ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]