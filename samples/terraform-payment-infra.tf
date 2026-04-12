# Bank Indonesia Payment Infrastructure - Terraform Configuration
# WARNING: This file contains intentional security issues for IaC Review testing

provider "aws" {
  region = "ap-southeast-1"
}

# VPC Configuration
resource "aws_vpc" "payment_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "bi-payment-vpc"
  }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.payment_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-southeast-1a"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.payment_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "ap-southeast-1b"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.payment_vpc.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "ap-southeast-1a"
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.payment_vpc.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "ap-southeast-1b"
}

# SECURITY ISSUE: Overly permissive security group
resource "aws_security_group" "app_sg" {
  name   = "payment-app-sg"
  vpc_id = aws_vpc.payment_vpc.id

  # ISSUE: Allows SSH from anywhere
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  # ISSUE: Allows all inbound HTTPS (should be restricted to LB)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # ISSUE: Allows all inbound on port 8080
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "App port"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# SECURITY ISSUE: Overly permissive IAM role
resource "aws_iam_role" "app_role" {
  name = "payment-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

# ISSUE: Wildcard permissions
resource "aws_iam_role_policy" "app_policy" {
  name = "payment-app-policy"
  role = aws_iam_role.app_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "*"
      Resource = "*"
    }]
  })
}

# RDS Instance
resource "aws_db_instance" "payment_db" {
  identifier     = "bi-payment-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.xlarge"

  allocated_storage     = 100
  max_allocated_storage = 500

  db_name  = "payment_db"
  username = "admin"
  # SECURITY ISSUE: Hardcoded password
  password = "SuperSecret123!"

  # ISSUE: No encryption at rest
  storage_encrypted = false

  # ISSUE: Publicly accessible
  publicly_accessible = true

  vpc_security_group_ids = [aws_security_group.app_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.payment_db_subnet.name

  # ISSUE: No backup retention
  backup_retention_period = 0

  # ISSUE: No deletion protection
  deletion_protection = false

  skip_final_snapshot = true
}

resource "aws_db_subnet_group" "payment_db_subnet" {
  name       = "payment-db-subnet"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

# S3 Bucket for transaction logs
resource "aws_s3_bucket" "transaction_logs" {
  bucket = "bi-payment-transaction-logs"
  # ISSUE: No tags
}

# ISSUE: No versioning enabled
# ISSUE: No server-side encryption configured
# ISSUE: No lifecycle policy
# ISSUE: No access logging

# ElastiCache for session/idempotency
resource "aws_elasticache_cluster" "payment_cache" {
  cluster_id           = "payment-cache"
  engine               = "redis"
  node_type            = "cache.r6g.large"
  num_cache_nodes      = 1
  # ISSUE: Single node, no replication for HA
  # ISSUE: No encryption in transit
  port                 = 6379
  security_group_ids   = [aws_security_group.app_sg.id]
  subnet_group_name    = aws_elasticache_subnet_group.payment_cache_subnet.name
}

resource "aws_elasticache_subnet_group" "payment_cache_subnet" {
  name       = "payment-cache-subnet"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

# EC2 Instances for application
resource "aws_instance" "app_server_1" {
  ami           = "ami-0abc123def456789a"
  instance_type = "c6i.2xlarge"
  subnet_id     = aws_subnet.private_a.id
  key_name      = "payment-keypair"

  vpc_security_group_ids = [aws_security_group.app_sg.id]

  # ISSUE: No IMDSv2 enforcement
  # ISSUE: No instance tags
  # ISSUE: No monitoring enabled

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    # ISSUE: No encryption
    encrypted   = false
  }
}

# ISSUE: No auto-scaling group
# ISSUE: No load balancer
# ISSUE: No CloudWatch alarms
# ISSUE: No WAF configuration
# ISSUE: No VPC Flow Logs

output "db_endpoint" {
  value = aws_db_instance.payment_db.endpoint
}

output "app_server_ip" {
  # ISSUE: Exposing private IP in outputs
  value = aws_instance.app_server_1.private_ip
}
