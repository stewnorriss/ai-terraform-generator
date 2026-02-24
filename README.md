# 🏗️ AI Terraform Generator

A professional, AI-powered web application that converts natural language descriptions into production-ready Terraform infrastructure code with comprehensive documentation and beautiful syntax highlighting.

## ✨ Features

- **🤖 AI-Powered Generation**: Advanced pattern recognition for intelligent Terraform code generation
- **🚀 Quick Templates**: 8 pre-built templates for common infrastructure patterns
- **📚 Comprehensive Documentation**: Detailed explanations of every resource and deployment instructions
- **🎨 Beautiful Syntax Highlighting**: GitHub-style code display with line numbers
- **☁️ AWS Integration**: Real-time AWS account connection and region detection
- **📱 Responsive Design**: Stunning UI that works on all devices
- **⚡ Modern Performance**: Built with AWS SDK v3 for optimal performance

## 🛠️ Technology Stack

- **Backend**: Node.js + Express
- **AWS SDK**: v3 (latest) with modular imports
- **Frontend**: Vanilla JavaScript with modern CSS
- **Styling**: Glass morphism design with advanced animations
- **AWS Services**: STS, EC2, Bedrock Runtime

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- AWS CLI configured with credentials
- AWS account with appropriate permissions

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd terraform

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

### AWS Configuration

Configure your AWS credentials using one of these methods:

```bash
# Option 1: AWS CLI
aws configure

# Option 2: Environment Variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=eu-central-1

# Option 3: IAM Roles (for EC2 instances)
# Attach an IAM role with required permissions
```

### Required AWS Permissions

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sts:GetCallerIdentity",
                "ec2:DescribeRegions",
                "ec2:DescribeImages",
                "bedrock:InvokeModel"
            ],
            "Resource": "*"
        }
    ]
}
```

## 🎯 Usage

### Quick Templates

Choose from 8 professional templates:

- 🌐 **Static Website** - S3 + CloudFront + Route53 + SSL
- 💻 **Web Application** - ALB + Auto Scaling + RDS + VPC  
- 🗄️ **Database Setup** - RDS with Multi-AZ + encryption
- ⚡ **Serverless API** - API Gateway + Lambda + DynamoDB
- 🔒 **VPC Network** - Complete networking with security
- ⚖️ **Load Balancer** - ALB with health checks + SSL
- 📦 **Container App** - ECS Fargate + ECR + service discovery
- 🔄 **Data Pipeline** - S3 + Lambda + SQS + analytics

### Custom Descriptions

Describe your infrastructure in natural language:

```
Create a scalable web application with:
- Application Load Balancer for high availability
- Auto Scaling Group of EC2 instances
- RDS MySQL database with Multi-AZ deployment
- VPC with public and private subnets
- Security groups for proper access control
```

### Generated Output

The application provides:

1. **Syntax-highlighted Terraform code** with line numbers
2. **Comprehensive documentation** explaining each resource
3. **Step-by-step deployment instructions**
4. **Best practices and recommendations**
5. **Download functionality** for immediate use

## 🏗️ Architecture

### AWS SDK v3 Migration

This application uses the latest AWS SDK v3 with several advantages:

- **Modular imports**: Only load required services
- **Better performance**: Smaller bundle sizes and faster execution
- **Modern JavaScript**: Native Promise support and async/await
- **Tree shaking**: Optimized builds with unused code elimination

### Key Components

```javascript
// AWS SDK v3 Clients
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { EC2Client, DescribeRegionsCommand } = require('@aws-sdk/client-ec2');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
```

### API Endpoints

- `GET /api/health` - Health check and version info
- `GET /api/aws-status` - AWS connection status
- `GET /api/regions` - Available AWS regions
- `GET /api/ami/:region` - Latest AMI for region
- `POST /api/generate-terraform` - Generate Terraform code

## 🎨 UI Features

### Modern Design

- **Glass morphism effects** with backdrop blur
- **Gradient animations** and smooth transitions
- **Interactive hover effects** throughout the interface
- **Professional code editor** appearance
- **Responsive grid layouts** for all screen sizes

### Accessibility

- **Keyboard navigation** support
- **Focus indicators** for all interactive elements
- **High contrast** color schemes
- **Screen reader** friendly markup
- **Mobile-optimized** touch targets

## 🔧 Development

### Project Structure

```
terraform/
├── server.js              # Express server with AWS SDK v3
├── script.js              # Frontend JavaScript
├── styles.css             # Modern CSS with animations
├── index.html             # Main HTML structure
├── package.json           # Dependencies and scripts
└── README.md              # Documentation
```

### Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server
npm test           # Run tests (placeholder)
```

### Environment Variables

```bash
AWS_DEFAULT_REGION=eu-central-1    # Default AWS region
PORT=3000                          # Server port (optional)
```

## 🚀 Deployment

### Local Development

```bash
npm install
npm start
```

### Production Deployment

1. **AWS EC2**: Deploy on EC2 with IAM role
2. **AWS ECS**: Containerized deployment
3. **AWS Lambda**: Serverless with API Gateway
4. **Heroku**: Simple cloud deployment

### Docker Support

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Performance

### AWS SDK v3 Benefits

- **50% smaller** bundle size compared to v2
- **Faster startup** time with modular imports
- **Better memory** usage with tree shaking
- **Native TypeScript** support
- **Modern JavaScript** features

### Optimizations

- **Hardware acceleration** for animations
- **Lazy loading** for documentation
- **Efficient DOM** manipulation
- **Optimized CSS** with will-change properties
- **Compressed assets** for faster loading

## 🔒 Security

### Best Practices

- **No credentials** in client-side code
- **Server-side** AWS API calls only
- **Input validation** for all user inputs
- **HTTPS enforcement** in production
- **CSP headers** for XSS protection

### AWS Security

- **IAM roles** preferred over access keys
- **Least privilege** principle for permissions
- **VPC endpoints** for private API access
- **CloudTrail logging** for audit trails

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

### Common Issues

**AWS SDK Deprecation Warnings**: 
- ✅ **Resolved**: Migrated to AWS SDK v3

**Bedrock Access Denied**:
- Enable Bedrock model access in AWS Console
- Ensure proper IAM permissions

**Connection Issues**:
- Verify AWS credentials configuration
- Check network connectivity to AWS

### Getting Help

- Check the [AWS SDK v3 Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- Review [Terraform Documentation](https://www.terraform.io/docs)
- Open an issue for bugs or feature requests

---

**Built with ❤️ using AWS SDK v3 and modern web technologies**