#!/usr/bin/env bash
set -euo pipefail

# Put your webhook here OR export SLACK_WEBHOOK_URL in your shell env
: "${SLACK_WEBHOOK_URL:=}"

if [[ -z "${SLACK_WEBHOOK_URL}" ]]; then
  echo "SLACK_WEBHOOK_URL is not set" >&2
  exit 1
fi

# Hook input JSON comes via stdin in Claude Code hooks
INPUT="$(cat)"

EVENT="$(jq -r '.hook_event_name // ""' <<<"$INPUT")"
CWD="$(jq -r '.cwd // ""' <<<"$INPUT")"
SESSION="$(jq -r '.session_id // ""' <<<"$INPUT")"

TEXT=""
case "$EVENT" in
  Notification)
    NT="$(jq -r '.notification_type // ""' <<<"$INPUT")"
    MSG="$(jq -r '.message // ""' <<<"$INPUT")"
    TEXT="🧠 Claude Code: *${NT}*\n${MSG}\n• cwd: \`${CWD}\`\n• session: \`${SESSION}\`"
    ;;
  Stop)
    ACTIVE="$(jq -r '.stop_hook_active // false' <<<"$INPUT")"
    TEXT="✅ Claude Code: *Stop*\nClaude finished responding.\n• cwd: \`${CWD}\`\n• session: \`${SESSION}\`\n• stop_hook_active: \`${ACTIVE}\`"
    ;;
  *)
    TEXT="Claude Code hook: ${EVENT}\n• cwd: ${CWD}\n• session: ${SESSION}"
    ;;
esac

PAYLOAD="$(jq -n --arg text "$TEXT" '{text: $text}')"

curl -sS -X POST \
  -H 'Content-type: application/json' \
  --data "$PAYLOAD" \
  "$SLACK_WEBHOOK_URL" >/dev/null
SH

chmod +x ~/.claude/hooks/notify-slack.sh
