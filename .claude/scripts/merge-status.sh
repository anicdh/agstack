#!/bin/bash
# Aggregate status from all agent files
# Run: bash .claude/scripts/merge-status.sh
# Append to standup: bash .claude/scripts/merge-status.sh >> agile/sprints/sprint-XX/STANDUP.md

echo ""
echo "## $(date '+%Y-%m-%d')"
echo ""

for f in .claude/agents/*.md; do
  [ "$f" = ".claude/agents/_template.md" ] && continue
  [ ! -f "$f" ] && continue

  agent=$(basename "$f" .md)
  working=$(grep -A1 "Working on" "$f" | tail -1 | sed 's/.*\*\*: //')
  branch=$(grep -A1 "Branch" "$f" | tail -1 | sed 's/.*\*\*: //')
  blocked=$(grep -A1 "Blocked by" "$f" | tail -1 | sed 's/.*\*\*: //')
  last=$(grep -A1 "Last completed" "$f" | tail -1 | sed 's/.*\*\*: //')

  echo "### $agent"
  echo "- **Yesterday:** $last"
  echo "- **Today:** $working"
  if [ "$blocked" != "No" ] && [ -n "$blocked" ]; then
    echo "- **Blockers:** $blocked"
  else
    echo "- **Blockers:** No"
  fi
  echo ""
done
