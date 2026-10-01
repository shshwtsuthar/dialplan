locals {
  # Function each route is served by.
  api_routes = {
    "GET /v1/health"                     = "route"
    "POST /v1/route"                     = "route"
    "GET /v1/numbers/{did}/rules"        = "rules"
    "PUT /v1/numbers/{did}/rules"        = "rules"
    "GET /v1/numbers/{did}/audit"        = "rules"
    "GET /v1/tenants/{tenantId}/numbers" = "rules"
    "POST /v1/demo/reset"                = "reset"
    "POST /v1/visit"                     = "visit"
  }

  api_functions = {
    route = module.route_function
    rules = module.rules_function
    reset = module.reset_function
    visit = module.visit_function
  }

  # Requests per second (steady rate / burst). Everything else gets the
  # stage default. The account's Lambda concurrency is the real ceiling.
  api_throttles = {
    "PUT /v1/numbers/{did}/rules" = { rate = 5, burst = 10 }
    "POST /v1/demo/reset"         = { rate = 1, burst = 2 }
    "POST /v1/visit"              = { rate = 1, burst = 3 }
  }
}

resource "aws_apigatewayv2_api" "http" {
  name          = "dialplan-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = concat([local.web_url], var.local_web_origins)
    allow_methods = ["GET", "POST", "PUT"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/dialplan-api"
  retention_in_days = 14
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 50
    throttling_burst_limit = 100
  }

  dynamic "route_settings" {
    for_each = local.api_throttles

    content {
      route_key              = route_settings.key
      throttling_rate_limit  = route_settings.value.rate
      throttling_burst_limit = route_settings.value.burst
    }
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      time             = "$context.requestTime"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      latencyMs        = "$context.responseLatency"
      integrationMs    = "$context.integrationLatency"
      integrationError = "$context.integrationErrorMessage"
      error            = "$context.error.message"
      sourceIp         = "$context.identity.sourceIp"
    })
  }

  # Route settings can only reference routes that exist.
  depends_on = [aws_apigatewayv2_route.this]
}

resource "aws_apigatewayv2_integration" "function" {
  for_each = local.api_functions

  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "this" {
  for_each = local.api_routes

  api_id    = aws_apigatewayv2_api.http.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.function[each.value].id}"
}

resource "aws_lambda_permission" "api" {
  for_each = local.api_functions

  statement_id  = "AllowHttpApiInvoke"
  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
