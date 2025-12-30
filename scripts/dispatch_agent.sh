#!/bin/bash
TASK_ID=$1

if [ -z "$TASK_ID" ]; then
  echo "Usage: $0 <TASK_ID>"
  exit 1
fi

gemini --model gemini-3-flash-preview \
  --allowed-tools list_directory \
  --allowed-tools read_file \
  --allowed-tools search_file_content \
  --allowed-tools glob \
  --allowed-tools replace \
  --allowed-tools write_file \
  --allowed-tools "run_shell_command(npx vitest)" \
  --allowed-tools "run_shell_command(npx tsc)" \
  --allowed-tools "run_shell_command(jj diff)" \
  --allowed-tools "run_shell_command(ls)" \
  --allowed-tools "run_shell_command(tail)" \
  --allowed-tools "run_shell_command(tree)" \
  --allowed-tools "run_shell_command(grep)" \
  --allowed-tools "run_shell_command(bd show)" \
  --allowed-tools new_page \
  --allowed-tools navigate_page \
  --allowed-tools take_screenshot \
  --allowed-tools click \
  --allowed-tools wait_for \
  --allowed-tools evaluate_script \
  "You are a Sub-Agent. Your goal is to implement task $TASK_ID.

Instructions:
1. Run 'bd show $TASK_ID --json' to get the full task details.
2. Read @spec/core_mechanics.md and @AGENTS.md.
3. Use the links in @spec/core_mechanics.md to find the specific spec file for your task (e.g. spec/ai.md for AI tasks).
4. Implement the changes.
5. Verify with tests.
6. DO NOT COMMIT or use 'jj'. The Manager handles version control.
7. Exit when done."
