const express = require('express');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { EC2Client, DescribeRegionsCommand, DescribeImagesCommand } = require('@aws-sdk/client-ec2');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const app = express();
const port = 3000;

// Configure AWS SDK v3 clients
const defaultRegion = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'eu-central-1';

// AWS credentials configuration - explicit for Vercel
const awsConfig = {
    region: defaultRegion
};

// Only add credentials if they exist
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    awsConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
    console.log('✅ AWS credentials configured from environment variables');
} else {
    console.log('⚠️ AWS credentials not found in environment variables');
}

const stsClient = new STSClient(awsConfig);
const ec2Client = new EC2Client(awsConfig);
const bedrockClient = new BedrockRuntimeClient(awsConfig);

// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' fonts.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; connect-src 'self';");
    next();
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '2.0.0',
        features: [
            'AWS SDK v3',
            'Template System',
            'Syntax Highlighting',
            'Documentation Generation',
            'Bedrock AI Integration'
        ],
        timestamp: new Date().toISOString()
    });
});

// AWS connection check endpoint
app.get('/api/aws-status', async (req, res) => {
    try {
        // Log environment variables (without exposing secrets)
        console.log('Environment check:', {
            hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
            hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
            hasRegion: !!process.env.AWS_DEFAULT_REGION,
            region: process.env.AWS_DEFAULT_REGION || 'not set'
        });
        
        const command = new GetCallerIdentityCommand({});
        const identity = await stsClient.send(command);
        res.json({
            connected: true,
            account: identity.Account,
            region: defaultRegion
        });
    } catch (error) {
        console.error('AWS Status Error:', error.message);
        res.json({
            connected: false,
            error: error.message
        });
    }
});

// Get AWS regions endpoint
app.get('/api/regions', async (req, res) => {
    try {
        const command = new DescribeRegionsCommand({});
        const regions = await ec2Client.send(command);
        res.json(regions.Regions.map(r => r.RegionName));
    } catch (error) {
        res.json(['us-west-2', 'us-east-1', 'eu-west-1', 'eu-central-1']);
    }
});

// Get latest AMI endpoint
app.get('/api/ami/:region', async (req, res) => {
    try {
        const region = req.params.region;
        const regionalEc2Client = new EC2Client({ region: region });
        
        const command = new DescribeImagesCommand({
            Owners: ['amazon'],
            Filters: [
                { Name: 'name', Values: ['amzn2-ami-hvm-*'] },
                { Name: 'architecture', Values: ['x86_64'] },
                { Name: 'state', Values: ['available'] }
            ]
        });
        
        const images = await regionalEc2Client.send(command);
        
        const sortedImages = images.Images.sort((a, b) => 
            new Date(b.CreationDate) - new Date(a.CreationDate)
        );
        
        res.json({
            ami: sortedImages[0]?.ImageId || 'ami-0c02fb55956c7d316',
            name: sortedImages[0]?.Name || 'Amazon Linux 2'
        });
    } catch (error) {
        res.json({
            ami: 'ami-0c02fb55956c7d316',
            name: 'Amazon Linux 2 (default)'
        });
    }
});

// Bedrock AI endpoint for intelligent Terraform generation
app.post('/api/generate-terraform', async (req, res) => {
    try {
        const { description, region } = req.body;
        const targetRegion = region || 'eu-central-1';
        
        const regionalBedrockClient = new BedrockRuntimeClient({ region: targetRegion });
        
        const prompt = `You are an expert AWS infrastructure architect and Terraform specialist. 
Generate Terraform code based on this natural language description: "${description}"

Requirements:
- Use AWS provider version ~> 5.0
- Set region to ${targetRegion}
- Include proper resource naming and tags
- Add comments explaining each resource
- Follow Terraform best practices
- Include any necessary data sources
- Use appropriate instance types and configurations
- Include security groups, IAM roles if needed

Respond with valid Terraform HCL code only. Do not include explanations outside of code comments.`;

        const modelInput = {
            modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 4000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        };

        const command = new InvokeModelCommand(modelInput);
        const response = await regionalBedrockClient.send(command);
        
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const terraformCode = responseBody.content[0].text;

        // Generate explanation using Bedrock
        const explanationPrompt = `Explain what this Terraform infrastructure does in simple terms for a developer:

${terraformCode}

Provide a clear, concise explanation of:
1. What AWS resources are being created
2. How they work together
3. What the infrastructure will accomplish
4. Any important security or cost considerations

Keep it under 200 words and use bullet points where helpful.`;

        const explanationInput = {
            modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: explanationPrompt
                    }
                ]
            })
        };

        const explanationCommand = new InvokeModelCommand(explanationInput);
        const explanationResponse = await regionalBedrockClient.send(explanationCommand);
        
        const explanationBody = JSON.parse(new TextDecoder().decode(explanationResponse.body));
        const explanation = explanationBody.content[0].text;

        res.json({
            terraform: terraformCode,
            explanation: explanation,
            region: targetRegion,
            generatedBy: 'bedrock'
        });

    } catch (error) {
        console.error('Bedrock error:', error);
        
        // Fallback to pattern-based generation
        res.json({
            error: 'Bedrock unavailable, using fallback generation',
            terraform: generateFallbackTerraform(req.body.description, req.body.region),
            explanation: 'Generated using fallback patterns. For AI-powered generation, ensure Bedrock access is configured.',
            region: req.body.region || 'eu-central-1',
            generatedBy: 'fallback'
        });
    }
});

// Fallback Terraform generation
function generateFallbackTerraform(description, region = 'eu-central-1') {
    const lowerDesc = description.toLowerCase();
    let resources = [];
    
    if (lowerDesc.includes('s3') || lowerDesc.includes('bucket')) {
        resources.push(`resource "aws_s3_bucket" "main" {
  bucket = "my-terraform-bucket-\${random_string.bucket_suffix.result}"
  
  tags = {
    Name = "Main Bucket"
    Environment = "dev"
  }
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}`);
    }
    
    if (lowerDesc.includes('ec2') || lowerDesc.includes('instance') || lowerDesc.includes('server')) {
        resources.push(`resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  
  tags = {
    Name = "Web Server"
    Environment = "dev"
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*"]
  }
}`);
    }
    
    const providerConfig = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${region}"
}

`;
    
    return providerConfig + resources.join('\n\n');
}

app.listen(port, () => {
    console.log(`🚀 AI Terraform Generator server running at http://localhost:${port}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🔧 Using AWS SDK v3 with region: ${defaultRegion}`);
    console.log(`✨ Features: Templates, Documentation, Syntax Highlighting, AWS Integration`);
});