#!/usr/bin/env bash
# Print the CHANGELOG section for a version (argument: "0.2.0" or "v0.2.0"). Exits 1 if it is missing or empty.
set -euo pipefail
version="${1#v}"
notes="$(awk -v v="$version" '
  $0 ~ "^## \\[" v "\\]" { found=1; next }
  found && /^## \[/ { exit }
  found { print }
' CHANGELOG.md | sed -e '/./,$!d')"
if [ -z "${notes//[[:space:]]/}" ]; then
  echo "CHANGELOG.md has no (or an empty) section for version ${version}" >&2
  exit 1
fi
printf '%s\n' "$notes"
