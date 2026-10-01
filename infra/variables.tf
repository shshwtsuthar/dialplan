variable "region" {
  description = "AWS region. Must match the backend and infra/bootstrap."
  type        = string
  default     = "us-west-2"
}

variable "local_web_origins" {
  description = "Extra origins allowed by CORS, for running the web app locally."
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "alarm_email" {
  description = "Optional address to email when an alarm changes state or someone opens the page (confirm the subscription email)."
  type        = string
  default     = null
}
