FROM node:22-alpine

WORKDIR /app
COPY mcp-server/package*.json ./
RUN npm ci
COPY mcp-server/tsconfig.json ./
COPY mcp-server/src ./src
COPY docs ./docs
COPY api ./api
COPY AGENTS.md ./
ENV REPORTING_KNOWLEDGE_ROOT=/app
RUN npm run build && npm prune --omit=dev

USER node
EXPOSE 8000
CMD ["node", "dist/start.js"]
