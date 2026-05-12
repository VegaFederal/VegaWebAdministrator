#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}AWS Project Initialization Script${NC}"
echo -e "${BLUE}=========================================${NC}"

# Get project information
echo -e "${YELLOW}Please provide the following information:${NC}"
read -p "Project name: " PROJECT_NAME
read -p "Project description: " PROJECT_DESCRIPTION
read -p "Infrastructure type (CF/cdk/TF): " INFRA_TYPE
read -p "Application type (serverless/container/ec2): " APP_TYPE
read -p "AWS Region: " AWS_REGION
read -p "Company VPC ID: " VPC_ID
read -p "Subnet IDs (comma-separated): " SUBNET_IDS
read -p "GitHub repository URL: " GITHUB_REPO

# Validate inputs
if [ -z "$PROJECT_NAME" ] || [ -z "$INFRA_TYPE" ] || [ -z "$AWS_REGION" ] || [ -z "$VPC_ID" ] || [ -z "$SUBNET_IDS" ]; then
    echo -e "${YELLOW}Error: Project name, infrastructure type, AWS region, VPC ID, and Subnet IDs are required.${NC}"
    exit 1
fi

# Convert to lowercase for consistency
INFRA_TYPE=$(echo "$INFRA_TYPE" | tr '[:upper:]' '[:lower:]')
APP_TYPE=$(echo "$APP_TYPE" | tr '[:upper:]' '[:lower:]')

# Update README with project info
sed -i '' "s/# AWS Project Template/# $PROJECT_NAME/g" README.md
sed -i '' "s/A comprehensive template repository to help developers quickly start new AWS projects with best practices built-in./$PROJECT_DESCRIPTION/g" README.md

# Create project config file
mkdir -p config
cat > config/project-config.json << EOL
{
  "projectName": "$PROJECT_NAME",
  "description": "$PROJECT_DESCRIPTION",
  "infraType": "$INFRA_TYPE",
  "applicationType": "$APP_TYPE",
  "awsRegion": "$AWS_REGION",
  "vpcId": "$VPC_ID",
  "subnetIds": "$SUBNET_IDS",
  "githubRepo": "$GITHUB_REPO",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOL

# Clean up unused infrastructure directories
if [ "$INFRA_TYPE" != "cf" ]; then
    rm -rf infrastructure/cloudformation
fi

if [ "$INFRA_TYPE" != "cdk" ]; then
    rm -rf infrastructure/cdk
fi

if [ "$INFRA_TYPE" != "tf" ]; then
    rm -rf infrastructure/terraform
fi

# Set up infrastructure files based on selection
if [ "$INFRA_TYPE" == "cf" ]; then
    # Create directories for nested templates
    mkdir -p infrastructure/cloudformation/templates
    
    # Create main CloudFormation template
    cat > infrastructure/cloudformation/main-template.yaml << EOL
AWSTemplateFormatVersion: '2010-09-09'
Description: $PROJECT_DESCRIPTION

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - test
      - prod
    Description: The deployment environment
  
  VpcId:
    Type: AWS::EC2::VPC::Id
    Default: $VPC_ID
    Description: ID of the existing company VPC
  
  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
    Default: $(echo $SUBNET_IDS | sed 's/,/,/g')
    Description: List of existing subnet IDs for deployment

Resources:
  # Security Groups Stack
  SecurityGroupsStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: ./templates/security-groups.yaml
      Parameters:
        Environment: !Ref Environment
        VpcId: !Ref VpcId
      Tags:
        - Key: Environment
          Value: !Ref Environment

  # Add more nested stacks as needed

Outputs:
  # Your outputs will go here
EOL

    # Create security groups template
    cat > infrastructure/cloudformation/templates/security-groups.yaml << EOL
AWSTemplateFormatVersion: '2010-09-09'
Description: Security Groups for $PROJECT_NAME

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - test
      - prod
    Description: The deployment environment
  
  VpcId:
    Type: String
    Description: ID of the existing company VPC

Resources:
  # Security Groups
  WebServerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for web servers
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
      Tags:
        - Key: Name
          Value: !Sub \${AWS::StackName}-web-sg
        - Key: Environment
          Value: !Ref Environment

Outputs:
  WebServerSecurityGroupId:
    Description: Security Group ID for web servers
    Value: !Ref WebServerSecurityGroup
EOL

    # Create README for CloudFormation templates
    cat > infrastructure/cloudformation/README.md << EOL
# Nested CloudFormation Templates

This directory contains a set of nested CloudFormation templates for deploying $PROJECT_NAME infrastructure.

## Template Structure

- \`main-template.yaml\` - The main template that orchestrates all nested stacks
- \`templates/\` - Directory containing all nested templates:
  - \`security-groups.yaml\` - Security group resources
  - Add more template descriptions as you create them

## Deployment

To deploy this stack:

\`\`\`bash
aws cloudformation deploy \\
  --template-file main-template.yaml \\
  --stack-name $PROJECT_NAME \\
  --parameter-overrides \\
      Environment=dev \\
      VpcId=$VPC_ID \\
      SubnetIds=$SUBNET_IDS \\
  --capabilities CAPABILITY_IAM
\`\`\`

## Benefits of Nested Templates

1. **Modularity**: Each component is isolated in its own template
2. **Reusability**: Templates can be reused across different projects
3. **Maintainability**: Easier to update individual components
4. **Organization**: Better organization of complex infrastructure
5. **Parallel Processing**: AWS can process nested stacks in parallel, potentially speeding up deployment
EOL
elif [ "$INFRA_TYPE" == "cdk" ]; then
    # Update CDK configuration
    cat > infrastructure/cdk/cdk.context.json << EOL
{
  "vpcId": "$VPC_ID",
  "subnetIds": "$SUBNET_IDS"
}
EOL
elif [ "$INFRA_TYPE" == "tf" ]; then
    # Create Terraform variables file with VPC info
    cat > infrastructure/terraform/terraform.tfvars << EOL
project_name = "$PROJECT_NAME"
environment = "dev"
aws_region = "$AWS_REGION"
vpc_id = "$VPC_ID"
subnet_ids = [$(echo $SUBNET_IDS | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/')] 
EOL
fi

# Set up application structure based on type
if [ "$APP_TYPE" == "serverless" ]; then
    # Create serverless.yml for serverless framework
    cat > serverless.yml << EOL
service: $PROJECT_NAME

frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs18.x
  region: $AWS_REGION
  stage: \${opt:stage, 'dev'}
  vpc:
    securityGroupIds:
      - !Ref ServerlessSecurityGroup
    subnetIds: $(echo $SUBNET_IDS | sed 's/,/\n      - /g' | sed 's/^/      - /')

functions:
  hello:
    handler: src/lambda/hello.handler
    events:
      - httpApi:
          path: /hello
          method: get

resources:
  Resources:
    ServerlessSecurityGroup:
      Type: AWS::EC2::SecurityGroup
      Properties:
        GroupDescription: Security group for serverless functions
        VpcId: $VPC_ID
        SecurityGroupEgress:
          - IpProtocol: -1
            CidrIp: 0.0.0.0/0

plugins:
  - serverless-esbuild
EOL

elif [ "$APP_TYPE" == "container" ]; then
    # Create docker-compose.yml with VPC info as environment variables
    cat > docker-compose.yml << EOL
version: '3'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - VPC_ID=$VPC_ID
      - SUBNET_IDS=$SUBNET_IDS
EOL

elif [ "$APP_TYPE" == "ec2" ]; then
    # Create user-data script for EC2 with VPC info
    cat > scripts/user-data.sh << EOL
#!/bin/bash
yum update -y
yum install -y httpd
systemctl start httpd
systemctl enable httpd
echo "<h1>Hello from $PROJECT_NAME!</h1>" > /var/www/html/index.html
echo "<p>Running in VPC: $VPC_ID</p>" >> /var/www/html/index.html
EOL
    chmod +x scripts/user-data.sh
fi

# Create VPC documentation
cat > docs/architecture/vpc-integration.md << EOL
# VPC Integration Guide

## Overview

This project is designed to deploy into the company's existing VPC infrastructure. All resources that require VPC connectivity will be deployed into the pre-configured VPC and subnets managed by the company administrators.

## VPC Details

- **VPC ID**: \`$VPC_ID\`
- **Subnet IDs**: \`$SUBNET_IDS\`

## Integration Points

### Network Resources

All network-dependent resources in this project will be deployed into the existing VPC infrastructure. This includes:

- EC2 instances
- RDS databases
- Lambda functions (when VPC access is required)
- Load balancers
- ECS tasks

### Security Groups

Security groups will be created within the existing VPC but managed by this project. Ensure that any security group rules comply with company network policies.

### Connectivity

For resources that need to communicate with external services:

1. Ensure the subnet has appropriate route tables configured
2. Check that security groups allow the necessary outbound traffic
3. Verify that network ACLs permit the required traffic

## Deployment Considerations

1. **Subnet Selection**: Choose appropriate subnets based on the resource requirements:
   - Public subnets for internet-facing resources
   - Private subnets for internal resources

2. **Availability Zones**: Distribute resources across multiple AZs for high availability

3. **IP Address Management**: Be mindful of IP address consumption in the shared VPC

## Troubleshooting

If you encounter connectivity issues:

1. Verify subnet configurations
2. Check security group rules
3. Validate network ACL settings
4. Ensure route tables are properly configured
5. Contact the network administrator if issues persist
EOL

echo -e "${GREEN}Project initialization complete!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Review and customize the generated files"
echo -e "2. Commit and push to your repository"
echo -e "3. Start building your application"
echo -e "${BLUE}=========================================${NC}"