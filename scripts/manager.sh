#!/bin/bash
#
while true; do
  TMP_OUTPUT=$(mktemp)

  gemini -p "@MANAGER.md" \
    --output-format stream-json \
    --model gemini-3-pro-preview \
    --allowed-tools "run_shell_command(bd)" \
    --allowed-tools "run_shell_command(./scripts/dispatch_agent.sh)" \
    --allowed-tools "run_shell_command(scripts/dispatch_agent.sh)" \
    --allowed-tools "run_shell_command(grep)" \
    --allowed-tools "run_shell_command(jj commit)" \
    --allowed-tools "run_shell_command(jj diff)" \
    --allowed-tools "run_shell_command(jj log)" \
    --allowed-tools "run_shell_command(jj status)" \
    --allowed-tools "run_shell_command(jj show)" \
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
    --allowed-tools write_file | tee "$TMP_OUTPUT"

  LAST_LINE=$(tail -n 1 "$TMP_OUTPUT")
  rm "$TMP_OUTPUT"

  if [[ "$LAST_LINE" == *"You have exhausted your capacity on this model"* ]]; then
    TIME_STR=$(echo "$LAST_LINE" | sed -n 's/.*reset after \([0-9hms]\+\).*/\1/p')
    if [ -n "$TIME_STR" ]; then
      echo "Quota exhausted. Reset in $TIME_STR."
      HOURS=$(echo "$TIME_STR" | grep -o '[0-9]\+h' | tr -d 'h' || echo 0)
      MINS=$(echo "$TIME_STR" | grep -o '[0-9]\+m' | tr -d 'm' || echo 0)
      SECS=$(echo "$TIME_STR" | grep -o '[0-9]\+s' | tr -d 's' || echo 0)
      
      [ -z "$HOURS" ] && HOURS=0
      [ -z "$MINS" ] && MINS=0
      [ -z "$SECS" ] && SECS=0
      
      WAIT_TIME=$((HOURS * 3600 + MINS * 60 + SECS + 10))
      echo "Sleeping for $WAIT_TIME seconds..."
      sleep "$WAIT_TIME"
    else
      echo "Quota exhausted but couldn't parse time. Sleeping for 60s."
      sleep 60
    fi
  else
    echo "Process finished. Sleeping for 60s..."
    sleep 60
  fi
done