# Build Stage
FROM oven/bun:latest AS builder
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install

# Accept VITE_API_URL at build time so Vite can bake it into the bundle.
# For docker-compose this defaults to empty (nginx proxy handles /api/).
# For Railway, set this variable in the service dashboard and redeploy.
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

# Copy source and build
COPY . .
RUN bun run build

# Serve Stage
FROM nginx:alpine

# Copy custom Nginx configuration template (kept in a non-default location
# so nginx's own docker-entrypoint does NOT process it automatically)
COPY nginx.conf /etc/nginx/nginx.conf.template

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy and make executable the startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Remove the default nginx config to avoid conflicts
RUN rm -f /etc/nginx/conf.d/default.conf

# Railway injects $PORT at runtime; default to 3030 for local testing
ENV PORT=3030
EXPOSE 3030

# Override the default nginx entrypoint entirely
ENTRYPOINT []
CMD ["/start.sh"]
