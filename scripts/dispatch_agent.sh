#!/bin/bash

# Dispatches the executor agent

TASK_ID="$1"
shift
INSTRUCTIONS="$@"

echo "Dispatching executor for task $TASK_ID..."
cat .gemini/agents/executor.md | gemini --approval-mode auto_edit -p "Task ID: $TASK_ID. Instructions: $INSTRUCTIONS"
