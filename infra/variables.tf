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
