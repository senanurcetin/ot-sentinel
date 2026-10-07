# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The key is only read at request time; a placeholder lets `next build` succeed.
RUN GEMINI_API_KEY=build-placeholder npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=9002 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /data && chown app:app /data
# Operator verdicts are kept in SQLite here; mount a volume to keep them across containers.
ENV FEEDBACK_DB_PATH=/data/feedback.db
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 9002
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:9002/api/health || exit 1
CMD ["node", "server.js"]
