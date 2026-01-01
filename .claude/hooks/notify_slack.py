#!/usr/bin/env python3

import os
import sys
import json
import requests
from datetime import datetime
from dotenv import load_dotenv


def get_final_response(transcript_path: str, max_length: int = 1500) -> str:
    """Extract Claude's final response from the transcript JSONL file."""
    if not transcript_path or not os.path.exists(os.path.expanduser(transcript_path)):
        return "(transcript not found)"

    try:
        expanded_path = os.path.expanduser(transcript_path)
        final_response = ""

        with open(expanded_path, "r") as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    # Look for assistant messages with text content
                    if entry.get("type") == "assistant" and entry.get("message"):
                        msg = entry["message"]
                        if msg.get("role") == "assistant" and msg.get("content"):
                            # Extract text from content blocks
                            text_parts = []
                            for block in msg["content"]:
                                if isinstance(block, dict) and block.get("type") == "text":
                                    text_parts.append(block.get("text", ""))
                                elif isinstance(block, str):
                                    text_parts.append(block)
                            if text_parts:
                                final_response = "\n".join(text_parts)
                except json.JSONDecodeError:
                    continue

        if not final_response:
            return "(no response found)"

        # Truncate if too long
        if len(final_response) > max_length:
            return final_response[:max_length] + "...\n_(truncated)_"
        return final_response

    except Exception as e:
        return f"(error reading transcript: {e})"


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

    # Get current timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    text = ""
    if event == "Notification":
        nt = payload.get("notification_type", "") or ""
        msg = payload.get("message", "") or ""
        text = (
            f"🧠 Claude Code: *{nt}*\n{msg}\n"
            f"• time: `{timestamp}`\n• cwd: `{cwd}`\n• session: `{session_id}`"
        )
    elif event == "Stop":
        active = payload.get("stop_hook_active", False)
        transcript_path = payload.get("transcript_path", "")
        final_response = get_final_response(transcript_path)

        text = (
            f"✅ Claude Code: *Stop*\n"
            f"• time: `{timestamp}`\n• cwd: `{cwd}`\n• session: `{session_id}`\n"
            f"• stop_hook_active: `{active}`\n\n"
            f"*Final Response:*\n```\n{final_response}\n```"
        )
    else:
        text = (
            f"Claude Code hook: {event}\n"
            f"• time: `{timestamp}`\n• cwd: {cwd}\n• session: {session_id}"
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