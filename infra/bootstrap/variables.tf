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

# GitHub's immutable OIDC subjects embed the numeric owner and repository IDs,
# so a deleted-and-recreated repo with the same name cannot assume the roles.
# gh api repos/OWNER/REPO --jq '{id, owner_id: .owner.id}'
variable "github_owner_id" {
  type    = number
  default = 74776092
}

variable "github_repository_id" {
  type    = number
  default = 1397020900
}

variable "github_environment" {
  description = "GitHub environment whose jobs may assume the deploy role. Restrict it to the main branch in the repository settings."
  type        = string
  default     = "production"
}
