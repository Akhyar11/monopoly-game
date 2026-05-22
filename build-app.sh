#!/bin/bash
set -e

echo "Starting build process..."

# Navigate to frontend and build
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Move frontend build to backend public folder
echo "Copying frontend build to backend..."
rm -rf backend/public
cp -r frontend/dist backend/public

# Navigate to backend and build TypeScript
echo "Building backend..."
cd backend
npm install
npx tsc

# Add pkg config to backend package.json temporarily or use CLI flags
# pkg can use package.json. We will update package.json.
echo "Packaging into executables..."
npx pkg . --targets node18-linux-x64,node18-win-x64 --out-path ../bin

echo "Build complete! Executables are in the 'bin' directory."
