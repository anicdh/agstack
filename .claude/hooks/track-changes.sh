#!/bin/bash
# Track file changes made by Claude for self-review hook
# Triggered on PostToolUse (Edit/Write)

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [ -z "$FILE_PATH" ]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Only track code files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.rs|*.prisma)
    CHANGES_FILE="/tmp/claude-changes-$$"
    echo "$FILE_PATH" >> "${CHANGES_FILE:-/tmp/claude-changes}"
    ;;
esac

echo '{"decision": "approve"}'
