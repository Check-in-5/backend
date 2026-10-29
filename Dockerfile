FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node src ./src
COPY --chown=node:node docs ./docs
RUN mkdir -p /app/data && chown node:node /app/data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DB_PATH=/app/data/checkin.sqlite
USER node
EXPOSE 3001
CMD ["node", "src/server.js"]