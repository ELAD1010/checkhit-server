FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3001 \
    FILE_STORAGE_ROOT=/app/storage
WORKDIR /app
COPY package.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
