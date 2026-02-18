#!/bin/bash
#
MODEL="gemini-3-pro-preview"

while true; do
  # Check for remaining tasks
  TASKS=$(bd list 2>/dev/null)
  if [ -z "$TASKS" ] || ! echo "$TASKS" | grep -v "voidlock-xyoaw" | grep -q "."; then
    echo "No relevant tasks remaining. Exiting manager loop."
    exit 0
  fi

  mkdir -p logs/manager
  LOG_FILE="logs/manager/manager_$(date +%Y-%m-%d_%H-%M-%S).log"
  echo "Logging to: $LOG_FILE"

  echo "Running with model: $MODEL"

  gemini -p "@docs/MANAGER.md" \
    --output-format stream-json \
    --model "$MODEL" \
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
    --allowed-tools "run_shell_command(find)" \
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
    --allowed-tools write_file | tee "$LOG_FILE"

  LAST_LINE=$(tail -n 1 "$LOG_FILE")

  if [[ "$LAST_LINE" == *"You have exhausted your capacity on this model"* ]]; then
    TIME_STR=$(echo "$LAST_LINE" | sed -n 's/.*reset after \([0-9hms]\+\).*/\1/p')
    if [ -n "$TIME_STR" ]; then
      echo "Quota exhausted for $MODEL. Reset in $TIME_STR."
      HOURS=$(echo "$TIME_STR" | grep -o '[0-9]\+h' | tr -d 'h' || echo 0)
      MINS=$(echo "$TIME_STR" | grep -o '[0-9]\+m' | tr -d 'm' || echo 0)
      SECS=$(echo "$TIME_STR" | grep -o '[0-9]\+s' | tr -d 's' || echo 0)
      
      [ -z "$HOURS" ] && HOURS=0
      [ -z "$MINS" ] && MINS=0
      [ -z "$SECS" ] && SECS=0
      
      WAIT_TIME=$((HOURS * 3600 + MINS * 60 + SECS + 10))
      
      if [ "$MODEL" == "gemini-3-pro-preview" ] && [ "$WAIT_TIME" -gt 3600 ]; then
        echo "Wait time is > 1 hour. Switching to gemini-3-flash-preview."
        MODEL="gemini-3-flash-preview"
        continue
      elif [ "$MODEL" == "gemini-3-flash-preview" ]; then
        echo "Quota exhausted on Flash. Switching back to gemini-3-pro-preview and waiting."
        MODEL="gemini-3-pro-preview"
        echo "Sleeping for $WAIT_TIME seconds..."
        sleep "$WAIT_TIME"
      else
        echo "Sleeping for $WAIT_TIME seconds..."
        sleep "$WAIT_TIME"
      fi

    else
      echo "Quota exhausted but couldn't parse time. Sleeping for 60s."
      sleep 60
    fi
  else
    echo "Process finished. Resetting to gemini-3-pro-preview. Sleeping for 60s..."
    MODEL="gemini-3-pro-preview"
    sleep 60
  fi
done
