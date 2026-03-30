#!/usr/bin/env bash
#
# agStack Bootstrap — One-liner project setup
#
# Usage (paste into Claude Code terminal):
#   bash <(curl -fsSL https://raw.githubusercontent.com/anicdh/agstack/main/scripts/bootstrap.sh) my-project
#
# Or if you already cloned:
#   bash scripts/bootstrap.sh my-project
#
# What it does:
#   1. Clone agStack starter kit
#   2. Remove git history, init fresh repo
#   3. Invoke /setup skill automatically

set -eo pipefail

PROJECT_NAME="${1:-}"

if [ -z "$PROJECT_NAME" ]; then
  echo ""
  echo "  agStack — Full-stack starter kit for Claude MAX"
  echo ""
  echo "  Usage:"
  echo "    bash <(curl -fsSL https://raw.githubusercontent.com/anicdh/agstack/main/scripts/bootstrap.sh) <project-name>"
  echo ""
  echo "  Example:"
  echo "    bash <(curl -fsSL https://raw.githubusercontent.com/anicdh/agstack/main/scripts/bootstrap.sh) my-saas-app"
  echo ""
  exit 1
fi

# Validate project name (kebab-case)
if ! echo "$PROJECT_NAME" | grep -qE '^[a-z][a-z0-9-]*$'; then
  echo "ERROR: Project name must be kebab-case (e.g., my-saas-app)"
  exit 1
fi

echo ""
echo "=== agStack Bootstrap ==="
echo "  Project: $PROJECT_NAME"
echo ""

# 1. Clone
if [ -d "$PROJECT_NAME" ]; then
  echo "ERROR: Directory '$PROJECT_NAME' already exists."
  exit 1
fi

echo "Cloning agStack starter kit..."
git clone --depth 1 https://github.com/anicdh/agstack.git "$PROJECT_NAME"
cd "$PROJECT_NAME"

# 2. Fresh git
rm -rf .git
git init
git add -A
git commit -m "init: scaffold from agStack starter kit"

echo ""
echo "=== Done! ==="
echo ""
echo "  cd $PROJECT_NAME"
echo "  claude"
echo "  > /setup"
echo ""
echo "  Or run everything in one shot:"
echo "  cd $PROJECT_NAME && claude -p '/setup'"
echo ""
