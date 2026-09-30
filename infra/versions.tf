terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.66"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.13"
    }
  }

  # Bucket created by infra/bootstrap. S3-native locking (a .tflock object
  # next to the state) replaces the old DynamoDB lock table.
  backend "s3" {
    bucket       = "dialplan-tfstate-906a55d69be9ea3ffaf2ab6af4"
    key          = "infra/terraform.tfstate"
    region       = "us-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project    = "dialplan"
      managed-by = "terraform"
    }
  }
}
