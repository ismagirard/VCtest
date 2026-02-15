#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export CODEX_BIN="/Users/ismaelgirard/.npm-global/bin/codex"
export CODEX_REVIEW_TIMEOUT_MS="240000"
export NTFY_TOPIC="ismael-branddoc-qa-vctest-9f3k"
export NTFY_FULL_PROMPT="1"
# Set this to your Slack incoming webhook URL to enable Slack messages.
# Example: https://hooks.slack.com/services/XXX/YYY/ZZZ
export SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
export SLACK_FULL_PROMPT="1"

cd /Users/ismaelgirard/repos/VCtest/branddoc-cli
exec npm run codex:watch
