#!/bin/bash

# ==========================================================
# ApiDesk - All-in-One Windows Executable (.exe) Builder
# Cross-compiles directly on your Mac for Windows 10 & 11!
# ==========================================================

set -e

# Change directory to the root directory where this script is located
cd "$(dirname "$0")"

echo ""
echo "🪟 =========================================================="
echo "🪟  ApiDesk: Windows Executable (.exe) Cross-Packager"
echo "🪟  Host: macOS  --->  Target: Windows (x64)"
echo "🪟 =========================================================="
echo ""

# 1. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not found in PATH."
    echo "👉 Please install Node.js LTS (https://nodejs.org) or run 'brew install node'."
    exit 1
fi

NODE_VER=$(node -v)
echo "🟢 Host Node.js detected: $NODE_VER"

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
echo "🪟 [4/4] Cross-Compiling Native Windows Executables (.exe & installer)..."
echo "⚡ Generating NSIS Installer (.exe) and Standalone Portable (.exe)..."

npx electron-builder --win --x64

echo ""
echo "========================================================="
echo "🎉 SUCCESS! Your Windows Executables have been created!"
echo "========================================================="
echo ""
echo "📁 Compiled Windows binaries are ready in the 'dist' folder:"
echo "   👉 1. Setup Installer: dist/ApiDesk Setup 1.0.0.exe"
echo "         (Standard Windows Setup wizard with Desktop & Start Menu shortcuts)"
echo ""
echo "   👉 2. Standalone Portable: dist/ApiDesk 1.0.0.exe"
echo "         (Single file executable - runs directly on Windows without installation!)"
echo ""
echo "   👉 3. Windows Portable ZIP: dist/ApiDesk-1.0.0-win.zip"
echo ""
echo "========================================================="
echo "🚀 HOW TO RUN ON YOUR WINDOWS PC:"
echo "========================================================="
echo "   1. Open the dist directory on your Mac:"
echo "      $ open dist"
echo ""
echo "   2. Transfer 'ApiDesk Setup 1.0.0.exe' or 'ApiDesk 1.0.0.exe' to your Windows PC"
echo "      via USB Drive, Cloud (Google Drive / OneDrive / Dropbox), Network Share, or AirDrop/LocalSend."
echo ""
echo "   3. On your Windows PC:"
echo "      - Double click 'ApiDesk Setup 1.0.0.exe' to install, OR"
echo "      - Double click 'ApiDesk 1.0.0.exe' to run instantly without installing."
echo ""
echo "📝 Windows Centralized Logging & File Storage:"
echo "   All API execution, proxy, and diagnostic logs on Windows are saved to:"
echo "   %USERPROFILE%\\apilogs  (e.g., C:\\Users\\<username>\\apilogs)"
echo "   - Master trace log:      C:\\Users\\<username>\\apilogs\\app.log"
echo "   - Errors & exceptions:   C:\\Users\\<username>\\apilogs\\error.log"
echo "   - Server & API proxy:    C:\\Users\\<username>\\apilogs\\server.log"
echo "   - Electron process:      C:\\Users\\<username>\\apilogs\\electron.log"
echo ""
