variable "region" {
  description = "Region for the state bucket and every resource in infra/."
  type        = string
  default     = "us-west-2"
}

variable "github_repository" {
  description = "GitHub repository (owner/name) allowed to assume the CI roles."
  type        = string
  default     = "shshwtsuthar/dialplan"
}

variable "github_environment" {
  description = "GitHub environment whose jobs may assume the deploy role. Restrict it to the main branch in the repository settings."
  type        = string
  default     = "production"
}
