#!/bin/bash
# Nginx reverse proxy setup for Lawless AI Backend
# Run with: sudo bash scripts/setup-nginx.sh your-domain.com

set -e

DOMAIN=${1:-"api.lawless-ai.com"}

echo "=== Setting up Nginx for $DOMAIN ==="

# Install Nginx
apt update
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
cat > /etc/nginx/sites-available/lawless-ai << EOF
# Lawless AI Backend - Nginx Configuration

# Rate limiting
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;

upstream lawless_backend {
    server 127.0.0.1:4000;
    keepalive 64;
}

server {
    listen 80;
    server_name $DOMAIN;

    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://\$server_name\$request_uri;

    location / {
        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;

        # Proxy settings
        proxy_pass http://lawless_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # SSE support (long-running connections)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_buffering off;
        chunked_transfer_encoding on;
    }

    # Health check endpoint (no rate limit)
    location /health {
        proxy_pass http://lawless_backend;
        proxy_http_version 1.1;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/lawless-ai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Reload Nginx
systemctl reload nginx

echo ""
echo "=== Nginx configured ==="
echo ""
echo "HTTP is now running on port 80"
echo ""
echo "To enable HTTPS with Let's Encrypt:"
echo "  sudo certbot --nginx -d $DOMAIN"
echo ""
echo "Test with:"
echo "  curl http://$DOMAIN/health"
echo ""
