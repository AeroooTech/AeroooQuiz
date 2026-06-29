# Quiz Arena — container image. Works on Raspberry Pi (arm64/armv7) and x86.
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies (uses package-lock.json for reproducibility).
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
# Where the editable question bank is stored (mount this as a volume to persist).
ENV QUIZ_DATA_DIR=/app/server/data
VOLUME ["/app/server/data"]
EXPOSE 3000

CMD ["node", "server/index.js"]
