#!/usr/bin/env python3
"""
build-ranges-slim.py
====================

Generate ranges-slim.json from the canonical biomarker library so the dashboard
can hydrate per-marker healthy ranges client-side without shipping the full
1.3 MB library.

The backend's process-report pipeline drops `reference: {low, high}` from
systems[].markers[] to keep the Call A output small enough to finish inside
the Edge Function wall-clock. The dashboard re-derives the range at render
time by joining on marker_id (preferred) or display_name / alias (fallback).

This script reads the library, parses each marker's
`ranges.default.biowellth_optimal` string (e.g. "60-100", "<90", ">=20")
into {low, high} numbers, and emits a flat lookup map. The output is stamped
with the library's schema_version so the dashboard can detect drift.

Run from the website repo root, every time the library version bumps. Source the
WORKER copy of the library (process-report-worker) — it is the AUTHORITATIVE one:
it carries engine #3, the derived indices, the Jun-2026 toxic-band rewrite, and the
2b-lib display_name spell-outs. The process-report copy is STALE (drifted ~53 markers,
e.g. quicki absent) and must NOT be used as the source. See the 2b drift investigation.

  python3 scripts/build-ranges-slim.py \
    ../biowellth-backend-supa/supabase/functions/process-report-worker/biomarker-library-v2.1.1.json \
    ranges-slim.json

Then commit both the script and ranges-slim.json. The CI deploy ships the
JSON file to GitHub Pages as a sibling of dashboard.html.
"""
import json
import re
import sys
from pathlib import Path

NUM = r'(-?\d+(?:\.\d+)?)'


def parse_range(s):
    """Parse a biowellth_optimal range string into {low, high} or None.

    Recognised forms:
      "60-100" / "60.5 - 100.3" / "60–100"  -> {'low': 60, 'high': 100}
      "<90" / "<=90"                         -> {'low': None, 'high': 90}
      ">20" / ">=20"                         -> {'low': 20, 'high': None}

    Anything else (free text like "interpret with thyroid status") returns
    None and is reported as skipped.
    """
    if not isinstance(s, str):
        return None
    s = s.strip()
    if not s:
        return None

    m = re.fullmatch(rf'{NUM}\s*[-–]\s*{NUM}', s)
    if m:
        return {'low': float(m.group(1)), 'high': float(m.group(2))}

    # ASCII <, <= and Unicode ≤. Library uses ≤ frequently (e.g. "≤10").
    m = re.fullmatch(rf'[<≤]=?\s*{NUM}', s)
    if m:
        return {'low': None, 'high': float(m.group(1))}

    # ASCII >, >= and Unicode ≥. Library uses ≥ frequently (e.g. "≥1.0").
    m = re.fullmatch(rf'[>≥]=?\s*{NUM}', s)
    if m:
        return {'low': float(m.group(1)), 'high': None}

    return None


def main(library_path, out_path):
    lib = json.loads(Path(library_path).read_text())
    schema_version = (lib.get('meta') or {}).get('schema_version', 'unknown')
    markers = lib.get('markers', [])

    by_id = {}
    by_dn = {}
    by_alias = {}
    themes_by_id = {}
    skipped = []

    for m in markers:
        mid = m.get('marker_id')
        dn = m.get('display_name')
        aliases = m.get('aliases', []) or []
        # Themes are a SEPARATE map keyed by marker_id, built over EVERY library marker
        # regardless of whether its range parses. The range maps (by_marker_id etc.) drop
        # ~37 markers whose biowellth_optimal is non-numeric (cycle-phase hormones, qualitatives),
        # and 16 of those are themed — so a themes-on-by_marker_id design would silently undercount
        # cycle_hormones by 28%. Keying themes off the marker list, not the parsed range, keeps the
        # theme grid's counts complete. Only non-empty arrays are emitted; an absent marker_id means
        # "no theme" (same as an excluded marker's empty array), which the consumer treats as zero.
        themes = m.get('themes') or []
        if mid and themes:
            themes_by_id[mid] = themes

        rng_str = (((m.get('ranges') or {}).get('default') or {})
                   .get('biowellth_optimal'))
        rng = parse_range(rng_str)
        if rng is None:
            skipped.append({'marker_id': mid,
                            'display_name': dn,
                            'biowellth_optimal': rng_str})
            continue
        # The three range maps share one rng object (Step 0b) — do NOT attach per-map fields here.
        if mid:
            by_id[mid] = rng
        if dn:
            by_dn[dn.lower().strip()] = rng
        for a in aliases:
            if isinstance(a, str) and a.strip():
                by_alias[a.lower().strip()] = rng

    out = {
        'schema_version': schema_version,
        'generated_by': 'scripts/build-ranges-slim.py',
        'by_marker_id': by_id,
        'by_display_name_lc': by_dn,
        'by_alias_lc': by_alias,
        'themes_by_marker_id': themes_by_id,
    }
    Path(out_path).write_text(json.dumps(out, separators=(',', ':')))

    print(f'wrote {out_path}')
    print(f'  library schema_version: {schema_version}')
    print(f'  markers in library    : {len(markers)}')
    print(f'  by_marker_id entries  : {len(by_id)}')
    print(f'  by_display_name_lc    : {len(by_dn)}')
    print(f'  by_alias_lc           : {len(by_alias)}')
    print(f'  themes_by_marker_id   : {len(themes_by_id)}')
    print(f'  skipped (unparseable) : {len(skipped)}')
    if skipped[:5]:
        print('  first 5 skipped:')
        for s in skipped[:5]:
            print(f'    {s}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('usage: build-ranges-slim.py <library.json> <output.json>')
    main(sys.argv[1], sys.argv[2])
