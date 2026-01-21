FROM oven/bun:1.1.29 AS deps
WORKDIR /app
COPY package.json ./
RUN bun install --production

FROM oven/bun:1.1.29
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["bun", "src/bootstrap/server.ts"]
