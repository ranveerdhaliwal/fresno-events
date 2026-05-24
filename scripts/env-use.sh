#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/dev-target.sh
source "$REPO_ROOT/scripts/dev-target.sh"
export REPO_ROOT
dev_target_set "${1:?Usage: env-use.sh local|cloud-dev|cloud-prod}"
