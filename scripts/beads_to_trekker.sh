#!/bin/bash
# Initialize Trekker
trekker init 2>/dev/null || true

echo "Starting migration..."

i=0
bd list --all --json --limit 0 | jq -c '.[]' | while read -r task_json; do
    echo parsing task $i: $task_json
    title=$(echo "$task_json" | jq -r '.title')
    desc=$(echo "$task_json" | jq -r '.description // ""')
    priority=$(echo "$task_json" | jq -r '.priority')
    status_raw=$(echo "$task_json" | jq -r '.status')

    status="todo"
    if [[ "$status_raw" == "closed" ]]; then
        status="completed"
    elif [[ "$status_raw" == "in_progress" ]]; then
        status="in_progress"
    fi

    cmd="trekker task create -t '$title' -d '$desc' -p '$priority' -s '$status'"
    echo "processing task $i: $cmd"
    eval "$cmd"
    echo "task $i done"
    ((i++))
    if (( i % 50 == 0 )); then
        echo "Progress: $i migrated..."
    fi
done

echo "Migration complete! Total tasks processed: $i"

