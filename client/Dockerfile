# Build Stage
FROM oven/bun:latest AS builder
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install

# Copy source and build
COPY . .
RUN bun run build

# Serve Stage
FROM nginx:alpine

# Install envsubst (part of gettext) for PORT substitution
RUN apk add --no-cache gettext

# Copy custom Nginx configuration template for React Router
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Railway injects $PORT at runtime; envsubst replaces it in the nginx config
ENV PORT=3030
EXPOSE 3030

CMD ["/bin/sh", "-c", "envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
