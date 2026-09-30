terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.66"
    }
  }

  # Deliberately local state: this config creates the bucket that holds
  # everyone else's state, and is applied by hand from a laptop.
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project    = "dialplan"
      stack      = "bootstrap"
      managed-by = "terraform"
    }
  }
}
