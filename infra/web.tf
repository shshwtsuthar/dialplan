# Static hosting for the Next.js export. No repository is connected: CI
# uploads each build through the Amplify deployment API (scripts/deploy-web.sh).

resource "aws_amplify_app" "web" {
  name     = "dialplan-web"
  platform = "WEB"

  custom_rule {
    source = "/<*>"
    target = "/404.html"
    status = "404"
  }

  custom_headers = yamlencode({
    customHeaders = [
      {
        pattern = "**"
        headers = [
          { key = "Strict-Transport-Security", value = "max-age=31536000; includeSubDomains" },
          { key = "X-Content-Type-Options", value = "nosniff" },
          { key = "X-Frame-Options", value = "DENY" },
          { key = "Referrer-Policy", value = "strict-origin-when-cross-origin" },
        ]
      },
      {
        pattern = "_next/static/**"
        headers = [
          { key = "Cache-Control", value = "public, max-age=31536000, immutable" },
        ]
      },
    ]
  })
}

resource "aws_amplify_branch" "main" {
  app_id            = aws_amplify_app.web.id
  branch_name       = "main"
  stage             = "PRODUCTION"
  enable_auto_build = false
}

locals {
  web_url = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.web.default_domain}"
}
