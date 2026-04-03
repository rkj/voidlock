#!/bin/bash

if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: $0"
  echo ""
  echo "Runs the Manager Agent loop, which automatically selects and dispatches Sub-Agents for open tasks."
  exit 0
fi

#
MODEL="gemini-3-pro-preview"

while true; do
  # Check for remaining tasks
  TASKS=$(br list 2>/dev/null)
  if [ -z "$TASKS" ] || ! echo "$TASKS" | grep -v "voidlock-xyoaw" | grep -q "."; then
    echo "No relevant tasks remaining. Exiting manager loop."
    exit 0
  fi

  mkdir -p logs/manager
  LOG_FILE="logs/manager/manager_$(date +%Y-%m-%d_%H-%M-%S).log"
  echo "Logging to: $LOG_FILE"

  echo "Running with model: $MODEL"

  gemini -p "Activate manager skill and proceed" \
    --output-format stream-json \
    --model "$MODEL" \
    --policy ".gemini/policies/" \
    --policy ".gemini/extra-policies/manager.toml" \
    --approval-mode auto_edit \
    2>&1 | tee "$LOG_FILE"
  
  # Capture exit code of the gemini command (first element in PIPESTATUS)
  GEMINI_EXIT=${PIPESTATUS[0]}

  LAST_LINE=$(tail -n 1 "$LOG_FILE")

  # Detect quota exhaustion or model capacity issues
  # ONLY enter this block if the gemini command actually failed (non-zero exit code)
  if [ $GEMINI_EXIT -ne 0 ] && ([[ "$LAST_LINE" == *"You have exhausted your capacity on this model"* ]] || tail -n 20 "$LOG_FILE" | grep -q "RESOURCE_EXHAUSTED"); then
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
    elif tail -n 20 "$LOG_FILE" | grep -q "RESOURCE_EXHAUSTED" && [ "$MODEL" == "gemini-3-pro-preview" ]; then
      echo "RESOURCE_EXHAUSTED for $MODEL. Switching to gemini-3-flash-preview."
      MODEL="gemini-3-flash-preview"
      continue
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
