#!/usr/bin/env bash
# Deploys a static build to an Amplify branch with no connected repository:
# create a deployment, upload the zip, start it, wait for the result.
#
#   scripts/deploy-web.sh <amplify-app-id> <branch> <build-dir>

set -euo pipefail

app_id=${1:?usage: deploy-web.sh <amplify-app-id> <branch> <build-dir>}
branch=${2:?usage: deploy-web.sh <amplify-app-id> <branch> <build-dir>}
build_dir=${3:?usage: deploy-web.sh <amplify-app-id> <branch> <build-dir>}

archive=$(mktemp -d)/site.zip
(cd "$build_dir" && zip -qr "$archive" .)

read -r job_id upload_url < <(
  aws amplify create-deployment --app-id "$app_id" --branch-name "$branch" \
    --query '[jobId, zipUploadUrl]' --output text
)

curl --fail --silent --show-error -X PUT -H 'Content-Type: application/zip' \
  --upload-file "$archive" "$upload_url"

aws amplify start-deployment --app-id "$app_id" --branch-name "$branch" --job-id "$job_id" >/dev/null
echo "Amplify job $job_id started"

for _ in $(seq 60); do
  status=$(aws amplify get-job --app-id "$app_id" --branch-name "$branch" --job-id "$job_id" \
    --query 'job.summary.status' --output text)
  case $status in
    SUCCEED) echo "Amplify job $job_id succeeded"; exit 0 ;;
    FAILED | CANCELLED) echo "Amplify job $job_id: $status" >&2; exit 1 ;;
  esac
  sleep 5
done

echo "Timed out waiting for Amplify job $job_id" >&2
exit 1
