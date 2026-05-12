# Nested CloudFormation Templates

This directory contains a set of nested CloudFormation templates for deploying a web application infrastructure.

## Template Structure

- `main-template.yaml` - The main template that orchestrates all nested stacks
- `templates/` - Directory containing all nested templates:
  - `security-groups.yaml` - Security group resources
  - `static-website.yaml` - S3 bucket and CloudFront distribution for static website hosting
  - `load-balancer.yaml` - Application Load Balancer resources

## Deployment

To deploy this stack:

```bash
aws cloudformation deploy \
  --template-file main-template.yaml \
  --stack-name my-web-app \
  --parameter-overrides \
      Environment=dev \
      VpcId=vpc-12345678 \
      SubnetIds=subnet-12345678,subnet-87654321 \
  --capabilities CAPABILITY_IAM
```

## Benefits of Nested Templates

1. **Modularity**: Each component is isolated in its own template
2. **Reusability**: Templates can be reused across different projects
3. **Maintainability**: Easier to update individual components
4. **Organization**: Better organization of complex infrastructure
5. **Parallel Processing**: AWS can process nested stacks in parallel, potentially speeding up deployment