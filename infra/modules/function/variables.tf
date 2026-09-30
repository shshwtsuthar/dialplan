variable "name" {
  description = "Short name; the function is called dialplan-<name> and its code is api/src/handlers/<name>.ts."
  type        = string
}

variable "description" {
  type = string
}

variable "zip_path" {
  description = "Deployment package built by `npm run build:api`."
  type        = string
}

variable "permissions_boundary" {
  description = "ARN of the workload permissions boundary from infra/bootstrap."
  type        = string
}

variable "policy_statements" {
  description = "Permissions beyond writing its own logs. Keep these minimal."
  type = list(object({
    sid       = string
    actions   = list(string)
    resources = list(string)
  }))
  default = []
}

variable "environment" {
  type    = map(string)
  default = {}
}

variable "memory_size" {
  type    = number
  default = 512
}

variable "timeout" {
  description = "Seconds."
  type        = number
  default     = 10
}

variable "log_retention_days" {
  type    = number
  default = 14
}
