#!/usr/bin/env bash
# cast-dashboard-processor.sh
# Processes pending dashboard control commands from ~/.claude/dashboard-commands/
# Called by CAST hooks (PostToolUse or Stop event) to execute queued dispatches, kills, and approvals.
# Each command file is a JSON object with { id, type, payload, queuedAt, processedAt }.
# Commands with processedAt != null are skipped (already handled).

set -euo pipefail

COMMANDS_DIR="${HOME}/.claude/dashboard-commands"

# Guard: nothing to do if dir doesn't exist or is empty
[[ -d "$COMMANDS_DIR" ]] || exit 0

# Require jq
if ! command -v jq &>/dev/null; then
  echo "[cast-dashboard-processor] jq not found — cannot process commands" >&2
  exit 1
fi

for cmd_file in "$COMMANDS_DIR"/*.json; do
  [[ -f "$cmd_file" ]] || continue

  # Skip already-processed commands (processedAt is not null/empty)
  processed=$(jq -r '.processedAt // empty' "$cmd_file" 2>/dev/null)
  [[ -z "$processed" ]] || continue

  cmd_type=$(jq -r '.type // empty' "$cmd_file" 2>/dev/null)
  cmd_id=$(jq -r '.id // empty' "$cmd_file" 2>/dev/null)

  [[ -n "$cmd_type" ]] || continue

  case "$cmd_type" in
    dispatch)
      agent_type=$(jq -r '.payload.agentType // ""' "$cmd_file")
      prompt=$(jq -r '.payload.prompt // ""' "$cmd_file")
      model=$(jq -r '.payload.model // "claude-sonnet-4-6"' "$cmd_file")

      if [[ -z "$agent_type" || -z "$prompt" ]]; then
        echo "[cast-dashboard-processor] dispatch: missing agentType or prompt in $cmd_file" >&2
      else
        # Dispatch as a detached background claude invocation
        nohup claude --dangerously-skip-permissions \
          --model "$model" \
          -p "[Dashboard dispatch — Agent: ${agent_type}]

${prompt}" \
          > "$COMMANDS_DIR/${cmd_id}-output.log" 2>&1 &
        echo "[cast-dashboard-processor] Dispatched agent: $agent_type (PID $!)" >&2
      fi
      ;;

    kill)
      session_id=$(jq -r '.payload.sessionId // ""' "$cmd_file")

      if [[ -z "$session_id" ]]; then
        echo "[cast-dashboard-processor] kill: missing sessionId in $cmd_file" >&2
      else
        mkdir -p "$COMMANDS_DIR/kill-signals"
        # Write a sentinel file; target sessions check for this file via their own hooks
        printf '%s' "$session_id" > "$COMMANDS_DIR/kill-signals/${session_id}"
        echo "[cast-dashboard-processor] Kill signal written for session: $session_id" >&2
      fi
      ;;

    batch_approve|batch_reject)
      chain_id=$(jq -r '.payload.chainId // ""' "$cmd_file")

      if [[ -z "$chain_id" ]]; then
        echo "[cast-dashboard-processor] ${cmd_type}: missing chainId in $cmd_file" >&2
      else
        echo "[cast-dashboard-processor] Batch ${cmd_type}: chainId=${chain_id}" >&2
        # Approval signals are written to a dedicated dir for orchestrators to poll
        mkdir -p "$COMMANDS_DIR/batch-signals"
        printf '%s' "$cmd_type" > "$COMMANDS_DIR/batch-signals/${chain_id}"
      fi
      ;;

    *)
      echo "[cast-dashboard-processor] Unknown command type: $cmd_type in $cmd_file" >&2
      ;;
  esac

  # Mark command as processed
  tmp=$(mktemp)
  if jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.processedAt = $ts' "$cmd_file" > "$tmp"; then
    mv "$tmp" "$cmd_file"
  else
    rm -f "$tmp"
    echo "[cast-dashboard-processor] Failed to mark $cmd_file as processed" >&2
  fi

done
