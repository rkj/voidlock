#!/bin/bash
TASK_ID=$1
CONTEXT_FILE=$2

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
2. Read @docs/spec/index.md and @AGENTS.md.
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

gemini --output-format stream-json \
  --model gemini-3-flash-preview \
  --allowed-tools "run_shell_command(bd show)" \
  --allowed-tools "run_shell_command(grep)" \
  --allowed-tools "run_shell_command(jj diff)" \
  --allowed-tools "run_shell_command(jj show)" \
  --allowed-tools "run_shell_command(jj status)" \
  --allowed-tools "run_shell_command(ls)" \
  --allowed-tools "run_shell_command(npm run build)" \
  --allowed-tools "run_shell_command(npm run lint)" \
  --allowed-tools "run_shell_command(npm run process-assets)" \
  --allowed-tools "run_shell_command(npm run test)" \
  --allowed-tools "run_shell_command(npx madge)" \
  --allowed-tools "run_shell_command(npx prettier)" \
  --allowed-tools "run_shell_command(npx tsc)" \
  --allowed-tools "run_shell_command(npx vite build)" \
  --allowed-tools "run_shell_command(npx vitest)" \
  --allowed-tools "run_shell_command(rm tests/)" \
  --allowed-tools "run_shell_command(tail)" \
  --allowed-tools "run_shell_command(tree)" \
  --allowed-tools click \
  --allowed-tools close_page \
  --allowed-tools drag \
  --allowed-tools evaluate_script \
  --allowed-tools fill \
  --allowed-tools fill_form \
  --allowed-tools get_console_message \
  --allowed-tools handle_dialog \
  --allowed-tools glob \
  --allowed-tools list_directory \
  --allowed-tools press_key \
  --allowed-tools list_pages \
  --allowed-tools navigate_page \
  --allowed-tools new_page \
  --allowed-tools read_file \
  --allowed-tools replace \
  --allowed-tools search_file_content \
  --allowed-tools take_screenshot \
  --allowed-tools take_snapshot \
  --allowed-tools wait_for \
  --allowed-tools write_file \
  "$PROMPT" > "$LOG_FILE" 2>&1

EXIT_CODE=$?

echo "Agent exited with code $EXIT_CODE"
echo "---------------------------------------------------"
echo "Log tail ($LOG_FILE):"
tail -n 20 "$LOG_FILE"
echo "---------------------------------------------------"

exit $EXIT_CODE
