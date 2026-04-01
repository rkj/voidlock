#!/bin/bash
EXCLUDE1="tests/renderer/regression_voidlock-txq8_visual_style_assets.test.ts"
EXCLUDE2="tests/renderer/ThemeManager.test.ts"

# Simple pattern for applyToCanvas mocks
PATTERN1='s/,? *applyToCanvas: vi\.fn([^)]*),?//g'

for f in $(grep -l "applyToCanvas" tests/**/*.test.ts tests/**/**/*.test.ts); do
    if [ "$f" == "$EXCLUDE1" ] || [ "$f" == "$EXCLUDE2" ]; then
        continue
    fi
    sed -i "$PATTERN1" "$f"
    # Clean up any resulting double commas or empty objects
    sed -i 's/, *,/,/g' "$f"
    sed -i 's/{ *,/{ /g' "$f"
    sed -i 's/, *}/ }/g' "$f"
    echo "Reverted $f"
done
