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

    # Safety: Kill any stuck bun/trekker processes from previous iterations
    # pkill -f "trekker" 2>/dev/null || true
    
    cmd=$(printf "trekker task create -t %q -d %q -p %q -s %q" "$title" "$desc" "$priority" "$status")
    
    echo "processing task $i: $cmd"
    # Use timeout to prevent hangs if bun deadlocks
    if timeout 2s bash -c "$cmd";  then
        echo "task $i done"
    else
        echo "task $i TIMED OUT - skipping"
    fi
    
    ((i++))
    if (( i % 50 == 0 )); then
        echo "Progress: $i migrated..."
    fi
    
    # Slight breather for the runtime
    sleep 0.1
done

echo "Migration complete! Total tasks processed: $i"
