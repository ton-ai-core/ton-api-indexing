#!/bin/bash

set -e

echo "🚀 TON API Indexer Setup Script"
echo "================================="

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if ! npx semver -r ">=$REQUIRED_VERSION" "$NODE_VERSION" &> /dev/null; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to >= $REQUIRED_VERSION"
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION is compatible"

# Install dependencies
echo "📦 Installing dependencies..."
if command -v yarn &> /dev/null; then
    yarn install
else
    npm install
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    cp env.example .env
    echo "📝 Please edit .env file and add your TONAPI_KEY"
    echo "   You can get API key from: https://t.me/tonapi_bot"
else
    echo "✅ .env file already exists"
fi

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data

# Build the project
echo "🔨 Building the project..."
if command -v yarn &> /dev/null; then
    yarn build
else
    npm run build
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your TONAPI_KEY"
echo "2. Run the indexer:"
echo "   npm start              # Single iteration"
echo "   npm start complete     # Complete indexing"
echo "   npm run dev            # Development mode"
echo ""
echo "For more information, see README.md" 