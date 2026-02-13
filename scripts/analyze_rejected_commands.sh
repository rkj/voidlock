#!/bin/bash

# Script to analyze policy-denied commands from Gemini logs
LOG_DIR="/home/rkj/voidlock/logs"

if [ ! -d "$LOG_DIR" ]; then
    echo "Error: Log directory $LOG_DIR not found."
    exit 1
fi

# Store rejected data
REJECTED_DATA=$(grep -h -B 1 '"output":"Tool execution denied by policy."' "$LOG_DIR"/*.log 2>/dev/null \
    | grep '"type":"tool_use"' \
    | jq -r 'if .tool_name == "run_shell_command" then .parameters.command else .tool_name end')

# Table 1: Full Command with Counts
echo "Rejected Full Commands by Count"
printf "%-7s | %s\n" "Count" "Full Command"
printf "%-7s | %s\n" "-------" "----------------"
echo "$REJECTED_DATA" | sort | uniq -c | sort -nr | while read -r line; do
    count=$(echo "$line" | awk '{print $1}')
    cmd=$(echo "$line" | cut -d' ' -f2-)
    printf "%-7s | %s\n" "$count" "$cmd"
done

echo ""

# Table 2: Base Command Names with Counts
echo "Rejected Base Commands (Tool Names) by Count"
printf "%-7s | %s\n" "Count" "Base Command"
printf "%-7s | %s\n" "-------" "------------"
echo "$REJECTED_DATA" | awk '{print $1}' | sort | uniq -c | sort -nr | while read -r line; do
    count=$(echo "$line" | awk '{print $1}')
    base=$(echo "$line" | awk '{print $2}')
    printf "%-7s | %s\n" "$count" "$base"
done
