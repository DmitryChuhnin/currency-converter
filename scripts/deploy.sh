#!/usr/bin/env bash
# Builds origin/main and publishes dist/ to the directory the web server serves as /converter/.
# Runs on the server from a clone of this repository: scripts/deploy.sh /path/to/site
set -euo pipefail

# The checkout below rewrites this file, and bash reads a script as it runs:
# everything lives in main, which is parsed in full before it starts.
main() {
    local target="${1:?usage: scripts/deploy.sh /path/to/site}"
    [ -d "$target" ] || { echo "no such directory: $target" >&2; exit 1; }

    cd "$(dirname "$0")/.."
    git fetch --quiet origin main
    git checkout --quiet --force --detach origin/main
    npm ci --no-audit --no-fund
    npm run build

    # --delay-updates puts new files in place together at the end, so a visitor does not get
    # the new index.html before its assets. Files of the previous build go after that.
    rsync -rlt --delete-after --delay-updates dist/ "${target%/}/"
    echo "deployed $(git rev-parse --short HEAD) to $target"
}

main "$@"
exit
