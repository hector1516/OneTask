# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- run ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY wait-for-it.sh ./wait-for-it.sh
RUN chmod +x ./wait-for-it.sh
# seeds are mounted read-only from ./seeds via compose; keep a copy as fallback
COPY seeds ./seeds
RUN mkdir -p /app/storage/modules
EXPOSE 3000
CMD ["sh", "-c", "./wait-for-it.sh ${DB_HOST:-mysql}:${DB_PORT:-3306} --timeout=120 -- node dist/index.js"]
