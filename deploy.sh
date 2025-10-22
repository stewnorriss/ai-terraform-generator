#!/bin/bash

# AI Terraform Generator Deployment Script
# Usage: ./deploy.sh [platform]
# Platforms: vercel, netlify, docker, pm2

set -e

PLATFORM=${1:-vercel}
PROJECT_NAME="ai-terraform-generator"

echo "🚀 Deploying AI Terraform Generator to $PLATFORM..."

case $PLATFORM in
  "vercel")
    echo "📦 Deploying to Vercel..."
    if ! command -v vercel &> /dev/null; then
      echo "Installing Vercel CLI..."
      npm install -g vercel
    fi
    vercel --prod
    echo "✅ Deployed to Vercel!"
    ;;
    
  "netlify")
    echo "📦 Deploying to Netlify..."
    if ! command -v netlify &> /dev/null; then
      echo "Installing Netlify CLI..."
      npm install -g netlify-cli
    fi
    netlify deploy --prod
    echo "✅ Deployed to Netlify!"
    ;;
    
  "docker")
    echo "🐳 Building and running Docker container..."
    docker build -t $PROJECT_NAME .
    docker stop $PROJECT_NAME 2>/dev/null || true
    docker rm $PROJECT_NAME 2>/dev/null || true
    docker run -d --name $PROJECT_NAME -p 3000:3000 $PROJECT_NAME
    echo "✅ Docker container running on http://localhost:3000"
    ;;
    
  "pm2")
    echo "⚡ Deploying with PM2..."
    if ! command -v pm2 &> /dev/null; then
      echo "Installing PM2..."
      npm install -g pm2
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Install dependencies
    npm ci --only=production
    
    # Start with PM2
    pm2 start ecosystem.config.js --env production
    pm2 save
    
    echo "✅ Deployed with PM2!"
    echo "📊 Monitor with: pm2 monit"
    echo "📝 View logs with: pm2 logs $PROJECT_NAME"
    ;;
    
  *)
    echo "❌ Unknown platform: $PLATFORM"
    echo "Available platforms: vercel, netlify, docker, pm2"
    exit 1
    ;;
esac

echo ""
echo "🎉 Deployment complete!"
echo "📖 Check DEPLOYMENT.md for detailed instructions"
echo "🔗 Your AI Terraform Generator is now live!"