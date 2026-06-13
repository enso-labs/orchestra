#!/usr/bin/env bash
# evals/run.sh — discover evals/probes/*.sh, run each against real state, and
# write evals/RESULTS.md benchmark scoreboard (overwrite-row-per-probe).
# Exit-code oracle per probe: 0=PASS 1=REGRESSION 2=SKIPPED 124=TIMEOUT other=ERROR.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"    # evals/run.sh -> repo root (one level up)
PROBES_DIR="$ROOT/evals/probes"
RESULTS="$ROOT/evals/RESULTS.md"
TIMEOUT_SECS=120

FILTER_PROBE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --probe) FILTER_PROBE="${2:-}"; shift 2 ;;
    -h|--help) echo "usage: run.sh [--probe <id>]"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

# Temp-file handle for the atomic scoreboard write.
tmp=""
trap '[ -n "$tmp" ] && rm -f "$tmp"' EXIT

# Capture the pre-write scoreboard ONCE. Carry-forward (prior_row) reads this
# snapshot, never the live $RESULTS — a filtered run cannot erase untouched
# rows, and a crash mid-write leaves the original file intact (atomic mv below).
RESULTS_ORIG=""
[ -f "$RESULTS" ] && RESULTS_ORIG="$(cat "$RESULTS")"

hdr() { grep -E "^# $1:" "$2" 2>/dev/null | head -1 | sed "s/^# $1:[[:space:]]*//" || true; }
prior_row() { grep -E "^\| ${1} \|" <<<"$RESULTS_ORIG" 2>/dev/null | head -1 || true; }
prior_status() { prior_row "$1" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$5); print $5}'; }

now="$(date -u +'%Y-%m-%d %H:%M')"
declare -A NEWROW
regressions=()
ran=0

shopt -s nullglob
for probe in "$PROBES_DIR"/*.sh; do
  id="$(basename "$probe" .sh)"
  tier="$(hdr tier "$probe")";  tier="${tier:-?}"
  src="$(hdr source "$probe")"; src="${src:-?}"
  [ -n "$FILTER_PROBE" ] && [ "$id" != "$FILTER_PROBE" ] && continue

  set +e
  reason="$(timeout "$TIMEOUT_SECS" bash "$probe" 2>&1 1>/dev/null)"
  code=$?
  set -e
  case "$code" in
    0)   status="PASS" ;;
    1)   status="REGRESSION" ;;
    2)   status="SKIPPED" ;;
    124) status="TIMEOUT" ;;
    *)   status="ERROR" ;;
  esac
  reason="${reason%%$'\n'*}"   # first stderr line only

  prior="$(prior_status "$id")"
  if [ -z "$prior" ]; then
    if [ "$status" = "PASS" ]; then delta="new-pass"; else delta="new-fail"; fi
  elif [ "$prior" = "$status" ]; then
    delta="unchanged"
  else
    delta="${prior}->${status}"
  fi
  # green->red is the regression signal; first run has no prior, so never fires
  if [ "$prior" = "PASS" ] && [ "$status" != "PASS" ] && [ "$status" != "SKIPPED" ]; then
    regressions+=("$id ($src): was PASS, now $status — ${reason:-no reason}")
  fi

  NEWROW[$id]="| $id | $tier | $now | $status | $src |"
  printf '%-40s %-11s %s\n' "$id" "$status" "$delta" >&2
  ran=$((ran + 1))
done

# --- rewrite RESULTS.md: build the full scoreboard into a temp sibling file, then
#     replace the live file in ONE atomic mv -f. New rows for probes run this
#     invocation; carry prior rows (from RESULTS_ORIG snapshot) for the rest.
#     The temp path is a SIBLING of $RESULTS (same filesystem) so mv -f is atomic. ---
tmp="$RESULTS.tmp.$$"
cat > "$tmp" <<'HDR'
# Probe results — benchmark scoreboard

Current status per probe id, written by `bash evals/run.sh`. Policy: **overwrite the
row per probe id; git history is the time series.** Schema and exit-code semantics are
in [`evals/README.md`](README.md). `SKIPPED` does not count toward pass-rate.

| probe | tier | last-run (UTC) | status | source |
|-------|------|----------------|--------|--------|
HDR
for probe in "$PROBES_DIR"/*.sh; do
  id="$(basename "$probe" .sh)"
  if [ -n "${NEWROW[$id]+x}" ]; then
    printf '%s\n' "${NEWROW[$id]}" >> "$tmp"
  else
    pr="$(prior_row "$id")"
    if [ -n "$pr" ]; then
      printf '%s\n' "$pr" >> "$tmp"
    else
      printf '| %s | %s | — | (not run) | %s |\n' "$id" "$(hdr tier "$probe")" "$(hdr source "$probe")" >> "$tmp"
    fi
  fi
done
printf '\n<!-- benchmark: pass-rate = PASS / (PASS + REGRESSION + TIMEOUT); SKIPPED excluded -->\n' >> "$tmp"
mv -f "$tmp" "$RESULTS"
tmp=""

# --- summary to stdout: regressions first ---
if [ "${#regressions[@]}" -gt 0 ]; then
  echo "REGRESSIONS (${#regressions[@]}):"
  for r in "${regressions[@]}"; do echo "  - $r"; done
fi
echo "ran $ran probe(s); wrote $RESULTS"
if [ "${#regressions[@]}" -gt 0 ]; then exit 1; fi
exit 0
