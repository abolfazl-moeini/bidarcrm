FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV MONITOR_ENV=prod
CMD ["npm", "start"]
