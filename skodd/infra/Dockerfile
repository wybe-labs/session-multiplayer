# API-et kjøres som TypeScript med tsx. Ett bilde, ingen byggetrinn å feile på.
FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace @skodd/api --include-workspace-root

COPY packages/core packages/core
COPY apps/api apps/api

RUN addgroup -S skodd && adduser -S skodd -G skodd && chown -R skodd:skodd /app
USER skodd

EXPOSE 8080
ENV PORT=8080 HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/v1/helse').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "-w", "@skodd/api"]
