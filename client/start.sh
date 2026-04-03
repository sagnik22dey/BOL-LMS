#!/bin/sh
set -e

# Use PORT from environment, default to 3030
PORT="${PORT:-3030}"

# API_BACKEND_URL is the internal address of the Go backend.
# For docker-compose it is http://api:8080, for Railway set this env var
# to the backend's private/public URL.
API_BACKEND_URL="${API_BACKEND_URL:-http://api:8080}"

echo "==> Starting nginx on port $PORT"
echo "==> API backend URL: $API_BACKEND_URL"

# Substitute ${PORT} and ${API_BACKEND_URL} in the nginx config template.
# Using sed avoids shell-expansion issues with envsubst.
sed -e "s|\${PORT}|$PORT|g" \
    -e "s|\${API_BACKEND_URL}|$API_BACKEND_URL|g" \
    /etc/nginx/nginx.conf.template \
    > /etc/nginx/conf.d/default.conf

# Validate the generated config
nginx -t

# Start nginx in foreground
exec nginx -g 'daemon off;'
