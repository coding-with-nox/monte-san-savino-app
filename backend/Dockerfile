FROM oven/bun:1.1.29 AS deps
WORKDIR /app
COPY package.json ./
RUN bun install --production

FROM oven/bun:1.1.29
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun . .
# Run as non-root (user "bun" ships with oven/bun). The app writes nothing to disk; port 3000 is unprivileged.
USER bun
EXPOSE 3000
CMD ["bun", "src/bootstrap/server.ts"]
