FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

RUN npm install

# Copy frontend source
COPY frontend/ .

# Build (VITE_ env vars are baked in at build time)
RUN npm run build

# Serve with lightweight static server
FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
