#!/bin/bash

# Upgrade Docker Buildx to version 0.17.0 or later
# Run this if you have an older version and need 0.17+

set -e

echo "🔧 Upgrading Docker Buildx to v0.17.0..."

# Remove old buildx if exists
echo "🗑️  Removing old buildx..."
rm -f ~/.docker/cli-plugins/docker-buildx
sudo rm -f /usr/local/lib/docker/cli-plugins/docker-buildx 2>/dev/null || true

# Create directory for buildx plugin
mkdir -p ~/.docker/cli-plugins
mkdir -p /usr/local/lib/docker/cli-plugins 2>/dev/null || true

# Detect architecture
if [ "$(uname -m)" == "x86_64" ]; then
    ARCH="amd64"
elif [ "$(uname -m)" == "aarch64" ]; then
    ARCH="arm64"
else
    ARCH="amd64"
fi

# Download buildx 0.17.0
BUILDX_VERSION="v0.17.0"
echo "📥 Downloading Docker Buildx ${BUILDX_VERSION} (${ARCH})..."

curl -L "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-${ARCH}" \
    -o ~/.docker/cli-plugins/docker-buildx

chmod +x ~/.docker/cli-plugins/docker-buildx

# Copy to system location
sudo cp ~/.docker/cli-plugins/docker-buildx /usr/local/lib/docker/cli-plugins/docker-buildx 2>/dev/null || true

# Remove old builder instances
docker buildx rm mybuilder 2>/dev/null || true
docker buildx rm builder 2>/dev/null || true

# Install buildx
echo "🔨 Installing buildx..."
docker buildx install || true

# Create new builder instance
echo "🏗️  Creating builder instance..."
docker buildx create --name mybuilder --use 2>/dev/null || docker buildx use mybuilder || true

# Bootstrap builder
docker buildx inspect --bootstrap 2>/dev/null || true

echo ""
echo "✅ Buildx upgraded to ${BUILDX_VERSION}!"
echo ""
echo "Verify installation:"
echo "  docker buildx version"
echo ""
echo "Expected output should show: github.com/docker/buildx v0.17.0"
echo ""

