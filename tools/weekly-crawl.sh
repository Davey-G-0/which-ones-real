#!/usr/bin/env bash
# weekly-crawl.sh — Stage 1 of the "Which One's Real?" content pipeline.
#
# Run weekly by cron (no_agent mode: this script IS the job). It re-walks the
# Wikipedia category trees (fresh) for the mined segments, dedupes against the
# live bank + every past pool, and writes fresh pool files + a per-segment
# review report.  NO auto-merge: pools land as review sheets for authoring.
#
# stdout is delivered VERBATIM to the Fake News Game Discord thread, so keep it
# concise (Discord 2000-char limit).  A non-zero exit triggers an error alert;
# always exit 0 unless the whole thing is broken.
#
# Budget: fresh walk + leads + scoring, ~15-25 min with --no-pop. Well under
# the 60-min cron script timeout. --no-pop skips the pageviews endpoint (which
# throttles aggressively); ranking relies on weirdness score only.
#
# Override for a quick single-segment canary:  SEGS_OVERRIDE=history ./weekly-crawl.sh

cd /home/hermes/which-ones-real || { echo "weekly-crawl: cannot cd to repo"; exit 1; }

SEGS="${SEGS_OVERRIDE:-weird disasters sports sciencetech history animals}"
MAXCAND=60
# crawl.js names pool files with the UTC date (toISOString), so the label must
# match or the "next steps" glob points at the wrong file.
DATE=$(date -u +%Y%m%d)

results=()
errors=()
total=0

for seg in $SEGS; do
  # Fresh discovery pass: drop the crash-checkpoint so we re-walk the category
  # tree and pick up Wikipedia articles added since the last run.
  rm -f "tools/.crawl-ckpt-${seg}.json"

  out=$(node tools/crawl.js "$seg" "$MAXCAND" --no-pop 2>&1)
  rc=$?
  if [ $rc -ne 0 ]; then
    errors+=("$seg (exit $rc)")
    continue
  fi

  # The crawl prints exactly:  POOL  tools/pools/crawl-<seg>-<date>.json  (N candidates)
  line=$(printf '%s\n' "$out" | grep -m1 '^POOL')
  if [ -z "$line" ]; then
    results+=("$seg: 0 new (nothing found)")
    continue
  fi
  n=$(printf '%s\n' "$line" | grep -oE '\([0-9]+ candidates?\)' | grep -oE '[0-9]+' | head -1)
  n=${n:-0}
  total=$((total + n))
  results+=("$seg: +$n")
done

# --- compose the delivered message ------------------------------------------
echo "🗞️ **WOR weekly crawl — ${DATE}**"
echo
echo "Fresh Wikipedia pass (Stage 1 only — pools are review sheets, no auto-merge):"
for r in ${results[@]+"${results[@]}"}; do
  echo "• $r"
done
if [ ${#errors[@]} -gt 0 ]; then
  echo
  echo "⚠️ Errors: ${errors[*]}"
fi
echo
if [ "$total" -eq 0 ]; then
  echo "No new candidates this week — those category trees are well-mined. Widen roots in tools/crawl.js, or wait for fresh Wikipedia articles."
else
  echo "**${total} new candidates** across ${#results[@]} segment(s) → tools/pools/crawl-*-${DATE}.json"
  echo "Next, when you're ready: node tools/resolve.js <pool.json> → author → verify.js → merge.js (I can run the authoring wave on your go)."
fi
exit 0
