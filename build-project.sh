#!/bin/bash

# Create directories if they don't exist
mkdir -p public/assets
mkdir -p src/main
mkdir -p src/renderer
mkdir -p src/signaling
mkdir -p build

# Move files to appropriate locations
echo "Moving files to appropriate locations..."

# Copy files that may have been created in the wrong location
find . -name "main.js" -not -path "./src/main/*" -exec cp {} src/main/ \;
find . -name "preload.js" -not -path "./src/main/*" -exec cp {} src/main/ \;
find . -name "server.js" -not -path "./src/signaling/*" -exec cp {} src/signaling/ \;
find . -name "noise-suppression.js" -not -path "./src/renderer/*" -exec cp {} src/renderer/ \;
find . -name "index.html" -not -path "./public/*" -exec cp {} public/ \;
find . -name "styles.css" -not -path "./public/*" -exec cp {} public/ \;
find . -name "renderer.js" -not -path "./public/*" -exec cp {} public/ \;
find . -name "icon.svg" -not -path "./public/assets/*" -exec cp {} public/assets/ \;
find . -name "entitlements.mac.plist" -not -path "./build/*" -exec cp {} build/ \;

echo "Setup complete!"

# List the directories to verify
echo "Project structure:"
find . -type f -not -path "./node_modules/*" | sort 