#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Foodmi Weekly Scrape
#
# Runs every Wednesday night so prices are ready Thursday morning.
# Schedule: Wednesday 22:00 ET (cron handles this)
#
# Order:
#   1. IGA + Maxi + Provigo in parallel (API-based, ~30 min each)
#   2. Metro catalog via Playwright (~2-4 hours with 4 parallel tabs)
#   3. Flyers: Super C + Metro flyer (~5 min each)
#
# Logs go to scraper/logs/scrape-YYYY-MM-DD.log
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRAPER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRAPER_DIR"

# Create logs directory
mkdir -p logs

DATE=$(date +%Y-%m-%d)
LOG="logs/scrape-${DATE}.log"

log() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"
}

# Use the correct Node version (nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

log "═══════════════════════════════════════════════"
log "  Foodmi Weekly Scrape — $DATE"
log "═══════════════════════════════════════════════"

# ── Phase 1: API-based stores in parallel ──
log ""
log "Phase 1: Scraping IGA + Maxi + Provigo (parallel)..."

npx tsx src/index.ts --store=iga    >> "$LOG" 2>&1 &
PID_IGA=$!

npx tsx src/index.ts --store=maxi   >> "$LOG" 2>&1 &
PID_MAXI=$!

npx tsx src/index.ts --store=provigo >> "$LOG" 2>&1 &
PID_PROVIGO=$!

# Wait for all API stores
FAIL=0
wait $PID_IGA    || { log "⚠ IGA scrape failed (exit $?)";    FAIL=1; }
wait $PID_MAXI   || { log "⚠ Maxi scrape failed (exit $?)";   FAIL=1; }
wait $PID_PROVIGO || { log "⚠ Provigo scrape failed (exit $?)"; FAIL=1; }

log "Phase 1 complete."

# ── Phase 2: Metro catalog (Playwright, slow) ──
log ""
log "Phase 2: Scraping Metro catalog (Playwright, ~2-4 hours)..."
npx tsx src/index.ts --store=metro >> "$LOG" 2>&1 || { log "⚠ Metro scrape failed (exit $?)"; FAIL=1; }
log "Phase 2 complete."

# ── Phase 3: Flyers ──
log ""
log "Phase 3: Scraping flyers (Super C + Metro)..."

npx tsx src/index.ts --store=superc      >> "$LOG" 2>&1 &
PID_SUPERC=$!

npx tsx src/index.ts --store=metro-flyer >> "$LOG" 2>&1 &
PID_METROFLYER=$!

wait $PID_SUPERC     || { log "⚠ Super C flyer failed (exit $?)";  FAIL=1; }
wait $PID_METROFLYER || { log "⚠ Metro flyer failed (exit $?)";    FAIL=1; }

log "Phase 3 complete."

# ── Summary ──
log ""
log "═══════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  log "  ✓ All scrapes completed successfully"
else
  log "  ⚠ Some scrapes had errors — check log: $LOG"
fi
log "═══════════════════════════════════════════════"

# Print DB summary
log ""
log "Running database audit..."
npx tsx src/query.ts >> "$LOG" 2>&1 || true

log ""
log "Done. Full log: $SCRAPER_DIR/$LOG"
