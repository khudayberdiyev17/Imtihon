#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -e .env ]; then echo '.env already exists; kept unchanged.'; exit 0; fi
command -v openssl >/dev/null
umask 077
(set -o noclobber; cat > .env <<EOF
MONGO_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$(openssl rand -hex 16)
HTTP_PORT=8082
ALLOWED_ORIGINS=https://imtihon.cybertron.uz
EOF
)
echo '.env created (mode 600). Read ADMIN_PASSWORD locally to sign in.'
