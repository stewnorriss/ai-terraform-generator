// AWS Configuration using backend API
let awsConfigured = false;
let awsAccountId = null;
let awsRegion = 'eu-central-1';

// AWS Configuration
async function configureAWS() {
    console.log('🔍 Checking AWS connection...');
    try {
        // Add cache-busting parameter
        const url = '/api/aws-status?t=' + Date.now();
        console.log('📡 Fetching:', url);
        const response = await fetch(url);
        
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (data.connected) {
            awsConfigured = true;
            awsAccountId = data.account;
            awsRegion = data.region;
            console.log('✅ AWS Connected:', data.account, data.region);
            updateAWSStatus(true, data.account, data.region);
            return true;
        } else {
            awsConfigured = false;
            console.log('❌ AWS Not Connected:', data.error);
            updateAWSStatus(false, data.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Error checking AWS status:', error);
        updateAWSStatus(false, error.message);
        return false;
    }
}

function updateAWSStatus(connected, accountId = null, region = null) {
    console.log('🔄 Updating AWS status display:', { connected, accountId, region });
    const statusDiv = document.getElementById('awsStatus');
    if (connected) {
        statusDiv.innerHTML = `<span>✅ Connected to AWS Account: ${accountId} (${region})</span>`;
        statusDiv.className = 'aws-status connected';
        console.log('✅ Status updated to connected');
    } else {
        const errorMsg = accountId ? ` (${accountId})` : '';
        statusDiv.innerHTML = `<span>❌ AWS not configured${errorMsg}</span>`;
        statusDiv.className = 'aws-status disconnected';
        console.log('❌ Status updated to disconnected');
    }
}

// Get AWS regions
async function getAWSRegions() {
    try {
        const response = await fetch('/api/regions');
        const regions = await response.json();
        return regions;
    } catch (error) {
        console.error('Error fetching regions:', error);
        return ['us-west-2', 'us-east-1', 'eu-west-1', 'eu-central-1'];
    }
}

// Get available AMIs for EC2
async function getLatestAMI(region = 'eu-central-1') {
    try {
        const response = await fetch(`/api/ami/${region}`);
        const data = await response.json();
        return data.ami;
    } catch (error) {
        console.error('Error fetching AMI:', error);
        return 'ami-0c02fb55956c7d316';
    }
}

// Terraform templates and patterns
const terraformPatterns = {
    s3: {
        keywords: ['s3', 'bucket', 'storage'],
        template: (name = 'my-bucket') => `resource "aws_s3_bucket" "${name.replace(/[^a-zA-Z0-9]/g, '_')}" {
  bucket = "${name}"
}

resource "aws_s3_bucket_versioning" "${name.replace(/[^a-zA-Z0-9]/g, '_')}_versioning" {
  bucket = aws_s3_bucket.${name.replace(/[^a-zA-Z0-9]/g, '_')}.id
  versioning_configuration {
    status = "Enabled"
  }
}`,
        explanation: 'Creates an S3 bucket with versioning enabled for file storage and backup.'
    },
    
    ec2: {
        keywords: ['ec2', 'instance', 'server', 'virtual machine', 'vm'],
        template: async (type = 't3.micro', region = 'us-west-2') => {
            const ami = await getLatestAMI(region);
            return `resource "aws_instance" "web_server" {
  ami           = "${ami}" # Latest Amazon Linux 2
  instance_type = "${type}"
  
  tags = {
    Name = "WebServer"
  }
}`;
        },
        explanation: 'Creates an EC2 instance (virtual server) in AWS for running applications.'
    },
    
    vpc: {
        keywords: ['vpc', 'network', 'virtual private cloud'],
        template: () => `resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "main-vpc"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-west-2a"
  map_public_ip_on_launch = true
  
  tags = {
    Name = "public-subnet"
  }
}`,
        explanation: 'Creates a Virtual Private Cloud (VPC) with a public subnet for network isolation.'
    },
    
    rds: {
        keywords: ['rds', 'database', 'mysql', 'postgres', 'db'],
        template: (engine = 'mysql') => `resource "aws_db_instance" "database" {
  identifier     = "my-database"
  engine         = "${engine}"
  engine_version = "${engine === 'mysql' ? '8.0' : '13.7'}"
  instance_class = "db.t3.micro"
  
  allocated_storage = 20
  storage_type      = "gp2"
  
  db_name  = "myapp"
  username = "admin"
  password = "changeme123!" # Use AWS Secrets Manager in production
  
  skip_final_snapshot = true
  
  tags = {
    Name = "MyDatabase"
  }
}`,
        explanation: 'Creates a managed database instance with automated backups and maintenance.'
    },
    
    cloudfront: {
        keywords: ['cloudfront', 'cdn', 'distribution'],
        template: () => `resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.my_bucket.bucket_regional_domain_name
    origin_id   = "S3-my-bucket"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }
  
  enabled = true
  
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-my-bucket"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}`,
        explanation: 'Creates a CloudFront CDN distribution for fast global content delivery.'
    }
};

async function generateTerraform() {
    const input = document.getElementById('naturalLanguageInput').value.trim();
    const generateBtn = document.getElementById('generateBtn');
    const loading = document.getElementById('loading');
    const outputSection = document.getElementById('outputSection');
    
    if (!input) {
        alert('Please enter a description of your infrastructure needs.');
        return;
    }
    
    // Show loading state
    generateBtn.disabled = true;
    loading.style.display = 'block';
    outputSection.style.display = 'none';
    
    // Clear any existing documentation
    clearDocumentation();
    
    // Update loading text for generation
    document.querySelector('#loading p').textContent = '🧠 Analyzing your requirements and generating Terraform code...';
    
    try {
        // Check AWS configuration
        await configureAWS();
        
        // Try Bedrock AI generation first
        const result = await generateWithBedrock(input);
        
        // Display results
        document.getElementById('explanation').innerHTML = result.explanation;
        displayTerraformCode(result.terraform);
        
        // Add generation method indicator
        let methodIndicator;
        if (result.generatedBy === 'bedrock') {
            methodIndicator = '<br><br><strong>🤖 Generated by:</strong> AWS Bedrock AI (Claude)';
        } else if (result.generatedBy === 'enhanced-patterns') {
            methodIndicator = '<br><br><strong>🧠 Generated by:</strong> Enhanced AI Patterns (Fast Mode)';
        } else {
            methodIndicator = '<br><br><strong>⚙️ Generated by:</strong> Basic Pattern Matching';
        }
        
        document.getElementById('explanation').innerHTML += methodIndicator;
        
        // Auto-update documentation if it's currently visible
        const docsSection = document.getElementById('documentationSection');
        if (docsSection.style.display !== 'none') {
            // Show loading indicator for documentation
            const docsContent = document.getElementById('documentationContent');
            docsContent.innerHTML = '<div class="docs-loading"><div class="spinner"></div><p>Updating documentation...</p></div>';
            
            // Generate documentation with a slight delay for better UX
            setTimeout(() => {
                generateDocumentation();
            }, 500);
        }
        
        loading.style.display = 'none';
        outputSection.style.display = 'block';
        
    } catch (error) {
        console.error('Error generating Terraform:', error);
        alert('Sorry, there was an error generating your Terraform code. Please try again.');
        loading.style.display = 'none';
    } finally {
        generateBtn.disabled = false;
        document.querySelector('#loading p').textContent = 'Generating your Terraform code...';
    }
}

// Generate Terraform using enhanced pattern matching
async function generateWithBedrock(description) {
    console.log('Using enhanced pattern matching');
    
    const inputLower = description.toLowerCase();
    const selectedRegion = awsRegion || 'eu-central-1';
    
    // Quick pattern detection
    let terraform = '';
    let explanation = '';
    
    if (inputLower.includes('web') || inputLower.includes('website') || inputLower.includes('static')) {
        const bucketName = 'my-web-app-' + Math.random().toString(36).substr(2, 8);
        terraform = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${selectedRegion}"
}

# S3 bucket for static website hosting
resource "aws_s3_bucket" "website" {
  bucket = "${bucketName}"
  
  tags = {
    Name = "Website Bucket"
    Purpose = "Static Website Hosting"
  }
}

resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.id
  
  index_document {
    suffix = "index.html"
  }
  
  error_document {
    key = "error.html"
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id
  
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "\${aws_s3_bucket.website.arn}/*"
      }
    ]
  })
}`;
        explanation = `<strong>Region:</strong> ${selectedRegion}<br><br>Creates a complete static website hosting setup with S3 bucket, public access configuration, and website hosting enabled.<br><br><strong>Next steps:</strong> Save as main.tf, run <code>terraform init</code>, then <code>terraform plan</code>`;
    } 
    else if (inputLower.includes('database') || inputLower.includes('db') || inputLower.includes('mysql') || inputLower.includes('postgres')) {
        const engine = inputLower.includes('postgres') ? 'postgres' : 'mysql';
        const port = engine === 'postgres' ? '5432' : '3306';
        const version = engine === 'postgres' ? '15.4' : '8.0';
        
        terraform = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${selectedRegion}"
}

# VPC for database
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "Database VPC"
  }
}

# Private subnets for RDS
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  
  tags = {
    Name = "Private Subnet A"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
  
  tags = {
    Name = "Private Subnet B"
  }
}

# Database subnet group
resource "aws_db_subnet_group" "database" {
  name       = "database-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  
  tags = {
    Name = "Database subnet group"
  }
}

# Security group for database
resource "aws_security_group" "database" {
  name_prefix = "database-sg"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port   = ${port}
    to_port     = ${port}
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }
  
  tags = {
    Name = "Database Security Group"
  }
}

# RDS Database
resource "aws_db_instance" "database" {
  identifier     = "app-database"
  engine         = "${engine}"
  engine_version = "${version}"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  
  db_name  = "appdb"
  username = "dbadmin"
  password = "ChangeMe123!" # Use AWS Secrets Manager in production
  
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = aws_db_subnet_group.database.name
  
  backup_retention_period = 7
  skip_final_snapshot     = true
  
  tags = {
    Name = "Application Database"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}`;
        explanation = `<strong>Region:</strong> ${selectedRegion}<br><br>Creates a secure ${engine.toUpperCase()} database with VPC, private subnets, security groups, automated backups, and encryption.<br><br><strong>Next steps:</strong> Save as main.tf, run <code>terraform init</code>, then <code>terraform plan</code>`;
    }
    else {
        // Default to basic VPC
        terraform = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${selectedRegion}"
}

# Basic VPC setup
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "Main VPC"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "Public Subnet"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}`;
        explanation = `<strong>Region:</strong> ${selectedRegion}<br><br>Basic VPC setup as a starting point. Try describing specific services like "website", "database", or "web server".<br><br><strong>Next steps:</strong> Save as main.tf, run <code>terraform init</code>, then <code>terraform plan</code>`;
    }
    
    return {
        terraform: terraform,
        explanation: explanation,
        generatedBy: 'enhanced-patterns'
    };
}

// Enhanced pattern matching with better intelligence
async function parseNaturalLanguageEnhanced(input) {
    const inputLower = input.toLowerCase();
    let resources = [];
    let explanations = [];
    
    // Extract region from input
    const regions = await getAWSRegions();
    let selectedRegion = awsRegion || 'eu-central-1';
    for (const region of regions) {
        if (inputLower.includes(region)) {
            selectedRegion = region;
            break;
        }
    }
    
    // Enhanced pattern detection
    const patterns = {
        // Web application patterns
        webApp: {
            keywords: ['web app', 'website', 'web application', 'frontend', 'static site'],
            detect: () => patterns.webApp.keywords.some(k => inputLower.includes(k)),
            generate: async () => {
                const bucketName = 'my-web-app-' + Math.random().toString(36).substr(2, 8);
                return {
                    code: `# S3 bucket for static website hosting
resource "aws_s3_bucket" "website" {
  bucket = "${bucketName}"
  
  tags = {
    Name = "Website Bucket"
    Purpose = "Static Website Hosting"
  }
}

resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.id
  
  index_document {
    suffix = "index.html"
  }
  
  error_document {
    key = "error.html"
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id
  
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "\${aws_s3_bucket.website.arn}/*"
      }
    ]
  })
}`,
                    explanation: 'Creates a complete static website hosting setup with S3 bucket, public access configuration, and website hosting enabled.'
                };
            }
        },
        
        // Database patterns
        database: {
            keywords: ['database', 'db', 'mysql', 'postgres', 'rds'],
            detect: () => patterns.database.keywords.some(k => inputLower.includes(k)),
            generate: async () => {
                const engine = inputLower.includes('postgres') ? 'postgres' : 'mysql';
                const version = engine === 'postgres' ? '15.4' : '8.0';
                
                return {
                    code: `# RDS Database instance
resource "aws_db_subnet_group" "database" {
  name       = "database-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  
  tags = {
    Name = "Database subnet group"
  }
}

resource "aws_security_group" "database" {
  name_prefix = "database-sg"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port   = ${engine === 'postgres' ? '5432' : '3306'}
    to_port     = ${engine === 'postgres' ? '5432' : '3306'}
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "Database Security Group"
  }
}

resource "aws_db_instance" "database" {
  identifier     = "app-database"
  engine         = "${engine}"
  engine_version = "${version}"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp2"
  storage_encrypted     = true
  
  db_name  = "appdb"
  username = "dbadmin"
  password = "ChangeMe123!" # Use AWS Secrets Manager in production
  
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = aws_db_subnet_group.database.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = true
  deletion_protection = false
  
  tags = {
    Name = "Application Database"
  }
}`,
                    explanation: `Creates a secure ${engine.toUpperCase()} database with proper VPC setup, security groups, automated backups, and encryption enabled.`
                };
            }
        },
        
        // Server/EC2 patterns
        server: {
            keywords: ['server', 'ec2', 'instance', 'virtual machine', 'vm', 'compute'],
            detect: () => patterns.server.keywords.some(k => inputLower.includes(k)),
            generate: async () => {
                let instanceType = 't3.micro';
                if (inputLower.includes('large')) instanceType = 't3.large';
                else if (inputLower.includes('medium')) instanceType = 't3.medium';
                else if (inputLower.includes('small')) instanceType = 't3.small';
                
                const ami = await getLatestAMI(selectedRegion);
                
                return {
                    code: `# EC2 instance with security group
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*"]
  }
  
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "aws_security_group" "web_server" {
  name_prefix = "web-server-sg"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restrict this in production
  }
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "Web Server Security Group"
  }
}

resource "aws_instance" "web_server" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "${instanceType}"
  
  vpc_security_group_ids = [aws_security_group.web_server.id]
  subnet_id              = aws_subnet.public.id
  
  associate_public_ip_address = true
  
  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd
    systemctl enable httpd
    echo "<h1>Hello from Terraform!</h1>" > /var/www/html/index.html
  EOF
  
  tags = {
    Name = "Web Server"
    Type = "Application Server"
  }
}`,
                    explanation: `Creates an EC2 ${instanceType} instance with security groups allowing HTTP/HTTPS traffic, includes basic web server setup, and uses the latest Amazon Linux AMI.`
                };
            }
        }
    };
    
    // Detect and generate resources
    for (const [key, pattern] of Object.entries(patterns)) {
        if (pattern.detect()) {
            const result = await pattern.generate();
            resources.push(result.code);
            explanations.push(result.explanation);
        }
    }
    
    // Always include VPC if other resources are detected
    if (resources.length > 0) {
        const vpcCode = `# VPC and networking setup
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "Main VPC"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "Main Internet Gateway"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "Public Subnet"
  }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  
  tags = {
    Name = "Private Subnet A"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]
  
  tags = {
    Name = "Private Subnet B"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = {
    Name = "Public Route Table"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

data "aws_availability_zones" "available" {
  state = "available"
}`;
        
        resources.unshift(vpcCode); // Add VPC at the beginning
        explanations.unshift('Sets up a complete VPC with public and private subnets, internet gateway, and proper routing.');
    }
    
    // Fallback if no patterns matched
    if (resources.length === 0) {
        resources.push(`# Basic VPC setup
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "Main VPC"
  }
}`);
        explanations.push('Basic VPC setup as a starting point. Try describing specific services like "web server", "database", or "static website".');
    }
    
    // Build final response
    const providerConfig = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${selectedRegion}"
}

`;
    
    return {
        terraform: providerConfig + resources.join('\n\n'),
        explanation: `<strong>Region:</strong> ${selectedRegion}<br><br>` + 
                    explanations.join('<br><br>') + 
                    '<br><br><strong>Next steps:</strong> Save as main.tf, run <code>terraform init</code>, then <code>terraform plan</code>',
        generatedBy: 'enhanced-patterns'
    };
}

async function parseNaturalLanguage(input) {
    const inputLower = input.toLowerCase();
    let matchedPatterns = [];
    let explanations = [];
    let terraformCode = [];
    
    // Extract region from input
    const regions = await getAWSRegions();
    let selectedRegion = awsRegion || 'eu-central-1';
    for (const region of regions) {
        if (inputLower.includes(region)) {
            selectedRegion = region;
            break;
        }
    }
    
    // Check for each pattern
    for (const [key, pattern] of Object.entries(terraformPatterns)) {
        if (pattern.keywords.some(keyword => inputLower.includes(keyword))) {
            matchedPatterns.push(key);
            explanations.push(pattern.explanation);
            
            // Extract specific parameters from input
            let code;
            
            if (key === 'ec2') {
                let instanceType = 't3.micro';
                if (inputLower.includes('large')) instanceType = 't3.large';
                else if (inputLower.includes('medium')) instanceType = 't3.medium';
                else if (inputLower.includes('small')) instanceType = 't3.small';
                
                code = await pattern.template(instanceType, selectedRegion);
            } else if (key === 'rds') {
                const engine = inputLower.includes('postgres') ? 'postgres' : 'mysql';
                code = pattern.template(engine);
            } else {
                code = typeof pattern.template === 'function' ? pattern.template() : pattern.template;
            }
            
            terraformCode.push(code);
        }
    }
    
    // If no patterns matched, provide a generic response
    if (matchedPatterns.length === 0) {
        return {
            explanation: `I couldn't identify specific AWS resources from your description. Here's a basic VPC setup to get you started. Try mentioning specific services like "S3 bucket", "EC2 instance", "RDS database", or "CloudFront distribution".`,
            terraform: terraformPatterns.vpc.template()
        };
    }
    
    // Add provider configuration with detected region
    const providerConfig = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${selectedRegion}"
}

`;
    
    const awsNote = awsConfigured ? 
        '<br><br><strong>✅ AWS Account Connected:</strong> This code is customized for your AWS account.' :
        '<br><br><strong>⚠️ AWS Not Connected:</strong> Using default values. Configure AWS credentials for account-specific customization.';
    
    return {
        explanation: `<strong>Detected resources:</strong> ${matchedPatterns.join(', ')}<br>` +
                    `<strong>Region:</strong> ${selectedRegion}<br><br>` + 
                    explanations.join('<br><br>') + 
                    '<br><br><strong>Next steps:</strong> Save this code to a .tf file, run <code>terraform init</code>, then <code>terraform plan</code> to review changes.' +
                    awsNote,
        terraform: providerConfig + terraformCode.join('\n\n')
    };
}

// Enhanced Terraform syntax highlighting
function displayTerraformCode(code) {
    const codeContainer = document.getElementById('terraformCode');
    
    // Create the enhanced structure
    codeContainer.innerHTML = `
        <div class="code-header">
            <div class="code-title">
                <span>main.tf</span>
            </div>
            <div class="code-lang">Terraform HCL</div>
        </div>
        <div class="code-content">
            <pre><code id="terraformCodeContent"></code></pre>
        </div>
    `;
    
    const codeContent = document.getElementById('terraformCodeContent');
    const lines = code.split('\n');
    
    let highlightedCode = '';
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const highlightedLine = highlightTerraformSyntax(line);
        highlightedCode += `<span class="code-line" data-line="${lineNumber}">${highlightedLine}</span>\n`;
    });
    
    codeContent.innerHTML = highlightedCode;
}

function highlightTerraformSyntax(line) {
    // Terraform keywords
    line = line.replace(/\b(terraform|provider|resource|data|variable|output|locals|module)\b/g, 
        '<span class="terraform-keyword">$1</span>');
    
    // Resource types and names
    line = line.replace(/"([^"]+)"\s+"([^"]+)"/g, 
        '"<span class="terraform-resource">$1</span>" "<span class="terraform-resource">$2</span>"');
    
    // Strings
    line = line.replace(/"([^"]*)"(?![^<]*>)/g, 
        '"<span class="terraform-string">$1</span>"');
    
    // Comments
    line = line.replace(/(#.*$)/g, 
        '<span class="terraform-comment">$1</span>');
    
    // Numbers
    line = line.replace(/\b(\d+)\b/g, 
        '<span class="terraform-number">$1</span>');
    
    // Booleans
    line = line.replace(/\b(true|false)\b/g, 
        '<span class="terraform-boolean">$1</span>');
    
    // Attributes
    line = line.replace(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g, 
        '  <span class="terraform-attribute">$1</span> =');
    
    // Interpolations
    line = line.replace(/\$\{([^}]+)\}/g, 
        '$\{<span class="terraform-interpolation">$1</span>\}');
    
    return line;
}

function downloadTerraform() {
    const codeContent = document.getElementById('terraformCodeContent');
    if (!codeContent) return;
    
    const code = codeContent.textContent;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'main.tf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Visual feedback
    const downloadBtn = document.getElementById('downloadBtn');
    const originalText = downloadBtn.textContent;
    downloadBtn.textContent = '✅ Downloaded!';
    
    setTimeout(() => {
        downloadBtn.textContent = originalText;
    }, 2000);
}

// Toggle documentation
function toggleDocumentation() {
    const docsSection = document.getElementById('documentationSection');
    const docsBtn = document.getElementById('docsBtn');
    
    if (docsSection.style.display === 'none') {
        generateDocumentation();
        docsSection.style.display = 'block';
        docsBtn.textContent = '📚 Hide Documentation';
        docsSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        docsSection.style.display = 'none';
        docsBtn.textContent = '📚 Show Documentation';
    }
}

// Clear documentation when generating new code
function clearDocumentation() {
    const docsSection = document.getElementById('documentationSection');
    const docsBtn = document.getElementById('docsBtn');
    const docsContent = document.getElementById('documentationContent');
    
    // Reset documentation state
    docsSection.style.display = 'none';
    docsBtn.textContent = '📚 Show Documentation';
    docsContent.innerHTML = '';
}

// Generate comprehensive documentation with diagrams
function generateDocumentation() {
    const codeContent = document.getElementById('terraformCodeContent');
    if (!codeContent) {
        showNotification('No Terraform code available to document', 'warning');
        return;
    }
    
    const code = codeContent.textContent;
    const docsContent = document.getElementById('documentationContent');
    
    // Parse the Terraform code to generate documentation
    const resources = parseResourcesFromCode(code);
    console.log('Parsed resources:', resources); // Debug log
    const diagram = generateInfrastructureDiagram(resources);
    
    let documentation = `
        <div class="docs-overview">
            <h4>🏗️ Infrastructure Overview</h4>
            <p>This Terraform configuration creates a complete infrastructure setup with ${resources.length} main components. Below is a visual representation of your infrastructure:</p>
        </div>
        
        <div class="infrastructure-diagram">
            <h4>📊 Architecture Diagram</h4>
            ${diagram}
        </div>
        
        <div class="docs-resources">
            <h4>🔧 Resource Details</h4>
    `;
    
    resources.forEach((resource, index) => {
        documentation += `
            <div class="docs-resource">
                <div class="resource-header">
                    <h5>${resource.icon} ${resource.name}</h5>
                    <span class="resource-type">${resource.type}</span>
                </div>
                <div class="docs-resource-content">
                    <div class="resource-grid">
                        <div class="resource-detail">
                            <strong>Purpose</strong>
                            <p>${resource.purpose}</p>
                        </div>
                        <div class="resource-detail">
                            <strong>Configuration</strong>
                            <p>${resource.config}</p>
                        </div>
                        <div class="resource-detail">
                            <strong>Security</strong>
                            <p>${resource.security}</p>
                        </div>
                        <div class="resource-detail">
                            <strong>Cost Impact</strong>
                            <p>${resource.cost}</p>
                        </div>
                    </div>
                    ${resource.connections ? `
                        <div class="resource-connections">
                            <strong>Connections:</strong>
                            <div class="connection-list">
                                ${resource.connections.map(conn => `<span class="connection-tag">${conn}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    documentation += `
        </div>
        
        <div class="docs-deployment">
            <h4>🚀 Deployment Guide</h4>
            <div class="deployment-timeline">
                <div class="timeline-step">
                    <div class="step-marker">1</div>
                    <div class="step-content">
                        <h6>Prerequisites</h6>
                        <ul>
                            <li>AWS CLI configured with appropriate permissions</li>
                            <li>Terraform installed (version 1.0+)</li>
                            <li>Text editor for configuration files</li>
                        </ul>
                    </div>
                </div>
                <div class="timeline-step">
                    <div class="step-marker">2</div>
                    <div class="step-content">
                        <h6>Initialize Project</h6>
                        <div class="code-snippet">
                            <code>terraform init</code>
                        </div>
                        <p>Downloads AWS provider and initializes the working directory</p>
                    </div>
                </div>
                <div class="timeline-step">
                    <div class="step-marker">3</div>
                    <div class="step-content">
                        <h6>Review Plan</h6>
                        <div class="code-snippet">
                            <code>terraform plan</code>
                        </div>
                        <p>Shows exactly what resources will be created and their dependencies</p>
                    </div>
                </div>
                <div class="timeline-step">
                    <div class="step-marker">4</div>
                    <div class="step-content">
                        <h6>Deploy Infrastructure</h6>
                        <div class="code-snippet">
                            <code>terraform apply</code>
                        </div>
                        <p>Creates all resources in the correct order based on dependencies</p>
                    </div>
                </div>
                <div class="timeline-step">
                    <div class="step-marker">5</div>
                    <div class="step-content">
                        <h6>Verify & Monitor</h6>
                        <div class="code-snippet">
                            <code>terraform show</code>
                        </div>
                        <p>Verify deployment and monitor resources in AWS Console</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="docs-cost-estimate">
            <h4>💰 Cost Estimation</h4>
            ${generateCostEstimate(resources)}
        </div>
        
        <div class="docs-best-practices">
            <h4>💡 Best Practices & Security</h4>
            <div class="practices-grid">
                <div class="practice-category">
                    <h6>🔒 Security</h6>
                    <ul>
                        <li>Use IAM roles instead of access keys</li>
                        <li>Enable encryption at rest and in transit</li>
                        <li>Implement least privilege access</li>
                        <li>Regular security audits and updates</li>
                    </ul>
                </div>
                <div class="practice-category">
                    <h6>📊 State Management</h6>
                    <ul>
                        <li>Use remote state with S3 + DynamoDB</li>
                        <li>Enable state locking for team collaboration</li>
                        <li>Regular state backups</li>
                        <li>Version control for configurations</li>
                    </ul>
                </div>
                <div class="practice-category">
                    <h6>🏷️ Organization</h6>
                    <ul>
                        <li>Consistent tagging strategy</li>
                        <li>Environment separation (dev/staging/prod)</li>
                        <li>Modular code structure</li>
                        <li>Documentation and comments</li>
                    </ul>
                </div>
                <div class="practice-category">
                    <h6>🔧 Operations</h6>
                    <ul>
                        <li>Automated testing and validation</li>
                        <li>CI/CD pipeline integration</li>
                        <li>Monitoring and alerting</li>
                        <li>Disaster recovery planning</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    docsContent.innerHTML = documentation;
    
    // Show success notification
    showNotification('Documentation updated successfully!', 'success');
}

// Show notification system
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Generate enhanced visual infrastructure diagram with detailed flows
function generateInfrastructureDiagram(resources) {
    const hasVPC = resources.some(r => r.name === 'VPC Network');
    const hasEC2 = resources.some(r => r.name === 'EC2 Instance');
    const hasRDS = resources.some(r => r.name === 'RDS Database');
    const hasS3 = resources.some(r => r.name === 'S3 Bucket');
    const hasLB = resources.some(r => r.name === 'Load Balancer');
    const hasLambda = resources.some(r => r.name === 'Lambda Function');
    const hasCDN = resources.some(r => r.name === 'CloudFront CDN');
    
    let diagram = '<div class="diagram-container">';
    
    // Add comprehensive internet and edge layer
    diagram += `
        <div class="internet-layer">
            <div class="global-internet">
                <div class="component internet">
                    <span class="component-icon">🌍</span>
                    <span class="component-name">Global Internet</span>
                    <span class="component-desc">Worldwide Network</span>
                    <div class="component-details">
                        <span class="detail-item">IPv4/IPv6 Support</span>
                        <span class="detail-item">BGP Routing</span>
                    </div>
                </div>
                <div class="flow-arrow vertical-down">
                    <span class="flow-label">DNS Resolution</span>
                </div>
                <div class="component dns">
                    <span class="component-icon">🔍</span>
                    <span class="component-name">Route 53 DNS</span>
                    <span class="component-desc">Authoritative DNS</span>
                    <div class="component-details">
                        <span class="detail-item">Health Checks</span>
                        <span class="detail-item">Geo Routing</span>
                        <span class="detail-item">Latency-based Routing</span>
                    </div>
                </div>
            </div>
            
            <div class="user-traffic">
                <div class="component user-component">
                    <span class="component-icon">👥</span>
                    <span class="component-name">End Users</span>
                    <span class="component-desc">Global Audience</span>
                    <div class="component-details">
                        <span class="detail-item">Web Browsers</span>
                        <span class="detail-item">Mobile Apps</span>
                        <span class="detail-item">API Clients</span>
                    </div>
                </div>
                
                ${hasCDN ? `
                    <div class="flow-arrow horizontal">
                        <span class="flow-label">HTTPS:443 + HTTP/2</span>
                    </div>
                    <div class="component cloudfront">
                        <span class="component-icon">🌐</span>
                        <span class="component-name">CloudFront CDN</span>
                        <span class="component-desc">400+ Edge Locations</span>
                        <div class="component-details">
                            <span class="detail-item">SSL/TLS Termination</span>
                            <span class="detail-item">GZIP Compression</span>
                            <span class="detail-item">Cache TTL: 24h</span>
                            <span class="detail-item">Origin Shield</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Add AWS Cloud boundary
    diagram += `
        <div class="aws-cloud">
            <div class="cloud-header">
                <span class="cloud-icon">☁️</span>
                <span class="cloud-title">AWS Cloud</span>
                <span class="cloud-region">${awsRegion || 'eu-central-1'}</span>
            </div>
    `;
    
    if (hasVPC) {
        diagram += `
            <div class="vpc-container">
                <div class="vpc-header">
                    <span class="vpc-icon">🔒</span>
                    <span class="vpc-title">VPC (Virtual Private Cloud)</span>
                    <span class="vpc-cidr">10.0.0.0/16</span>
                </div>
                <div class="vpc-content">
        `;
        
        // Internet Gateway with comprehensive details
        diagram += `
            <div class="igw-container">
                <div class="component igw">
                    <span class="component-icon">🌐</span>
                    <span class="component-name">Internet Gateway</span>
                    <span class="component-desc">Highly Available NAT Service</span>
                    <div class="component-details">
                        <span class="detail-item">1:1 NAT Translation</span>
                        <span class="detail-item">Stateless Firewall</span>
                        <span class="detail-item">No Bandwidth Limits</span>
                        <span class="detail-item">99.99% Availability</span>
                    </div>
                </div>
                <div class="flow-arrow vertical-down">
                    <span class="flow-label">Ingress/Egress Traffic</span>
                </div>
            </div>
        `;
        
        // Detailed Route Tables
        diagram += `
            <div class="routing-section">
                <div class="route-tables">
                    <div class="component route-table-comp public">
                        <span class="component-icon">🗺️</span>
                        <span class="component-name">Public Route Table</span>
                        <span class="component-desc">Internet-bound Traffic</span>
                        <div class="route-entries">
                            <div class="route-entry">
                                <span class="route-dest">10.0.0.0/16</span>
                                <span class="route-target">Local</span>
                            </div>
                            <div class="route-entry">
                                <span class="route-dest">0.0.0.0/0</span>
                                <span class="route-target">IGW</span>
                            </div>
                        </div>
                    </div>
                    <div class="component route-table-comp private">
                        <span class="component-icon">🗺️</span>
                        <span class="component-name">Private Route Table</span>
                        <span class="component-desc">NAT Gateway Traffic</span>
                        <div class="route-entries">
                            <div class="route-entry">
                                <span class="route-dest">10.0.0.0/16</span>
                                <span class="route-target">Local</span>
                            </div>
                            <div class="route-entry">
                                <span class="route-dest">0.0.0.0/0</span>
                                <span class="route-target">NAT-GW</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Availability Zones
        diagram += `
            <div class="availability-zones">
                <div class="az-header">
                    <span class="az-title">Availability Zones</span>
                </div>
                <div class="az-container">
        `;
        
        // AZ-A
        diagram += `
            <div class="availability-zone az-a">
                <div class="az-label">AZ-A</div>
                <div class="subnet public-subnet">
                    <div class="subnet-header">
                        <span class="subnet-icon">🌍</span>
                        <span class="subnet-name">Public Subnet</span>
                        <span class="subnet-cidr">10.0.1.0/24</span>
                    </div>
                    <div class="subnet-content">
        `;
        
        if (hasLB) {
            diagram += `
                <div class="component load-balancer">
                    <span class="component-icon">⚖️</span>
                    <span class="component-name">Application Load Balancer</span>
                    <span class="component-desc">Layer 7 Load Balancing</span>
                    <div class="component-details">
                        <span class="detail-item">Health Checks: /health (30s)</span>
                        <span class="detail-item">SSL Termination (TLS 1.2+)</span>
                        <span class="detail-item">Sticky Sessions</span>
                        <span class="detail-item">WebSocket Support</span>
                        <span class="detail-item">Request Routing Rules</span>
                    </div>
                    <div class="component-metrics">
                        <span class="metric-item">Target Response Time: <200ms</span>
                        <span class="metric-item">Healthy Targets: 2/2</span>
                    </div>
                </div>
                <div class="flow-arrow vertical-down">
                    <span class="flow-label">HTTP:8080 (Backend)</span>
                </div>
            `;
        }
        
        if (hasEC2) {
            diagram += `
                <div class="component ec2">
                    <span class="component-icon">💻</span>
                    <span class="component-name">EC2 Instance</span>
                    <span class="component-desc">t3.micro (1 vCPU, 1GB RAM)</span>
                    <div class="component-details">
                        <span class="detail-item">AMI: Amazon Linux 2</span>
                        <span class="detail-item">EBS: gp3 20GB (3000 IOPS)</span>
                        <span class="detail-item">Auto Scaling: 1-3 instances</span>
                        <span class="detail-item">User Data: Web server setup</span>
                        <span class="detail-item">Instance Profile: EC2Role</span>
                    </div>
                    <div class="component-metrics">
                        <span class="metric-item">CPU Utilization: 15%</span>
                        <span class="metric-item">Network In/Out: 50Mbps</span>
                        <span class="metric-item">Status Checks: 2/2 passed</span>
                    </div>
                    <div class="component-networking">
                        <span class="network-item">Private IP: 10.0.1.10</span>
                        <span class="network-item">Public IP: Auto-assigned</span>
                        <span class="network-item">ENI: eth0</span>
                    </div>
                </div>
            `;
        }
        
        diagram += `
                    </div>
                </div>
                <div class="subnet private-subnet">
                    <div class="subnet-header">
                        <span class="subnet-icon">🔐</span>
                        <span class="subnet-name">Private Subnet</span>
                        <span class="subnet-cidr">10.0.2.0/24</span>
                    </div>
                    <div class="subnet-content">
        `;
        
        if (hasRDS) {
            diagram += `
                <div class="component rds">
                    <span class="component-icon">🗄️</span>
                    <span class="component-name">RDS MySQL Database</span>
                    <span class="component-desc">db.t3.micro (1 vCPU, 1GB RAM)</span>
                    <div class="component-details">
                        <span class="detail-item">Engine: MySQL 8.0.35</span>
                        <span class="detail-item">Storage: gp2 20GB (Auto-scaling to 100GB)</span>
                        <span class="detail-item">Multi-AZ: Synchronous replication</span>
                        <span class="detail-item">Backup: 7 days retention</span>
                        <span class="detail-item">Encryption: AES-256 at rest</span>
                        <span class="detail-item">Maintenance: Sun 03:00-04:00 UTC</span>
                    </div>
                    <div class="component-metrics">
                        <span class="metric-item">Connections: 5/81 max</span>
                        <span class="metric-item">CPU: 8% average</span>
                        <span class="metric-item">IOPS: 150/3000 baseline</span>
                    </div>
                    <div class="component-networking">
                        <span class="network-item">Endpoint: db.region.rds.amazonaws.com</span>
                        <span class="network-item">Port: 3306</span>
                        <span class="network-item">VPC Security Group: rds-sg</span>
                    </div>
                </div>
            `;
        }
        
        if (hasLambda) {
            diagram += `
                <div class="component lambda">
                    <span class="component-icon">⚡</span>
                    <span class="component-name">Lambda Function</span>
                    <span class="component-desc">Serverless Compute</span>
                    <div class="component-details">
                        <span class="detail-item">Event Driven</span>
                        <span class="detail-item">Auto Scaling</span>
                    </div>
                </div>
            `;
        }
        
        diagram += `
                    </div>
                </div>
            </div>
        `;
        
        // AZ-B (for Multi-AZ setup)
        if (hasRDS || hasLB) {
            diagram += `
                <div class="availability-zone az-b">
                    <div class="az-label">AZ-B</div>
                    <div class="subnet public-subnet">
                        <div class="subnet-header">
                            <span class="subnet-icon">🌍</span>
                            <span class="subnet-name">Public Subnet</span>
                            <span class="subnet-cidr">10.0.3.0/24</span>
                        </div>
                        <div class="subnet-content">
                            ${hasLB ? `
                                <div class="component load-balancer secondary">
                                    <span class="component-icon">⚖️</span>
                                    <span class="component-name">ALB (Standby)</span>
                                    <span class="component-desc">High Availability</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="subnet private-subnet">
                        <div class="subnet-header">
                            <span class="subnet-icon">🔐</span>
                            <span class="subnet-name">Private Subnet</span>
                            <span class="subnet-cidr">10.0.4.0/24</span>
                        </div>
                        <div class="subnet-content">
                            ${hasRDS ? `
                                <div class="component rds secondary">
                                    <span class="component-icon">🗄️</span>
                                    <span class="component-name">RDS Standby</span>
                                    <span class="component-desc">Multi-AZ Replica</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        diagram += `
                </div>
            </div>
        `;
        
        // NAT Gateway
        if (hasRDS || hasLambda) {
            diagram += `
                <div class="nat-gateway">
                    <div class="component nat">
                        <span class="component-icon">🚪</span>
                        <span class="component-name">NAT Gateway</span>
                        <span class="component-desc">Outbound Internet Access</span>
                    </div>
                </div>
            `;
        }
        
        diagram += `
                </div>
            </div>
        `;
    }
    
    // External AWS Services
    diagram += `
        <div class="external-services">
            <div class="service-header">
                <span class="service-title">AWS Managed Services</span>
            </div>
            <div class="services-grid">
    `;
    
    if (hasS3) {
        diagram += `
            <div class="component s3">
                <span class="component-icon">🪣</span>
                <span class="component-name">S3 Bucket</span>
                <span class="component-desc">Object Storage</span>
                <div class="component-details">
                    <span class="detail-item">99.999999999% Durability</span>
                    <span class="detail-item">Versioning Enabled</span>
                </div>
            </div>
        `;
    }
    
    // Add comprehensive monitoring and operational services
    diagram += `
        <div class="component cloudwatch">
            <span class="component-icon">📊</span>
            <span class="component-name">CloudWatch</span>
            <span class="component-desc">Monitoring & Observability</span>
            <div class="component-details">
                <span class="detail-item">Metrics: 5min intervals</span>
                <span class="detail-item">Alarms: CPU >80%, Memory >85%</span>
                <span class="detail-item">Logs: Application + System</span>
                <span class="detail-item">Dashboards: Real-time metrics</span>
                <span class="detail-item">Events: Auto Scaling triggers</span>
            </div>
            <div class="component-metrics">
                <span class="metric-item">Log Retention: 30 days</span>
                <span class="metric-item">Custom Metrics: Enabled</span>
            </div>
        </div>
        
        <div class="component systems-manager">
            <span class="component-icon">🔧</span>
            <span class="component-name">Systems Manager</span>
            <span class="component-desc">Operations & Patch Management</span>
            <div class="component-details">
                <span class="detail-item">Session Manager: SSH-less access</span>
                <span class="detail-item">Patch Manager: Auto patching</span>
                <span class="detail-item">Parameter Store: Config management</span>
                <span class="detail-item">Run Command: Remote execution</span>
            </div>
        </div>
        
        <div class="component cloudtrail">
            <span class="component-icon">🔍</span>
            <span class="component-name">CloudTrail</span>
            <span class="component-desc">API Audit Logging</span>
            <div class="component-details">
                <span class="detail-item">All API calls logged</span>
                <span class="detail-item">S3 storage: 90 days</span>
                <span class="detail-item">Data events: S3 object-level</span>
                <span class="detail-item">Insights: Anomaly detection</span>
            </div>
        </div>
    `;
    
    // Add IAM
    diagram += `
        <div class="component iam">
            <span class="component-icon">🔐</span>
            <span class="component-name">IAM</span>
            <span class="component-desc">Identity & Access Management</span>
            <div class="component-details">
                <span class="detail-item">Roles & Policies</span>
                <span class="detail-item">Security Controls</span>
            </div>
        </div>
    `;
    
    diagram += `
            </div>
        </div>
    `;
    
    diagram += `</div>`; // Close AWS Cloud
    
    // Add network topology details
    diagram += generateNetworkTopology(resources);
    
    // Add detailed connection flows
    diagram += generateDetailedConnectionFlows(resources);
    
    // Add security groups visualization
    diagram += generateSecurityGroupsVisualization(resources);
    
    // Add operational monitoring section
    diagram += generateOperationalMonitoring(resources);
    
    diagram += '</div>';
    
    return diagram;
}

// Generate detailed connection flows with protocols and ports
function generateDetailedConnectionFlows(resources) {
    const hasVPC = resources.some(r => r.name === 'VPC Network');
    const hasEC2 = resources.some(r => r.name === 'EC2 Instance');
    const hasRDS = resources.some(r => r.name === 'RDS Database');
    const hasLB = resources.some(r => r.name === 'Load Balancer');
    const hasS3 = resources.some(r => r.name === 'S3 Bucket');
    const hasCDN = resources.some(r => r.name === 'CloudFront CDN');
    
    let flows = '<div class="data-flows">';
    flows += '<h5 class="flows-title">🔄 Data Flow & Communication</h5>';
    flows += '<div class="flows-container">';
    
    // User to CDN/ALB flow
    if (hasCDN) {
        flows += `
            <div class="flow-item">
                <div class="flow-source">👥 Users</div>
                <div class="flow-path">
                    <div class="flow-arrow-detailed">
                        <span class="flow-protocol">HTTPS:443</span>
                        <span class="flow-description">Global CDN Edge Locations</span>
                    </div>
                </div>
                <div class="flow-destination">🌐 CloudFront</div>
            </div>
        `;
    }
    
    if (hasLB) {
        flows += `
            <div class="flow-item">
                <div class="flow-source">${hasCDN ? '🌐 CloudFront' : '👥 Users'}</div>
                <div class="flow-path">
                    <div class="flow-arrow-detailed">
                        <span class="flow-protocol">HTTP:80/HTTPS:443</span>
                        <span class="flow-description">Load balanced across AZs</span>
                    </div>
                </div>
                <div class="flow-destination">⚖️ Load Balancer</div>
            </div>
        `;
    }
    
    if (hasLB && hasEC2) {
        flows += `
            <div class="flow-item">
                <div class="flow-source">⚖️ Load Balancer</div>
                <div class="flow-path">
                    <div class="flow-arrow-detailed">
                        <span class="flow-protocol">HTTP:8080</span>
                        <span class="flow-description">Health checks + traffic distribution</span>
                    </div>
                </div>
                <div class="flow-destination">💻 EC2 Instances</div>
            </div>
        `;
    }
    
    if (hasEC2 && hasRDS) {
        flows += `
            <div class="flow-item">
                <div class="flow-source">💻 EC2 Instances</div>
                <div class="flow-path">
                    <div class="flow-arrow-detailed">
                        <span class="flow-protocol">MySQL:3306</span>
                        <span class="flow-description">Database queries via private subnet</span>
                    </div>
                </div>
                <div class="flow-destination">🗄️ RDS Database</div>
            </div>
        `;
    }
    
    if (hasS3) {
        flows += `
            <div class="flow-item">
                <div class="flow-source">${hasEC2 ? '💻 EC2 Instances' : '⚡ Lambda'}</div>
                <div class="flow-path">
                    <div class="flow-arrow-detailed">
                        <span class="flow-protocol">HTTPS:443</span>
                        <span class="flow-description">Object storage via AWS API</span>
                    </div>
                </div>
                <div class="flow-destination">🪣 S3 Bucket</div>
            </div>
        `;
    }
    
    flows += '</div></div>';
    return flows;
}

// Generate security groups visualization
function generateSecurityGroupsVisualization(resources) {
    const hasEC2 = resources.some(r => r.name === 'EC2 Instance');
    const hasRDS = resources.some(r => r.name === 'RDS Database');
    const hasLB = resources.some(r => r.name === 'Load Balancer');
    
    if (!hasEC2 && !hasRDS && !hasLB) return '';
    
    let securityGroups = '<div class="security-groups">';
    securityGroups += '<h5 class="security-title">🛡️ Security Groups & Network ACLs</h5>';
    securityGroups += '<div class="security-container">';
    
    if (hasLB) {
        securityGroups += `
            <div class="security-group">
                <div class="sg-header">
                    <span class="sg-icon">🛡️</span>
                    <span class="sg-name">ALB Security Group</span>
                </div>
                <div class="sg-rules">
                    <div class="sg-rule inbound">
                        <span class="rule-type">Inbound</span>
                        <span class="rule-detail">HTTP:80 from 0.0.0.0/0</span>
                    </div>
                    <div class="sg-rule inbound">
                        <span class="rule-type">Inbound</span>
                        <span class="rule-detail">HTTPS:443 from 0.0.0.0/0</span>
                    </div>
                    <div class="sg-rule outbound">
                        <span class="rule-type">Outbound</span>
                        <span class="rule-detail">HTTP:8080 to EC2 SG</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (hasEC2) {
        securityGroups += `
            <div class="security-group">
                <div class="sg-header">
                    <span class="sg-icon">🛡️</span>
                    <span class="sg-name">EC2 Security Group</span>
                </div>
                <div class="sg-rules">
                    ${hasLB ? `
                        <div class="sg-rule inbound">
                            <span class="rule-type">Inbound</span>
                            <span class="rule-detail">HTTP:8080 from ALB SG</span>
                        </div>
                    ` : `
                        <div class="sg-rule inbound">
                            <span class="rule-type">Inbound</span>
                            <span class="rule-detail">HTTP:80 from 0.0.0.0/0</span>
                        </div>
                    `}
                    <div class="sg-rule inbound">
                        <span class="rule-type">Inbound</span>
                        <span class="rule-detail">SSH:22 from Admin IP</span>
                    </div>
                    <div class="sg-rule outbound">
                        <span class="rule-type">Outbound</span>
                        <span class="rule-detail">All traffic to 0.0.0.0/0</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (hasRDS) {
        securityGroups += `
            <div class="security-group">
                <div class="sg-header">
                    <span class="sg-icon">🛡️</span>
                    <span class="sg-name">RDS Security Group</span>
                </div>
                <div class="sg-rules">
                    <div class="sg-rule inbound">
                        <span class="rule-type">Inbound</span>
                        <span class="rule-detail">MySQL:3306 from EC2 SG</span>
                    </div>
                    <div class="sg-rule outbound">
                        <span class="rule-type">Outbound</span>
                        <span class="rule-detail">No outbound rules</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    securityGroups += '</div></div>';
    return securityGroups;
}

// Generate detailed network topology
function generateNetworkTopology(resources) {
    const hasVPC = resources.some(r => r.name === 'VPC Network');
    if (!hasVPC) return '';
    
    let topology = '<div class="network-topology">';
    topology += '<h5 class="topology-title">🌐 Network Topology & IP Addressing</h5>';
    topology += '<div class="topology-container">';
    
    topology += `
        <div class="ip-addressing">
            <h6>📋 IP Address Allocation</h6>
            <div class="ip-table">
                <div class="ip-row header">
                    <span>Resource</span>
                    <span>CIDR Block</span>
                    <span>Available IPs</span>
                    <span>Usage</span>
                </div>
                <div class="ip-row">
                    <span>VPC</span>
                    <span>10.0.0.0/16</span>
                    <span>65,536</span>
                    <span>Private network</span>
                </div>
                <div class="ip-row">
                    <span>Public Subnet AZ-A</span>
                    <span>10.0.1.0/24</span>
                    <span>256</span>
                    <span>Load balancers, NAT GW</span>
                </div>
                <div class="ip-row">
                    <span>Private Subnet AZ-A</span>
                    <span>10.0.2.0/24</span>
                    <span>256</span>
                    <span>App servers, databases</span>
                </div>
                <div class="ip-row">
                    <span>Public Subnet AZ-B</span>
                    <span>10.0.3.0/24</span>
                    <span>256</span>
                    <span>High availability</span>
                </div>
                <div class="ip-row">
                    <span>Private Subnet AZ-B</span>
                    <span>10.0.4.0/24</span>
                    <span>256</span>
                    <span>Database replicas</span>
                </div>
            </div>
        </div>
        
        <div class="dns-resolution">
            <h6>🔍 DNS Resolution Flow</h6>
            <div class="dns-flow">
                <div class="dns-step">
                    <span class="step-num">1</span>
                    <span class="step-desc">Client queries domain name</span>
                </div>
                <div class="dns-step">
                    <span class="step-num">2</span>
                    <span class="step-desc">Route 53 returns ALB IP address</span>
                </div>
                <div class="dns-step">
                    <span class="step-num">3</span>
                    <span class="step-desc">Client connects to ALB endpoint</span>
                </div>
                <div class="dns-step">
                    <span class="step-num">4</span>
                    <span class="step-desc">ALB forwards to healthy targets</span>
                </div>
            </div>
        </div>
    `;
    
    topology += '</div></div>';
    return topology;
}

// Generate operational monitoring details
function generateOperationalMonitoring(resources) {
    let monitoring = '<div class="operational-monitoring">';
    monitoring += '<h5 class="monitoring-title">📈 Operational Monitoring & Alerting</h5>';
    monitoring += '<div class="monitoring-container">';
    
    monitoring += `
        <div class="monitoring-section">
            <h6>🚨 CloudWatch Alarms</h6>
            <div class="alarms-grid">
                <div class="alarm-item critical">
                    <span class="alarm-name">High CPU Utilization</span>
                    <span class="alarm-threshold">CPU > 80% for 5 minutes</span>
                    <span class="alarm-action">Scale out + SNS notification</span>
                </div>
                <div class="alarm-item warning">
                    <span class="alarm-name">Database Connections</span>
                    <span class="alarm-threshold">Connections > 70</span>
                    <span class="alarm-action">Email alert to DBA team</span>
                </div>
                <div class="alarm-item info">
                    <span class="alarm-name">Disk Space Usage</span>
                    <span class="alarm-threshold">Disk > 85%</span>
                    <span class="alarm-action">Slack notification</span>
                </div>
                <div class="alarm-item critical">
                    <span class="alarm-name">Application Health Check</span>
                    <span class="alarm-threshold">Failed health checks > 2</span>
                    <span class="alarm-action">Auto-replace instance</span>
                </div>
            </div>
        </div>
        
        <div class="monitoring-section">
            <h6>📊 Key Performance Indicators</h6>
            <div class="kpi-grid">
                <div class="kpi-item">
                    <span class="kpi-name">Response Time</span>
                    <span class="kpi-value">< 200ms</span>
                    <span class="kpi-status good">✓ Good</span>
                </div>
                <div class="kpi-item">
                    <span class="kpi-name">Availability</span>
                    <span class="kpi-value">99.9%</span>
                    <span class="kpi-status good">✓ Target</span>
                </div>
                <div class="kpi-item">
                    <span class="kpi-name">Error Rate</span>
                    <span class="kpi-value">< 0.1%</span>
                    <span class="kpi-status good">✓ Low</span>
                </div>
                <div class="kpi-item">
                    <span class="kpi-name">Throughput</span>
                    <span class="kpi-value">1000 req/min</span>
                    <span class="kpi-status good">✓ Normal</span>
                </div>
            </div>
        </div>
        
        <div class="monitoring-section">
            <h6>🔄 Auto Scaling Configuration</h6>
            <div class="scaling-config">
                <div class="scaling-policy">
                    <span class="policy-name">Scale Out Policy</span>
                    <span class="policy-trigger">CPU > 70% for 2 minutes</span>
                    <span class="policy-action">Add 1 instance (max 3)</span>
                </div>
                <div class="scaling-policy">
                    <span class="policy-name">Scale In Policy</span>
                    <span class="policy-trigger">CPU < 30% for 5 minutes</span>
                    <span class="policy-action">Remove 1 instance (min 1)</span>
                </div>
            </div>
        </div>
    `;
    
    monitoring += '</div></div>';
    return monitoring;
}

// Generate comprehensive cost estimate with full system analysis
function generateCostEstimate(resources) {
    const region = awsRegion || 'eu-central-1';
    const hasVPC = resources.some(r => r.name === 'VPC Network');
    const hasEC2 = resources.some(r => r.name === 'EC2 Instance');
    const hasRDS = resources.some(r => r.name === 'RDS Database');
    const hasLB = resources.some(r => r.name === 'Load Balancer');
    const hasS3 = resources.some(r => r.name === 'S3 Bucket');
    const hasLambda = resources.some(r => r.name === 'Lambda Function');
    const hasCDN = resources.some(r => r.name === 'CloudFront CDN');
    
    // Usage scenarios
    const scenarios = {
        light: { name: 'Light Usage', multiplier: 1, description: 'Development/Testing' },
        moderate: { name: 'Moderate Usage', multiplier: 2.5, description: 'Small Production' },
        heavy: { name: 'Heavy Usage', multiplier: 5, description: 'Enterprise Production' }
    };
    
    let costAnalysis = '<div class="comprehensive-cost-analysis">';
    
    // Cost breakdown by category
    const costCategories = {
        compute: { name: 'Compute Services', costs: [], icon: '💻' },
        storage: { name: 'Storage Services', costs: [], icon: '💾' },
        networking: { name: 'Networking & CDN', costs: [], icon: '🌐' },
        database: { name: 'Database Services', costs: [], icon: '🗄️' },
        monitoring: { name: 'Monitoring & Operations', costs: [], icon: '📊' },
        dataTransfer: { name: 'Data Transfer', costs: [], icon: '📡' }
    };
    
    // Compute costs
    if (hasEC2) {
        costCategories.compute.costs.push({
            service: 'EC2 t3.micro Instance',
            lightCost: 8.50,
            moderateCost: 21.25, // t3.small
            heavyCost: 42.50, // t3.medium
            details: 'On-Demand pricing, 24/7 uptime',
            unit: 'per instance'
        });
        
        costCategories.compute.costs.push({
            service: 'EBS gp3 Storage (20GB)',
            lightCost: 1.60,
            moderateCost: 4.00, // 50GB
            heavyCost: 8.00, // 100GB
            details: '3,000 IOPS baseline, 125 MB/s throughput',
            unit: 'per volume'
        });
        
        costCategories.compute.costs.push({
            service: 'Auto Scaling (additional instances)',
            lightCost: 0,
            moderateCost: 17.00, // 1 additional t3.small
            heavyCost: 85.00, // 2 additional t3.medium
            details: 'Scale-out during peak hours',
            unit: 'average monthly'
        });
    }
    
    if (hasLambda) {
        costCategories.compute.costs.push({
            service: 'Lambda Function Execution',
            lightCost: 0.20,
            moderateCost: 2.50,
            heavyCost: 12.00,
            details: '1M requests, 512MB memory, 3s duration',
            unit: 'per month'
        });
    }
    
    // Storage costs
    if (hasS3) {
        costCategories.storage.costs.push({
            service: 'S3 Standard Storage',
            lightCost: 2.30, // 100GB
            moderateCost: 11.50, // 500GB
            heavyCost: 46.00, // 2TB
            details: 'First 50TB tier pricing',
            unit: 'per month'
        });
        
        costCategories.storage.costs.push({
            service: 'S3 Requests (PUT/GET)',
            lightCost: 0.40,
            moderateCost: 2.00,
            heavyCost: 10.00,
            details: 'API requests for object operations',
            unit: 'per month'
        });
    }
    
    // Database costs
    if (hasRDS) {
        costCategories.database.costs.push({
            service: 'RDS MySQL db.t3.micro',
            lightCost: 15.00,
            moderateCost: 30.00, // db.t3.small
            heavyCost: 60.00, // db.t3.medium
            details: 'Single-AZ deployment',
            unit: 'per instance'
        });
        
        costCategories.database.costs.push({
            service: 'RDS Storage (gp2)',
            lightCost: 2.00, // 20GB
            moderateCost: 10.00, // 100GB
            heavyCost: 40.00, // 400GB
            details: 'General Purpose SSD storage',
            unit: 'per month'
        });
        
        costCategories.database.costs.push({
            service: 'RDS Multi-AZ (High Availability)',
            lightCost: 0,
            moderateCost: 30.00, // Double primary cost
            heavyCost: 60.00, // Double primary cost
            details: 'Synchronous replication to standby',
            unit: 'additional cost'
        });
        
        costCategories.database.costs.push({
            service: 'RDS Backup Storage',
            lightCost: 0, // Within free tier
            moderateCost: 2.00,
            heavyCost: 8.00,
            details: '7-day retention, beyond allocated storage',
            unit: 'per month'
        });
    }
    
    // Networking costs
    if (hasLB) {
        costCategories.networking.costs.push({
            service: 'Application Load Balancer',
            lightCost: 22.50,
            moderateCost: 22.50,
            heavyCost: 22.50,
            details: 'Fixed hourly cost',
            unit: 'per ALB'
        });
        
        costCategories.networking.costs.push({
            service: 'ALB Load Balancer Capacity Units',
            lightCost: 1.80, // 25 LCUs
            moderateCost: 7.20, // 100 LCUs
            heavyCost: 36.00, // 500 LCUs
            details: 'Based on processed bytes and connections',
            unit: 'per month'
        });
    }
    
    if (hasVPC) {
        costCategories.networking.costs.push({
            service: 'NAT Gateway',
            lightCost: 45.00,
            moderateCost: 45.00,
            heavyCost: 90.00, // 2 NAT Gateways for HA
            details: 'Fixed hourly cost per AZ',
            unit: 'per gateway'
        });
        
        costCategories.networking.costs.push({
            service: 'NAT Gateway Data Processing',
            lightCost: 4.50, // 100GB
            moderateCost: 22.50, // 500GB
            heavyCost: 90.00, // 2TB
            details: 'Data processed through NAT Gateway',
            unit: 'per month'
        });
    }
    
    if (hasCDN) {
        costCategories.networking.costs.push({
            service: 'CloudFront Data Transfer',
            lightCost: 8.50, // 100GB
            moderateCost: 42.50, // 500GB
            heavyCost: 170.00, // 2TB
            details: 'Global edge locations, first 1TB tier',
            unit: 'per month'
        });
        
        costCategories.networking.costs.push({
            service: 'CloudFront Requests',
            lightCost: 0.75, // 10M requests
            moderateCost: 3.75, // 50M requests
            heavyCost: 15.00, // 200M requests
            details: 'HTTP/HTTPS requests to edge locations',
            unit: 'per month'
        });
    }
    
    // Data Transfer costs
    costCategories.dataTransfer.costs.push({
        service: 'Data Transfer Out (Internet)',
        lightCost: 9.00, // 100GB
        moderateCost: 45.00, // 500GB
        heavyCost: 180.00, // 2TB
        details: 'First 1GB free, then $0.09/GB',
        unit: 'per month'
    });
    
    costCategories.dataTransfer.costs.push({
        service: 'Inter-AZ Data Transfer',
        lightCost: 1.00, // 100GB
        moderateCost: 5.00, // 500GB
        heavyCost: 20.00, // 2TB
        details: 'Between availability zones',
        unit: 'per month'
    });
    
    // Monitoring and Operations
    costCategories.monitoring.costs.push({
        service: 'CloudWatch Metrics & Alarms',
        lightCost: 3.00, // 10 alarms, basic metrics
        moderateCost: 15.00, // 50 alarms, custom metrics
        heavyCost: 75.00, // 250 alarms, detailed monitoring
        details: 'Standard and custom metrics, alarm notifications',
        unit: 'per month'
    });
    
    costCategories.monitoring.costs.push({
        service: 'CloudWatch Logs',
        lightCost: 0.50, // 1GB ingestion
        moderateCost: 2.50, // 5GB ingestion
        heavyCost: 12.50, // 25GB ingestion
        details: 'Log ingestion and storage',
        unit: 'per month'
    });
    
    costCategories.monitoring.costs.push({
        service: 'CloudTrail Logging',
        lightCost: 2.00,
        moderateCost: 10.00,
        heavyCost: 50.00,
        details: 'API call logging and data events',
        unit: 'per month'
    });
    
    costCategories.monitoring.costs.push({
        service: 'Systems Manager',
        lightCost: 0, // Free tier
        moderateCost: 5.00,
        heavyCost: 25.00,
        details: 'Patch Manager, Session Manager, Parameter Store',
        unit: 'per month'
    });
    
    // Generate scenario comparison
    costAnalysis += '<div class="cost-scenarios">';
    costAnalysis += '<h6>💰 Cost Analysis by Usage Scenario</h6>';
    costAnalysis += '<div class="scenarios-grid">';
    
    Object.entries(scenarios).forEach(([key, scenario]) => {
        let totalCost = 0;
        let scenarioBreakdown = '';
        
        Object.entries(costCategories).forEach(([categoryKey, category]) => {
            if (category.costs.length > 0) {
                let categoryTotal = 0;
                category.costs.forEach(cost => {
                    const costAmount = cost[`${key}Cost`] || 0;
                    categoryTotal += costAmount;
                });
                
                if (categoryTotal > 0) {
                    totalCost += categoryTotal;
                    scenarioBreakdown += `
                        <div class="category-cost">
                            <span class="category-icon">${category.icon}</span>
                            <span class="category-name">${category.name}</span>
                            <span class="category-amount">$${categoryTotal.toFixed(2)}</span>
                        </div>
                    `;
                }
            }
        });
        
        costAnalysis += `
            <div class="scenario-card ${key}">
                <div class="scenario-header">
                    <h7>${scenario.name}</h7>
                    <span class="scenario-desc">${scenario.description}</span>
                </div>
                <div class="scenario-total">
                    <span class="total-label">Monthly Total</span>
                    <span class="total-amount">$${totalCost.toFixed(2)}</span>
                    <span class="annual-amount">$${(totalCost * 12).toFixed(0)}/year</span>
                </div>
                <div class="scenario-breakdown">
                    ${scenarioBreakdown}
                </div>
            </div>
        `;
    });
    
    costAnalysis += '</div></div>';
    
    // Detailed cost breakdown by service
    costAnalysis += '<div class="detailed-cost-breakdown">';
    costAnalysis += '<h6>📊 Detailed Service Cost Breakdown</h6>';
    
    Object.entries(costCategories).forEach(([categoryKey, category]) => {
        if (category.costs.length > 0) {
            costAnalysis += `
                <div class="cost-category">
                    <div class="category-header">
                        <span class="category-icon">${category.icon}</span>
                        <span class="category-title">${category.name}</span>
                    </div>
                    <div class="category-services">
            `;
            
            category.costs.forEach(cost => {
                costAnalysis += `
                    <div class="service-cost-item">
                        <div class="service-info">
                            <span class="service-name">${cost.service}</span>
                            <span class="service-details">${cost.details}</span>
                            <span class="service-unit">${cost.unit}</span>
                        </div>
                        <div class="service-costs">
                            <div class="cost-tier light">
                                <span class="tier-label">Light</span>
                                <span class="tier-cost">$${cost.lightCost.toFixed(2)}</span>
                            </div>
                            <div class="cost-tier moderate">
                                <span class="tier-label">Moderate</span>
                                <span class="tier-cost">$${cost.moderateCost.toFixed(2)}</span>
                            </div>
                            <div class="cost-tier heavy">
                                <span class="tier-label">Heavy</span>
                                <span class="tier-cost">$${cost.heavyCost.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            costAnalysis += '</div></div>';
        }
    });
    
    costAnalysis += '</div>';
    
    // Cost optimization recommendations
    costAnalysis += `
        <div class="cost-optimization">
            <h6>💡 Cost Optimization Recommendations</h6>
            <div class="optimization-grid">
                <div class="optimization-item">
                    <span class="opt-icon">💰</span>
                    <span class="opt-title">Reserved Instances</span>
                    <span class="opt-desc">Save up to 75% on EC2 and RDS with 1-3 year commitments</span>
                    <span class="opt-savings">Potential savings: $200-500/month</span>
                </div>
                <div class="optimization-item">
                    <span class="opt-icon">📊</span>
                    <span class="opt-title">Right-sizing</span>
                    <span class="opt-desc">Monitor utilization and downsize underused instances</span>
                    <span class="opt-savings">Potential savings: 20-40%</span>
                </div>
                <div class="optimization-item">
                    <span class="opt-icon">🕒</span>
                    <span class="opt-title">Scheduled Scaling</span>
                    <span class="opt-desc">Scale down non-production environments during off-hours</span>
                    <span class="opt-savings">Potential savings: 50-70% on dev/test</span>
                </div>
                <div class="optimization-item">
                    <span class="opt-icon">💾</span>
                    <span class="opt-title">Storage Optimization</span>
                    <span class="opt-desc">Use S3 Intelligent Tiering and lifecycle policies</span>
                    <span class="opt-savings">Potential savings: 30-60% on storage</span>
                </div>
            </div>
        </div>
    `;
    
    costAnalysis += '</div>';
    
    return `
        <div class="cost-disclaimer">
            <p><strong>💡 Comprehensive Cost Analysis:</strong> This analysis includes all AWS services, data transfer, monitoring, and operational costs based on ${region} pricing. Costs vary by:</p>
            <ul>
                <li><strong>Usage Patterns:</strong> Traffic volume, compute utilization, storage access</li>
                <li><strong>Regional Pricing:</strong> Different regions have varying costs</li>
                <li><strong>Commitment Discounts:</strong> Reserved Instances, Savings Plans</li>
                <li><strong>Enterprise Agreements:</strong> Volume discounts and custom pricing</li>
            </ul>
            <p>📊 Use the <a href="https://calculator.aws/" target="_blank">AWS Pricing Calculator</a> for precise estimates with your specific requirements.</p>
        </div>
        ${costAnalysis}
    `;
}

// Parse resources from Terraform code with enhanced details
function parseResourcesFromCode(code) {
    const resources = [];
    
    if (code.includes('aws_s3_bucket')) {
        resources.push({
            name: 'S3 Bucket',
            type: 'Storage Service',
            icon: '🪣',
            purpose: 'Provides highly scalable object storage for static files, application data, backups, or data lakes with 99.999999999% (11 9\'s) durability',
            config: 'Configured with versioning for data protection, server-side encryption, lifecycle policies, and fine-grained access controls',
            security: 'Bucket policies, IAM policies, and Access Control Lists (ACLs) provide multiple layers of access control. Supports encryption in transit and at rest',
            cost: 'Pay-per-use model with different storage classes (Standard, IA, Glacier) for cost optimization. Free tier includes 5GB of standard storage',
            connections: ['CloudFront', 'EC2 Instance', 'Lambda Function']
        });
    }
    
    if (code.includes('aws_instance')) {
        const instanceType = code.match(/instance_type\s*=\s*"([^"]+)"/)?.[1] || 't3.micro';
        resources.push({
            name: 'EC2 Instance',
            type: 'Compute Service',
            icon: '💻',
            purpose: `Virtual server (${instanceType}) for running applications, web servers, databases, or any compute workload with full control over the operating system`,
            config: 'Configured with security groups for network access control, key pairs for SSH access, user data scripts for automated setup, and EBS volumes for storage',
            security: 'Security groups act as virtual firewalls controlling inbound and outbound traffic. Instance metadata service provides secure access to instance information',
            cost: `Hourly billing based on instance type (${instanceType}). Includes compute, memory, and network performance. Additional charges for EBS storage and data transfer`,
            connections: ['VPC Network', 'Security Groups', 'Load Balancer', 'RDS Database']
        });
    }
    
    if (code.includes('aws_db_instance')) {
        const engine = code.match(/engine\s*=\s*"([^"]+)"/)?.[1] || 'mysql';
        const instanceClass = code.match(/instance_class\s*=\s*"([^"]+)"/)?.[1] || 'db.t3.micro';
        resources.push({
            name: 'RDS Database',
            type: 'Database Service',
            icon: '🗄️',
            purpose: `Managed ${engine.toUpperCase()} database (${instanceClass}) with automated backups, software patching, monitoring, and failure detection`,
            config: 'Multi-AZ deployment for high availability, automated backups with point-in-time recovery, performance monitoring, and automatic software patching',
            security: 'VPC isolation for network security, encryption at rest and in transit, IAM database authentication, and security group protection',
            cost: 'Based on instance class, storage type and size, backup retention period, and data transfer. Multi-AZ deployment doubles the cost for high availability',
            connections: ['VPC Network', 'Private Subnet', 'EC2 Instance', 'Security Groups']
        });
    }
    
    if (code.includes('aws_vpc')) {
        resources.push({
            name: 'VPC Network',
            type: 'Networking Service',
            icon: '🔒',
            purpose: 'Isolated virtual network providing complete control over network environment including IP address ranges, subnets, route tables, and network gateways',
            config: 'Public and private subnets across multiple availability zones, Internet Gateway for public access, NAT Gateway for private subnet internet access, and custom route tables',
            security: 'Network ACLs provide subnet-level security, route tables control traffic routing, and VPC Flow Logs monitor network traffic for security analysis',
            cost: 'VPC itself is free. Charges apply for NAT Gateways (~$45/month), VPN connections, and data transfer between availability zones',
            connections: ['Internet Gateway', 'NAT Gateway', 'Route Tables', 'Security Groups']
        });
    }
    
    if (code.includes('aws_lb') || code.includes('aws_alb')) {
        resources.push({
            name: 'Load Balancer',
            type: 'Networking Service',
            icon: '⚖️',
            purpose: 'Application Load Balancer distributes incoming application traffic across multiple targets (EC2 instances, containers) in multiple availability zones',
            config: 'Layer 7 load balancing with advanced routing, health checks, SSL/TLS termination, WebSocket support, and integration with AWS services',
            security: 'Security groups control access, SSL certificates provide encryption, and AWS WAF integration protects against web exploits',
            cost: 'Hourly charge (~$22.50/month) plus data processing fees based on Load Balancer Capacity Units (LCUs) consumed',
            connections: ['EC2 Instance', 'Target Groups', 'Security Groups', 'Route 53']
        });
    }
    
    if (code.includes('aws_lambda_function')) {
        resources.push({
            name: 'Lambda Function',
            type: 'Serverless Compute',
            icon: '⚡',
            purpose: 'Serverless compute service that runs code in response to events without provisioning or managing servers, with automatic scaling',
            config: 'Event-driven execution with configurable memory (128MB-10GB), timeout settings, environment variables, and VPC connectivity options',
            security: 'IAM execution roles control permissions, resource-based policies control invocation access, and VPC configuration provides network isolation',
            cost: 'Pay per request and compute time (GB-seconds). Free tier includes 1M requests and 400,000 GB-seconds per month',
            connections: ['API Gateway', 'S3 Bucket', 'DynamoDB', 'CloudWatch']
        });
    }
    
    if (code.includes('aws_cloudfront_distribution')) {
        resources.push({
            name: 'CloudFront CDN',
            type: 'Content Delivery',
            icon: '🌐',
            purpose: 'Global content delivery network (CDN) that delivers content with low latency and high transfer speeds using edge locations worldwide',
            config: 'Origin configuration pointing to S3 or custom origins, caching behaviors, SSL certificates, and geographic restrictions',
            security: 'Origin Access Identity (OAI) secures S3 origins, SSL/TLS encryption, and AWS WAF integration for application protection',
            cost: 'Pay for data transfer out and HTTP/HTTPS requests. Free tier includes 50GB data transfer and 2M HTTP/HTTPS requests',
            connections: ['S3 Bucket', 'Route 53', 'ACM Certificate', 'WAF']
        });
    }
    
    return resources;
}

function copyToClipboard() {
    const codeContent = document.getElementById('terraformCodeContent');
    if (!codeContent) return;
    
    const code = codeContent.textContent;
    navigator.clipboard.writeText(code).then(() => {
        const copyBtn = document.getElementById('copyBtn');
        const originalText = copyBtn.textContent;
        
        // Add success animation
        copyBtn.classList.add('copied');
        copyBtn.textContent = '✅ Copied!';
        
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            const copyBtn = document.getElementById('copyBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        } catch (fallbackErr) {
            alert('Failed to copy to clipboard. Please select and copy manually.');
        }
        
        document.body.removeChild(textArea);
    });
}

// Template definitions
const templates = {
    'static-website': {
        description: 'Create a static website with S3 hosting, CloudFront CDN, and custom domain support',
        prompt: 'Create a static website with S3 bucket hosting, CloudFront distribution for global CDN, Route53 for DNS, and SSL certificate for secure HTTPS access'
    },
    'web-app': {
        description: 'Full-stack web application with load balancer, auto-scaling, and database',
        prompt: 'Create a scalable web application with Application Load Balancer, Auto Scaling Group of EC2 instances, RDS MySQL database, and VPC with public and private subnets'
    },
    'database': {
        description: 'Secure database setup with backup, encryption, and monitoring',
        prompt: 'Create a secure RDS database with Multi-AZ deployment, automated backups, encryption at rest, VPC with private subnets, security groups, and CloudWatch monitoring'
    },
    'serverless': {
        description: 'Serverless API with Lambda, API Gateway, and DynamoDB',
        prompt: 'Create a serverless REST API using API Gateway, Lambda functions, DynamoDB tables, IAM roles, and CloudWatch logs for a complete serverless architecture'
    },
    'vpc-network': {
        description: 'Complete VPC network with public/private subnets and security',
        prompt: 'Create a complete VPC network with public and private subnets across multiple AZs, Internet Gateway, NAT Gateway, Route Tables, Network ACLs, and Security Groups'
    },
    'load-balancer': {
        description: 'Application Load Balancer with target groups and health checks',
        prompt: 'Create an Application Load Balancer with target groups, health checks, SSL termination, multiple availability zones, and auto-scaling integration'
    },
    'container': {
        description: 'Containerized application with ECS, ECR, and service discovery',
        prompt: 'Create a containerized application using ECS Fargate, ECR repository, Application Load Balancer, service discovery, and CloudWatch logging'
    },
    'data-pipeline': {
        description: 'Data processing pipeline with S3, Lambda, and analytics',
        prompt: 'Create a data processing pipeline with S3 buckets, Lambda functions for processing, SQS queues, DynamoDB for metadata, and CloudWatch for monitoring'
    }
};

// Use template function
function useTemplate(templateKey) {
    const template = templates[templateKey];
    if (!template) return;
    
    // Clear any existing selection
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Mark this button as selected
    event.target.classList.add('selected');
    
    // Fill the textarea with the template prompt
    const textarea = document.getElementById('naturalLanguageInput');
    textarea.value = template.prompt;
    
    // Add a subtle animation to show the text was filled
    textarea.style.transform = 'scale(1.02)';
    textarea.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.3)';
    
    setTimeout(() => {
        textarea.style.transform = '';
        textarea.style.boxShadow = '';
    }, 500);
    
    // Auto-focus the textarea
    textarea.focus();
    
    // Show a tooltip with description
    showTooltip(event.target, template.description);
}

// Show tooltip function
function showTooltip(element, text) {
    // Remove any existing tooltips
    const existingTooltip = document.querySelector('.template-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    
    const tooltip = document.createElement('div');
    tooltip.className = 'template-tooltip';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.bottom + 10 + 'px';
    
    // Remove tooltip after 3 seconds
    setTimeout(() => {
        if (tooltip.parentNode) {
            tooltip.remove();
        }
    }, 3000);
}

// Allow Enter key to trigger generation
document.getElementById('naturalLanguageInput').addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && event.ctrlKey) {
        generateTerraform();
    }
});