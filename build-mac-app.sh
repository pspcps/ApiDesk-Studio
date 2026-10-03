#!/bin/bash

# ==========================================================
# ApiDesk - All-in-One Native macOS App (.app / .dmg) Builder
# Zero-config: Run this single script directly on your Mac!
# ==========================================================

set -e

# Change directory to the root directory where this script is located
cd "$(dirname "$0")"

echo ""
echo "🚀 ========================================================="
echo "🚀  ApiDesk: Native macOS App Packager (.dmg / .app)"
echo "🚀 ========================================================="
echo ""

# 1. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not found in PATH."
    echo "👉 Please install Node.js LTS (https://nodejs.org) or run 'brew install node'."
    exit 1
fi

NODE_VER=$(node -v)
echo "🟢 Node.js detected: $NODE_VER"

# 2. Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not found. Please install npm."
    exit 1
fi

echo ""
echo "📦 [1/4] Installing project & runtime dependencies..."
npm install

echo ""
echo "📦 [2/4] Ensuring Electron & Electron-Builder packaging tools are ready..."
npm install --save-dev electron electron-builder

echo ""
echo "🧹 Cleaning previous build packages and cache..."
rm -rf dist/mac* dist/win* dist/*.exe dist/*.dmg dist/*.zip dist/*.blockmap 2>/dev/null || true

echo ""
echo "⚙️ [3/4] Compiling UI and bundling native Node.js backend (dist/server.cjs)..."
npm run build

echo ""
echo "🍎 [4/4] Packaging Native macOS Application (.dmg and .app)..."

# Detect Mac Architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    echo "⚡ Detected Apple Silicon (M1 / M2 / M3 / M4) Mac."
    echo "⚡ Building native ARM64 application..."
    npx electron-builder --mac --arm64
else
    echo "⚡ Detected Intel (x86_64) Mac."
    echo "⚡ Building native x64 application..."
    npx electron-builder --mac --x64
fi

echo ""
echo "========================================================="
echo "🎉 SUCCESS! Your Native Mac App has been built!"
echo "========================================================="
echo ""
echo "📁 Your compiled application files are ready in the 'dist' folder:"
if [ "$ARCH" = "arm64" ]; then
    echo "   👉 App Bundle:  dist/mac-arm64/ApiDesk.app"
    echo "   👉 Installer:   dist/ApiDesk-*.dmg"
else
    echo "   👉 App Bundle:  dist/mac/ApiDesk.app"
    echo "   👉 Installer:   dist/ApiDesk-*.dmg"
fi
echo ""
echo "🚀 To Install & Run on your Mac:"
echo "   1. Open the dist folder:"
echo "      $ open dist"
echo "   2. Double-click the .dmg or drag 'ApiDesk.app' to your Applications folder."
echo "   3. Click 'ApiDesk' to launch. Node.js backend & UI start automatically!"
echo ""
echo "📝 Centralized Debug & Execution Logs:"
echo "   All runtime and API logs are written live to: ~/apilogs"
echo "   - Master trace log:      ~/apilogs/app.log"
echo "   - Errors & exceptions:   ~/apilogs/error.log"
echo "   - Server & API proxy:    ~/apilogs/server.log"
echo "   - Electron process:      ~/apilogs/electron.log"
echo ""

