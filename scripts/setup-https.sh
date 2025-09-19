#!/bin/bash

echo "🔐 Setting up HTTPS development environment for nextpgp-dev.com"
echo "=============================================================="

# Check if running as root (needed for hosts file modification)
if [[ $EUID -eq 0 ]]; then
   echo "❌ Please don't run this script as root. It will ask for sudo when needed."
   exit 1
fi

# Generate SSL certificates
echo "📋 Generating SSL certificates..."
node scripts/generate-cert.js

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate certificates"
    exit 1
fi

# Update hosts file
echo ""
echo "📋 Updating /etc/hosts file..."

# Check if nextpgp-dev.com is already in hosts file
if grep -q "nextpgp-dev.com" /etc/hosts; then
    echo "✅ nextpgp-dev.com already exists in /etc/hosts"
else
    echo "🔧 Adding nextpgp-dev.com to /etc/hosts..."
    echo "127.0.0.1 nextpgp-dev.com" | sudo tee -a /etc/hosts
    echo "✅ Added nextpgp-dev.com to /etc/hosts"
fi

echo ""
echo "🎉 Setup complete! Here's how to run your app with HTTPS:"
echo ""
echo "1. Start the HTTPS development server:"
echo "   yarn dev:https"
echo ""
echo "2. Open your browser and go to:"
echo "   https://nextpgp-dev.com:3000"
echo ""
echo "3. Accept the self-signed certificate warning in your browser"
echo ""
echo "🔐 Web Crypto API will now be available!"
echo ""
echo "💡 Note: You may need to restart your browser after updating /etc/hosts"
