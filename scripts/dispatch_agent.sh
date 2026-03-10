#!/bin/bash
TASK_ID=$1
CONTEXT_FILE=$2

if [ "$TASK_ID" == "--help" ] || [ "$TASK_ID" == "-h" ]; then
  echo "Usage: $0 <TASK_ID> [CONTEXT_FILE]"
  echo ""
  echo "Dispatches a Sub-Agent to work on a specific task."
  echo ""
  echo "Arguments:"
  echo "  TASK_ID       The ID of the task from beads (e.g., voidlock-123)."
  echo "  CONTEXT_FILE  (Optional) Path to a file containing additional context for the agent."
  exit 0
fi

if [ -z "$TASK_ID" ]; then
  echo "Usage: $0 <TASK_ID> [CONTEXT_FILE]"
  exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

LOG_FILE="logs/${TASK_ID}.log"

PROMPT="You are a Sub-Agent. Your goal is to implement task $TASK_ID.

Instructions:
1. Run 'bd show $TASK_ID --json' to get the full task details.
2. Read @docs/spec/index.md and @docs/AGENTS.md.
3. Use the links in spec to find the specific spec file for your task (e.g. spec/ai.md for AI tasks).
4. Implement the changes.
5. Verify with tests.
6. DO NOT COMMIT or use 'jj'. The Manager handles version control.
7. Exit when done.
8. CRITICAL: When exiting, provide a concise summary of what was done, what was verified, and if there are any outstanding issues. Start your final message with 'SUMMARY:'."

if [ -n "$CONTEXT_FILE" ]; then
  if [ -f "$CONTEXT_FILE" ]; then
    CONTEXT_CONTENT=$(cat "$CONTEXT_FILE")
    PROMPT="${PROMPT}\n\nAdditional Context (from Manager):\n${CONTEXT_CONTENT}"
  else
    echo "Warning: Context file $CONTEXT_FILE not found."
  fi
fi

echo "Dispatching agent for task $TASK_ID. Output logged to $LOG_FILE"

TERM=dumb gemini --yolo \
  --output-format stream-json \
  --model gemini-3-flash-preview \
  --prompt "$PROMPT" 2>&1 | tee "$LOG_FILE"

EXIT_CODE=$?

echo "Agent exited with code $EXIT_CODE"
echo "---------------------------------------------------"
echo "Log tail ($LOG_FILE):"
tail -n 20 "$LOG_FILE"
echo "---------------------------------------------------"

exit $EXIT_CODE
