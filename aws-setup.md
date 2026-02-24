# AWS Configuration Guide

To connect your Terraform Generator to your AWS account, you have several options:

## Option 1: AWS CLI Configuration (Recommended)
1. Install AWS CLI: `brew install awscli` (macOS) or download from AWS
2. Configure credentials: `aws configure`
3. Enter your Access Key ID, Secret Access Key, and default region
4. Refresh the web page - it should show "Connected to AWS Account"

## Option 2: Environment Variables
Set these environment variables:
```bash
export AWS_ACCESS_KEY_ID=your_access_key_here
export AWS_SECRET_ACCESS_KEY=your_secret_key_here
export AWS_DEFAULT_REGION=us-west-2
```

## Option 3: IAM Roles (for EC2 instances)
If running on an EC2 instance, attach an IAM role with appropriate permissions.

## Required AWS Permissions
Your AWS credentials need these permissions:
- `ec2:DescribeRegions`
- `ec2:DescribeImages`
- `sts:GetCallerIdentity`

## Security Note
Never commit AWS credentials to version control. Use IAM roles, environment variables, or AWS CLI configuration instead.

## Troubleshooting
- If you see "AWS not configured", check your credentials
- Make sure your AWS region is supported
- Verify your credentials have the required permissions