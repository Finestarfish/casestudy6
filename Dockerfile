FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app/data
ENV PORT=3000
ENV DATABASE_PATH=/app/data/marks.json
USER node
EXPOSE 3000
CMD ["node", "server.js"]
