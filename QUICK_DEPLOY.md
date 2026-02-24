# ⚡ Quick Deploy Guide

Get your AI Terraform Generator online in minutes!

## 🚀 Fastest Options (1-2 minutes)

### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (follow prompts)
vercel

# Or use the deploy script
./deploy.sh vercel
```
**Result:** Your app will be live at `https://your-app-name.vercel.app`

### Option 2: Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod

# Or use the deploy script
./deploy.sh netlify
```
**Result:** Your app will be live at `https://your-app-name.netlify.app`

### Option 3: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```
**Result:** Your app will be live at `https://your-app-name.railway.app`

## 🐳 Docker Deployment (2-3 minutes)

### Local Docker
```bash
# Build and run
docker build -t ai-terraform-generator .
docker run -p 3000:3000 ai-terraform-generator

# Or use the deploy script
./deploy.sh docker
```
**Result:** Your app will be live at `http://localhost:3000`

### Docker Compose
```bash
docker-compose up -d
```

## 🖥️ VPS/Server Deployment (5-10 minutes)

### With PM2 Process Manager
```bash
# Install PM2
npm install -g pm2

# Deploy
./deploy.sh pm2

# Monitor
pm2 monit
```

## 🔧 Environment Setup

### Required Environment Variables
Create `.env` file:
```bash
NODE_ENV=production
PORT=3000
AWS_REGION=eu-central-1
```

### AWS Credentials
Users will need to configure their own AWS credentials:
```bash
aws configure
```

## 🌍 Custom Domain (Optional)

### For Vercel
```bash
vercel domains add your-domain.com
```

### For Netlify
```bash
netlify domains:add your-domain.com
```

## 📊 Post-Deployment

1. **Test the deployment:** Visit your live URL
2. **Check health endpoint:** `https://your-app.com/api/health`
3. **Monitor performance:** Use platform-specific monitoring
4. **Set up alerts:** Configure uptime monitoring

## 🆘 Troubleshooting

### Common Issues:
- **Build fails:** Check Node.js version (requires 18+)
- **AWS not working:** Users need to run `aws configure`
- **Port issues:** Ensure PORT environment variable is set
- **Memory issues:** Increase memory limits in platform settings

### Debug Commands:
```bash
# Check logs (PM2)
pm2 logs ai-terraform-generator

# Check Docker logs
docker logs ai-terraform-generator

# Test locally
npm start
```

## 💡 Pro Tips

1. **Use Vercel** for the easiest deployment with great performance
2. **Use Docker** for consistent environments across platforms
3. **Use PM2** for production VPS deployments
4. **Set up monitoring** immediately after deployment
5. **Configure custom domain** for professional appearance

## 🔗 What's Next?

After deployment:
- Share your live URL with others
- Set up monitoring and alerts
- Consider adding authentication for enterprise use
- Scale based on usage patterns
- Add custom branding/domain

Your AI Terraform Generator is now ready to help developers worldwide! 🌍✨