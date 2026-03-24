FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

RUN npm install

# Copy source and env files
COPY . .
# Copy root .env for FIREBASE_ vars during build
COPY ../.env.build .env.build 2>/dev/null || true

# Build
RUN npm run build

# Serve with lightweight static server
FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/dist ./dist

CMD ["serve", "-s", "dist", "-l", "3000"]
