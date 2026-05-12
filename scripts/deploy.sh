#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}AWS Project Deployment Script${NC}"
echo -e "${BLUE}=========================================${NC}"

# Load project configuration
if [ -f config/project-config.json ]; then
  PROJECT_NAME=$(grep -o '"projectName": "[^"]*' config/project-config.json | cut -d'"' -f4)
  INFRA_TYPE=$(grep -o '"infraType": "[^"]*' config/project-config.json | cut -d'"' -f4)
  AWS_REGION=$(grep -o '"awsRegion": "[^"]*' config/project-config.json | cut -d'"' -f4)
  VPC_ID=$(grep -o '"vpcId": "[^"]*' config/project-config.json | cut -d'"' -f4)
  SUBNET_IDS=$(grep -o '"subnetIds": "[^"]*' config/project-config.json | cut -d'"' -f4)
else
  echo -e "${YELLOW}Project configuration not found. Please run init.sh first.${NC}"
  exit 1
fi

# Get deployment environment
echo -e "${YELLOW}Please select deployment environment:${NC}"
select ENV in "dev" "test" "prod"; do
  if [ -n "$ENV" ]; then
    break
  else
    echo "Invalid selection. Please try again."
  fi
done

# Deploy based on infrastructure type
if [ "$INFRA_TYPE" == "cloudformation" ]; then
  echo -e "${BLUE}Deploying CloudFormation stack...${NC}"
  
  # Check if using nested templates
  if [ -f infrastructure/cloudformation/main-template.yaml ]; then
    TEMPLATE_FILE="main-template.yaml"
    echo "Using nested template structure with main template: $TEMPLATE_FILE"
  elif [ -f infrastructure/cloudformation/template.yaml ]; then
    TEMPLATE_FILE="template.yaml"
    echo "Using single template: $TEMPLATE_FILE"
  else
    echo -e "${YELLOW}No CloudFormation template found.${NC}"
    exit 1
  fi
  
  # Deploy the stack
  aws cloudformation deploy \
    --template-file infrastructure/cloudformation/$TEMPLATE_FILE \
    --stack-name ${PROJECT_NAME}-${ENV} \
    --parameter-overrides \
        Environment=$ENV \
        VpcId=$VPC_ID \
        SubnetIds=$SUBNET_IDS \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
    --region $AWS_REGION
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}CloudFormation stack deployed successfully!${NC}"
    
    # Get stack outputs
    aws cloudformation describe-stacks \
      --stack-name ${PROJECT_NAME}-${ENV} \
      --query "Stacks[0].Outputs" \
      --region $AWS_REGION
  else
    echo -e "${YELLOW}CloudFormation deployment failed.${NC}"
    exit 1
  fi

elif [ "$INFRA_TYPE" == "cdk" ]; then
  echo -e "${BLUE}Deploying CDK stack...${NC}"
  cd infrastructure/cdk
  npm ci
  npm run build
  npm run cdk deploy -- --require-approval never --context environment=$ENV
  
elif [ "$INFRA_TYPE" == "terraform" ]; then
  echo -e "${BLUE}Deploying Terraform resources...${NC}"
  cd infrastructure/terraform
  terraform init
  terraform apply -auto-approve -var="environment=$ENV"
  
else
  echo -e "${YELLOW}Unsupported infrastructure type: $INFRA_TYPE${NC}"
  exit 1
fi

echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${BLUE}=========================================${NC}"