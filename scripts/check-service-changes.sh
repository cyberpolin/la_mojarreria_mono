#!/usr/bin/env bash
set -euo pipefail

service_path="${1:-}"

if [ -z "$service_path" ]; then
  echo "Usage: $0 <service-path>" >&2
  exit 2
fi

base_sha="${CHECK_BASE_SHA:-}"
head_sha="${CHECK_HEAD_SHA:-HEAD}"

if [ -z "$base_sha" ] || [ "$base_sha" = "0000000000000000000000000000000000000000" ]; then
  if git rev-parse HEAD^ >/dev/null 2>&1; then
    base_sha="HEAD^"
  else
    base_sha="$head_sha"
  fi
fi

echo "Checking changes for $service_path"
echo "Base: $base_sha"
echo "Head: $head_sha"

changed_files="$(git diff --name-only "$base_sha" "$head_sha" -- "$service_path" || true)"

set_output() {
  name="$1"
  value="$2"

  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$name=$value" >> "$GITHUB_OUTPUT"
  else
    echo "$name=$value"
  fi
}

if [ -n "$changed_files" ]; then
  set_output changed true
  echo "Changed files:"
  printf '%s\n' "$changed_files"
else
  set_output changed false
  echo "No changes in $service_path"
fi
