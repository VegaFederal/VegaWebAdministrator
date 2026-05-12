variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, test, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_id" {
  description = "ID of the existing company VPC"
  type        = string
}

variable "subnet_ids" {
  description = "List of existing subnet IDs for deployment"
  type        = list(string)
}