#!/bin/bash
# Self-review hook — runs when Claude stops
# Checks if code files were modified and asks Claude to verify quality

INPUT=$(cat)

# Prevent infinite loop
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Check if any code files were modified in this session
CHANGES_FILE="/tmp/claude-changes"
if [ ! -f "$CHANGES_FILE" ] || [ ! -s "$CHANGES_FILE" ]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Get unique changed files
CHANGED_FILES=$(sort -u "$CHANGES_FILE" | head -20)
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')

if [ "$FILE_COUNT" -eq 0 ]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Rotate through review focus areas
ROTATION_FILE="/tmp/claude-review-rotation"
ROTATION=$(cat "$ROTATION_FILE" 2>/dev/null || echo "0")
NEXT_ROTATION=$(( (ROTATION + 1) % 5 ))
echo "$NEXT_ROTATION" > "$ROTATION_FILE"

case $ROTATION in
  0) FOCUS="Check for TODO/FIXME placeholders, console.log, and commented-out code that should not be committed." ;;
  1) FOCUS="Verify error handling: are all error cases covered? Are errors typed correctly (not generic Error)?" ;;
  2) FOCUS="Check type safety: any use of 'any', 'as' casts, or missing type annotations?" ;;
  3) FOCUS="Review function sizes: any function > 50 lines? Any file > 300 lines? Suggest splits if needed." ;;
  4) FOCUS="Verify naming: are variables/functions descriptive? Do they follow project naming conventions?" ;;
esac

# Build the review prompt
FILES_LIST=$(echo "$CHANGED_FILES" | sed 's/^/- /')

cat <<EOF
{
  "decision": "block",
  "reason": "Self-review: ${FILE_COUNT} files were modified. Please review before completing.\n\nChanged files:\n${FILES_LIST}\n\nFocus: ${FOCUS}\n\nRead each changed file and verify it follows CLAUDE.md conventions. If issues found, fix them. If all good, confirm and proceed."
}
EOF

# Clean up for next session
rm -f "$CHANGES_FILE"
