#!/usr/bin/env bash
# Fast iteration: rebuild one function and push its code straight to Lambda,
# skipping Terraform and CI.
#
#   scripts/push-function.sh route
#
# Uses your local AWS credentials (AWS_PROFILE, default "dialplan"). Only the
# code changes; configuration, permissions and routes still go through
# Terraform. Terraform compares the live code with the build from main, so
# the next plan shows the difference and the next deploy replaces it.

set -euo pipefail

name=${1:?usage: push-function.sh <function>, e.g. route}
export AWS_PROFILE=${AWS_PROFILE:-dialplan}

root=$(cd "$(dirname "$0")/.." && pwd)
npm run --silent build -w @dialplan/api -- "$name"

function_name="dialplan-$name"
aws lambda update-function-code \
  --function-name "$function_name" \
  --zip-file "fileb://$root/api/dist/$name.zip" \
  --query 'CodeSha256' --output text
aws lambda wait function-updated-v2 --function-name "$function_name"

echo "$function_name updated. The next deploy from main will replace it."
