# 🚀 Deployment Guide - AI Terraform Generator

This guide covers multiple deployment options for your AI Terraform Generator, from simple hosting to enterprise-grade solutions.

## 📋 Quick Deployment Options

### 1. 🌐 Vercel (Recommended for Static + Serverless)

**Best for:** Quick deployment with serverless backend

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from your project directory
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? ai-terraform-generator
# - Directory? ./
# - Override settings? No
```

**Vercel Configuration:**
Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ]
}
```

### 2. 🚀 Netlify (Great for Static Sites)

**Best for:** Frontend-focused deployment with serverless functions

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build and deploy
netlify deploy

# For production deployment
netlify deploy --prod
```

**Netlify Configuration:**
Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "public"

[dev]
  command = "npm start"
  port = 3000

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

### 3. 🐳 Docker + Cloud Platforms

**Best for:** Containerized deployment on any cloud platform

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
```

Create `.dockerignore`:
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
.vscode
```

**Deploy to various platforms:**

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Render
```bash
# Connect your GitHub repo to Render
# Set build command: npm install
# Set start command: npm start
# Set environment: Node.js
```

#### DigitalOcean App Platform
```bash
# Create app.yaml
spec:
  name: ai-terraform-generator
  services:
  - name: web
    source_dir: /
    github:
      repo: your-username/ai-terraform-generator
      branch: main
    run_command: npm start
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xxs
```

### 4. ☁️ AWS Deployment (Enterprise Grade)

**Best for:** Full AWS integration with your existing infrastructure

#### Option A: AWS App Runner
```bash
# Create apprunner.yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - npm ci
run:
  runtime-version: 18
  command: npm start
  network:
    port: 3000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
```

#### Option B: AWS ECS with Fargate
```bash
# Build and push Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -t ai-terraform-generator .
docker tag ai-terraform-generator:latest <account>.dkr.ecr.us-east-1.amazonaws.com/ai-terraform-generator:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/ai-terraform-generator:latest
```

#### Option C: AWS Lambda + API Gateway
Convert to serverless functions using the Serverless Framework:

```bash
npm install -g serverless
serverless create --template aws-nodejs --path ai-terraform-serverless
```

### 5. 🔧 Traditional VPS/Server Deployment

**Best for:** Full control and custom configurations

#### Using PM2 (Process Manager)
```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ai-terraform-generator',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### Nginx Reverse Proxy Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 Security Considerations

### Environment Variables
Create `.env` file (never commit this):
```bash
NODE_ENV=production
PORT=3000
AWS_REGION=eu-central-1
# Add any sensitive configuration here
```

### Security Headers
Add to your server.js:
```javascript
// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com;");
    next();
});
```

## 🌍 Custom Domain Setup

### 1. Domain Configuration
- Purchase domain from registrar (Namecheap, GoDaddy, etc.)
- Point DNS to your hosting provider
- Configure SSL certificate (most platforms provide free SSL)

### 2. SSL Certificate (Let's Encrypt)
```bash
# For VPS deployment
sudo certbot --nginx -d your-domain.com
```

## 📊 Monitoring & Analytics

### Add Google Analytics
```html
<!-- Add to index.html head -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Health Check Endpoint
Already included in your server.js:
```javascript
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
```

## 🚀 Recommended Deployment Strategy

### For Personal/Demo Use:
1. **Vercel** - Easiest deployment with great performance
2. **Netlify** - Great for static sites with serverless functions

### For Production Use:
1. **AWS App Runner** - Fully managed with AWS integration
2. **Docker + Railway/Render** - Good balance of control and simplicity

### For Enterprise Use:
1. **AWS ECS/EKS** - Full container orchestration
2. **Traditional VPS** with PM2 - Maximum control

## 📝 Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] Security headers implemented
- [ ] Health check endpoint working
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Domain name purchased (if needed)
- [ ] SSL certificate configured
- [ ] Monitoring/analytics setup
- [ ] Backup strategy planned
- [ ] Performance testing completed

## 🔧 Post-Deployment Tasks

1. **Test all functionality** in production environment
2. **Monitor performance** and error rates
3. **Set up alerts** for downtime or errors
4. **Configure backups** if using databases
5. **Document the deployment** for team members
6. **Plan for scaling** as usage grows

## 💡 Cost Considerations

### Free Tier Options:
- **Vercel**: 100GB bandwidth, serverless functions
- **Netlify**: 100GB bandwidth, 125K serverless requests
- **Railway**: $5/month for hobby plan
- **Render**: Free tier with limitations

### Paid Options:
- **AWS**: Pay-as-you-go, typically $10-50/month for small apps
- **VPS**: $5-20/month for basic servers
- **Enterprise**: $100-500/month for high availability setups

Choose the deployment option that best fits your needs, budget, and technical requirements!