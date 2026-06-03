FROM node:20-alpine

# Install OpenSSL — required by Prisma on Alpine
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY prisma ./prisma/

# Generate Prisma client with correct binary for Alpine (musl)
RUN npx prisma generate

COPY . .

RUN mkdir -p logs

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
