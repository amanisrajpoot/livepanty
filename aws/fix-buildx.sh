#!/bin/bash

# Quick fix for buildx issue on Amazon Linux
# Run this if you get "compose build requires buildx 0.17" error

set -e

echo "🔧 Installing Docker Buildx..."

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

# Download buildx
BUILDX_VERSION="v0.11.2"
echo "📥 Downloading Docker Buildx ${BUILDX_VERSION} (${ARCH})..."

curl -L "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-${ARCH}" \
    -o ~/.docker/cli-plugins/docker-buildx

chmod +x ~/.docker/cli-plugins/docker-buildx

# Copy to system location
sudo cp ~/.docker/cli-plugins/docker-buildx /usr/local/lib/docker/cli-plugins/docker-buildx 2>/dev/null || true

# Initialize buildx
echo "🔨 Initializing buildx..."
docker buildx version || docker buildx install || true

# Create builder instance
docker buildx create --name mybuilder --use 2>/dev/null || true
docker buildx inspect --bootstrap 2>/dev/null || true

echo ""
echo "✅ Buildx installed!"
echo ""
echo "Verify installation:"
echo "  docker buildx version"
echo ""
echo "If it still doesn't work, try:"
echo "  docker buildx install"
echo "  docker buildx create --name mybuilder --use"
echo ""

