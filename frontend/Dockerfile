# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set build arguments for Vite
ARG VITE_API_URL
ARG VITE_WORKER_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WORKER_URL=$VITE_WORKER_URL

# Build the app
RUN npm run build

# Production stage with Caddy
FROM caddy:2-alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /srv

# Copy custom Caddy configuration
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
