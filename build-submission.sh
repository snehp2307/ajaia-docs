#!/bin/sh
# Builds the Drive submission folder on the Desktop from the latest *committed* files.
# Commit your changes first, then run: sh build-submission.sh
set -e
OUT="$HOME/Desktop/Sneh-Patel-Ajaia-Submission"
rm -rf "$OUT" && mkdir -p "$OUT/screenshots"
for f in README.md ARCHITECTURE.md AI_WORKFLOW.md SUBMISSION.md VIDEO_URL.txt; do git show "HEAD:$f" > "$OUT/$f"; done
for f in $(git ls-tree --name-only HEAD screenshots/); do git show "HEAD:$f" > "$OUT/$f"; done
git archive --format=zip --prefix=ajaia-docs/ -o "$OUT/source-code.zip" HEAD
echo "Built $OUT"
grep -c "TODO" "$OUT/AI_WORKFLOW.md" | sed 's/^/  TODOs left in AI_WORKFLOW.md: /'
grep -q "_VIDEO_URL_" "$OUT/VIDEO_URL.txt" && echo "  VIDEO_URL.txt still has the placeholder" || echo "  VIDEO_URL.txt: $(cat "$OUT/VIDEO_URL.txt")"
