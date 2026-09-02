#!/usr/bin/env python3
"""make-banner.py — generate docs/banner.svg (and optionally docs/banner.png) from cast.db.

Why this exists: a README banner that is decoration (a stock chart PNG, a logo) drifts from
the project the moment the project changes. This one doesn't get a chance to drift — it is
regenerated straight from the same cast.db every dashboard route reads, using the dashboard's
own CSS palette, so the banner IS the record rather than an illustration of it.

Read-only: this script never writes to cast.db. It connects with `mode=ro` so a bug here can't
corrupt the observability database the rest of the dashboard depends on.

Usage:
    python3 scripts/make-banner.py           # writes docs/banner.svg
    python3 scripts/make-banner.py --png      # also writes docs/banner.png (macOS only)
"""

from __future__ import annotations

import argparse
import datetime
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Tuple

# Palette lifted verbatim from src/index.css so the banner can never drift from the UI.
BG = "#070A0F"
TEXT = "#E6E8EE"
MUTED = "#8493b4"
ACCENT = "#00FFC2"
FONT_STACK = "'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"

DB_PATH = Path(os.environ.get("CAST_DB_PATH", os.path.expanduser("~/.claude/cast.db")))
AGENTS_DIR = Path(os.path.expanduser("~/.claude/agents"))

REPO_ROOT = Path(__file__).resolve().parent.parent
SVG_OUT = REPO_ROOT / "docs" / "banner.svg"
PNG_OUT = REPO_ROOT / "docs" / "banner.png"

WIDTH, HEIGHT = 1200, 340
DAYS = 30


def load_stats() -> Dict[str, object]:
    """Pull the last-30-day picture straight from cast.db, read-only."""
    if not DB_PATH.exists():
        print(f"error: cast.db not found at {DB_PATH} — run `cast status` to initialize it.", file=sys.stderr)
        sys.exit(1)

    # A "last 30 days" window means today plus the 29 days before it (30 calendar days total,
    # inclusive of today) — so the SQL bound is -(DAYS - 1) days, not -DAYS. Using -DAYS here
    # pulled in a 31st day that only showed up in the totals/peak, not in the 30-bar chart below,
    # so the stats line and the chart silently disagreed with each other.
    window_start = f"-{DAYS - 1}"

    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT substr(started_at, 1, 10) AS day, COUNT(*) AS n
            FROM agent_runs
            WHERE started_at >= date('now', ? || ' days')
            GROUP BY day
            ORDER BY day
            """,
            (window_start,),
        )
        daily_rows: List[Tuple[str, int]] = cur.fetchall()
        daily_counts = {day: n for day, n in daily_rows}

        cur.execute(
            "SELECT COUNT(*) FROM agent_runs WHERE started_at >= date('now', ? || ' days')",
            (window_start,),
        )
        total_runs = cur.fetchone()[0]

        cur.execute(
            "SELECT COUNT(*) FROM sessions WHERE started_at >= date('now', ? || ' days')",
            (window_start,),
        )
        total_sessions = cur.fetchone()[0]
    finally:
        conn.close()

    # Agent count MUST come from disk, not `COUNT(DISTINCT agent)` — agent_runs.agent stores the
    # full dispatch name (e.g. "backend-writer__u5-c1"), so a DISTINCT count over dispatch labels
    # reports ~970 "agents" for a roster of 27. The roster lives on disk as one .md per agent.
    agent_count = len(list(AGENTS_DIR.glob("*.md"))) if AGENTS_DIR.is_dir() else 0

    # Build the ordered last-DAYS-days series once, here, so build_svg() and the stdout summary
    # both read the exact same numbers instead of recomputing (and risking disagreement).
    #
    # MUST be the UTC date, not the local date: daily_counts keys come from
    # substr(started_at, 1, 10) on agent_runs.started_at (UTC ISO-Z), and the SQL window above
    # uses SQLite's date('now', ...), which is also UTC. A local date() here would, for part of
    # each day (anywhere east/west of UTC), look up dates that don't line up with the UTC-keyed
    # data — the newest day's bar would silently disappear while a stale day got included instead.
    today = datetime.datetime.now(datetime.timezone.utc).date()
    series = [daily_counts.get((today - datetime.timedelta(days=o)).isoformat(), 0) for o in range(DAYS - 1, -1, -1)]
    peak = max(series) if series else 0

    return {
        "daily_counts": daily_counts,
        "series": series,
        "peak": peak,
        "total_runs": total_runs,
        "total_sessions": total_sessions,
        "agent_count": agent_count,
    }


def build_svg(stats: Dict[str, object], square: bool = False) -> str:
    """Render the banner SVG. `square` wraps the content for the qlmanage rasterization trick."""
    series: List[int] = stats["series"]  # type: ignore[assignment]
    peak: int = stats["peak"]  # type: ignore[assignment]
    total_runs = stats["total_runs"]
    total_sessions = stats["total_sessions"]
    agent_count = stats["agent_count"]

    canvas_w, canvas_h = (1200, 1200) if square else (WIDTH, HEIGHT)

    # Chart geometry (in banner-local coordinates, before any square-wrap translate).
    chart_x, chart_w = 60, WIDTH - 120
    chart_bottom = 260
    chart_top = 150
    chart_h = chart_bottom - chart_top
    bar_gap = 3
    bar_w = (chart_w - bar_gap * (DAYS - 1)) / DAYS
    min_bar_h = 1.5

    bars = []
    for i, count in enumerate(series):
        x = chart_x + i * (bar_w + bar_gap)
        if count <= 0:
            continue
        h = max(min_bar_h, (count / peak) * chart_h) if peak > 0 else min_bar_h
        y = chart_bottom - h
        opacity = 0.25 + 0.75 * (count / peak) if peak > 0 else 1.0
        bars.append(
            f'<rect x="{x:.2f}" y="{y:.2f}" width="{bar_w:.2f}" height="{h:.2f}" '
            f'fill="{ACCENT}" opacity="{opacity:.2f}" />'
        )

    stats_left = f"{total_runs} agent runs · {total_sessions} sessions · {agent_count} specialist agents · last {DAYS} days"
    stats_right = f"peak {peak} runs/day"

    content = f"""
  <rect x="0" y="0" width="{WIDTH}" height="{HEIGHT}" fill="{BG}" />

  <text x="60" y="62" font-family="{FONT_STACK}" font-size="34" font-weight="600" fill="{TEXT}">claude-code-dashboard</text>
  <text x="60" y="92" font-family="{FONT_STACK}" font-size="16" fill="{ACCENT}">Observability for the CAST local-first agent OS</text>
  <text x="60" y="118" font-family="{FONT_STACK}" font-size="13" fill="{MUTED}">Every dispatch, session, hook and dollar — read straight from ~/.claude, no telemetry.</text>

  <g>
    {''.join(bars)}
  </g>

  <line x1="60" y1="{chart_bottom}" x2="{WIDTH - 60}" y2="{chart_bottom}" stroke="{MUTED}" stroke-width="1" opacity="0.4" />

  <text x="60" y="300" font-family="{FONT_STACK}" font-size="12" fill="{MUTED}">{stats_left}</text>
  <text x="{WIDTH - 60}" y="300" font-family="{FONT_STACK}" font-size="12" fill="{MUTED}" text-anchor="end">{stats_right}</text>
""".strip("\n")

    if square:
        content = f'<g transform="translate(0,430)">\n{content}\n  </g>'

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{canvas_w}" height="{canvas_h}" viewBox="0 0 {canvas_w} {canvas_h}">
  <rect x="0" y="0" width="{canvas_w}" height="{canvas_h}" fill="{BG}" />
  {content}
</svg>
"""


def write_png(stats: Dict[str, object]) -> None:
    """Rasterize via macOS built-ins only: qlmanage (Quick Look) + sips, no new dependencies.

    qlmanage pads its thumbnail output to a square canvas and sips can only crop centred, so we
    render a square 1200x1200 SVG with the banner content translated to sit vertically centred,
    quick-look it to a 2400x2400 PNG, then sips-crop that down to the correct 2400x680 (2x) frame.
    """
    for tool in ("qlmanage", "sips"):
        if shutil.which(tool) is None:
            print(f"error: `{tool}` not found — PNG rasterization requires macOS built-ins.", file=sys.stderr)
            sys.exit(1)

    square_svg = build_svg(stats, square=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_svg = Path(tmpdir) / "banner-square.svg"
        tmp_svg.write_text(square_svg, encoding="utf-8")

        result = subprocess.run(
            ["qlmanage", "-t", "-s", "2400", "-o", tmpdir, str(tmp_svg)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"error: qlmanage failed:\n{result.stdout}\n{result.stderr}", file=sys.stderr)
            sys.exit(1)

        tmp_png = Path(tmpdir) / "banner-square.svg.png"
        if not tmp_png.exists():
            print(f"error: qlmanage did not produce the expected thumbnail at {tmp_png}", file=sys.stderr)
            sys.exit(1)

        PNG_OUT.parent.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            ["sips", "-c", "680", "2400", str(tmp_png), "--out", str(PNG_OUT)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"error: sips crop failed:\n{result.stdout}\n{result.stderr}", file=sys.stderr)
            sys.exit(1)

        if not PNG_OUT.exists():
            print(f"error: sips did not produce the expected output at {PNG_OUT}", file=sys.stderr)
            sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--png", action="store_true", help="Also write docs/banner.png (macOS only)")
    args = parser.parse_args()

    stats = load_stats()

    SVG_OUT.parent.mkdir(parents=True, exist_ok=True)
    SVG_OUT.write_text(build_svg(stats), encoding="utf-8")

    if args.png:
        write_png(stats)

    summary = (
        f"{stats['total_runs']} agent runs · {stats['total_sessions']} sessions · "
        f"{stats['agent_count']} specialist agents · peak {stats['peak']} runs/day (last {DAYS} days)"
    )
    print(summary)
    print(f"wrote {SVG_OUT}")
    if args.png:
        print(f"wrote {PNG_OUT}")


if __name__ == "__main__":
    main()
