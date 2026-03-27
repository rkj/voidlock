#!/bin/bash

# Dispatches the executor agent

TASK_ID="$1"
shift
INSTRUCTIONS="$@"

echo "Dispatching executor for task $TASK_ID..."
gemini run --agent executor -p "Task ID: $TASK_ID. Instructions: $INSTRUCTIONS"
