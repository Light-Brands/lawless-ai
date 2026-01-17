#!/bin/bash
# Deployment script for Oracle Cloud Ampere A1 instance
# Run this script on the Oracle Cloud VM

set -e

echo "=== Lawless AI Backend Deployment ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo -e "${RED}Please don't run as root. Run as ubuntu user.${NC}"
  exit 1
fi

# Step 1: System updates
echo -e "${YELLOW}[1/7] Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Step 2: Install Node.js 20
echo -e "${YELLOW}[2/7] Installing Node.js 20...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
node --version
npm --version

# Step 3: Install Claude CLI
echo -e "${YELLOW}[3/7] Installing Claude CLI...${NC}"
if ! command -v claude &> /dev/null; then
  curl -fsSL https://claude.ai/install.sh | bash
  export PATH="$HOME/.claude/bin:$PATH"
  echo 'export PATH="$HOME/.claude/bin:$PATH"' >> ~/.bashrc
fi
claude --version || echo "Claude CLI installed, authentication required"

# Step 4: Install PM2
echo -e "${YELLOW}[4/7] Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi
pm2 --version

# Step 5: Setup application
echo -e "${YELLOW}[5/7] Setting up application...${NC}"
APP_DIR="$HOME/lawless-ai-backend"

if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  git clone https://github.com/Light-Brands/lawless-ai.git "$APP_DIR"
  cd "$APP_DIR/backend"
fi

# Navigate to backend directory if we're in the main repo
if [ -d "backend" ]; then
  cd backend
fi

# Install dependencies and build
npm install
npm run build

# Create data directory
mkdir -p data

# Step 6: Configure environment
echo -e "${YELLOW}[6/7] Configuring environment...${NC}"
if [ ! -f ".env" ]; then
  cp .env.example .env
  # Generate random API key
  API_KEY=$(openssl rand -hex 32)
  sed -i "s/your-secret-api-key-here/$API_KEY/" .env
  echo -e "${GREEN}Generated new API key. Save this:${NC}"
  echo -e "${YELLOW}$API_KEY${NC}"
  echo ""
  echo "Update FRONTEND_URL in .env to your Vercel URL"
fi

# Step 7: Start with PM2
echo -e "${YELLOW}[7/7] Starting application with PM2...${NC}"
pm2 delete lawless-backend 2>/dev/null || true
pm2 start dist/server.js --name lawless-backend
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Backend running on port 3001"
echo ""
echo "Next steps:"
echo "1. Authenticate Claude CLI: claude"
echo "2. Update .env with your settings"
echo "3. Setup Nginx reverse proxy (run: sudo bash scripts/setup-nginx.sh)"
echo "4. Test: curl http://localhost:3001/health"
echo ""
