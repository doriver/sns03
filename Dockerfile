FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY client/ /client/
ENV NODE_ENV=production \
    LOG_TO_STDOUT_ONLY=true \
    TRUST_PROXY=true \
    PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]
