#!/bin/sh
set -e

# Use PORT from environment, default to 3030
PORT="${PORT:-3030}"

echo "==> Starting nginx on port $PORT"

# Substitute ${PORT} in the nginx config template using sed
# (avoids shell-expansion issues with envsubst)
sed "s/\${PORT}/$PORT/g" /etc/nginx/nginx.conf.template \
    > /etc/nginx/conf.d/default.conf

# Validate the generated config
nginx -t

# Start nginx in foreground
exec nginx -g 'daemon off;'
