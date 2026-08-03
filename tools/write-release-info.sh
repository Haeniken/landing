#!/bin/sh
set -eu

output=${1:?"usage: write-release-info.sh OUTPUT [REVISION] [DEPLOYED_AT]"}
revision=${2:-$(git rev-parse --short=7 HEAD)}
deployed_at=${3:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}
temporary="${output}.tmp.$$"

umask 022
printf '{\n  "revision": "%s",\n  "deployedAt": "%s"\n}\n' "$revision" "$deployed_at" > "$temporary"
mv "$temporary" "$output"
