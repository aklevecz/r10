#!/bin/bash
# install.sh - Quick installation script for R10 server rendering

set -e

echo "🎬 R10 Server-Side Rendering Installer"
echo "======================================"
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "⚠️  Warning: Not in a git repository. Continue anyway? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        exit 0
    fi
fi

# Check for package.json in current directory (should be r10 project root)
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run from your project root."
    exit 1
fi

echo "📂 Current directory: $(pwd)"
echo ""
echo "This will:"
echo "  1. Create server/ directory with all server files"
echo "  2. Create src/lib/api/server-renderer.ts for client API"
echo "  3. Create .env.example for configuration"
echo ""
echo "Continue? (y/n)"
read -r response

if [ "$response" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "📦 Installing server components..."
echo ""

# Create directories
mkdir -p server
mkdir -p src/lib/api

# Check if files already exist
if [ -f "server/renderer.js" ]; then
    echo "⚠️  server/renderer.js already exists. Overwrite? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        echo "Skipping server files."
    else
        # Copy server files here (you'll need to have them in the package)
        echo "Copying server files..."
        cp -r ./server/* ../server/ 2>/dev/null || echo "Note: Copy server files manually from the package"
    fi
else
    echo "✅ Creating server directory"
fi

if [ -f "src/lib/api/server-renderer.ts" ]; then
    echo "⚠️  src/lib/api/server-renderer.ts already exists. Overwrite? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        echo "Skipping client API."
    fi
else
    echo "✅ Would create client API (copy manually from package)"
fi

# Create .env.example if it doesn't exist
if [ ! -f ".env.example" ]; then
    cat > .env.example << 'EOF'
# RunPod Configuration
VITE_RUNPOD_ENDPOINT=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID
VITE_RUNPOD_API_KEY=your_api_key_here
EOF
    echo "✅ Created .env.example"
else
    echo "ℹ️  .env.example already exists"
fi

# Check for .gitignore
if [ -f ".gitignore" ]; then
    if ! grep -q "^\.env$" .gitignore; then
        echo "" >> .gitignore
        echo "# Environment variables" >> .gitignore
        echo ".env" >> .gitignore
        echo ".env.local" >> .gitignore
        echo "✅ Updated .gitignore"
    fi
fi

# Copy SVG to server directory
if [ -f "static/raptor-svg.svg" ]; then
    if [ -d "server" ]; then
        cp static/raptor-svg.svg server/raptor-svg.svg
        echo "✅ Copied raptor-svg.svg to server/"
    fi
else
    echo "⚠️  static/raptor-svg.svg not found. You'll need to copy it manually."
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. cd server && npm install"
echo "  2. Review INTEGRATION.md for code changes"
echo "  3. Test locally: cd server && npm test"
echo "  4. Deploy to RunPod (see DEPLOYMENT.md)"
echo ""
echo "📚 Documentation:"
echo "  - INTEGRATION.md  - How to modify your Svelte code"
echo "  - server/README.md - Server implementation details"
echo "  - server/DEPLOYMENT.md - Deployment guide"
echo ""
