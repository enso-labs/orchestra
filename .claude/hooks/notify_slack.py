#!/usr/bin/env python3

import os
import sys
import json
import requests
from dotenv import load_dotenv

def main():
    # Explicitly load env file from .claude/.env.claude
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.claude')
    load_dotenv(dotenv_path=dotenv_path)
    # Read SLACK_WEBHOOK_URL from environment variable
    slack_webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")

    if not slack_webhook_url:
        print("SLACK_WEBHOOK_URL is not set", file=sys.stderr)
        sys.exit(1)

    # Read input JSON from stdin
    try:
        input_str = sys.stdin.read()
        payload = json.loads(input_str)
    except Exception as e:
        print(f"Failed to parse input JSON: {e}", file=sys.stderr)
        sys.exit(1)

    event = payload.get("hook_event_name", "") or ""
    cwd = payload.get("cwd", "") or ""
    session_id = payload.get("session_id", "") or ""

    text = ""
    if event == "Notification":
        nt = payload.get("notification_type", "") or ""
        msg = payload.get("message", "") or ""
        text = (
            f"🧠 Claude Code: *{nt}*\n{msg}\n• cwd: `{cwd}`\n• session: `{session_id}`"
        )
    elif event == "Stop":
        active = payload.get("stop_hook_active", False)
        text = (
            f"✅ Claude Code: *Stop*\nClaude finished responding.\n"
            f"• cwd: `{cwd}`\n• session: `{session_id}`\n"
            f"• stop_hook_active: `{active}`"
        )
    else:
        text = (
            f"Claude Code hook: {event}\n• cwd: {cwd}\n• session: {session_id}"
        )

    slack_payload = {"text": text}

    try:
        response = requests.post(
            slack_webhook_url,
            json=slack_payload,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to send Slack notification: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()