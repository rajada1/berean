#!/usr/bin/env bash
# Berean installer - install globally from GitHub
set -e

REPO="https://github.com/rajada1/berean.git"
INSTALL_DIR="${BEREAN_INSTALL_DIR:-$HOME/.berean-cli}"

echo "📦 Installing Berean..."

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
  echo "  Updating existing installation..."
  cd "$INSTALL_DIR"
  git fetch origin
  git reset --hard origin/main
else
  echo "  Cloning from GitHub..."
  git clone "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install dependencies
echo "  Installing dependencies..."
npm install --production 2>&1 | tail -3

# Link globally
echo "  Linking globally..."
npm link 2>&1 | tail -2

echo ""
echo "✅ Berean installed! Run: berean --version"
echo "   Location: $INSTALL_DIR"
