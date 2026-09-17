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


ENGINE_FILENAME = 'vitality-engine.js'


def parse_tier0_labels(engine_path):
    """Read BAND_TIERS[0].labels out of the engine source.

    THE ENGINE IS THE AUTHORITY ON WHAT "IN RANGE" MEANS, and this function exists so the
    dashboard never holds a second copy of that fact. The band a marker carries is assigned by
    vitality-engine.js; the dashboard's consistency rule decides whether a drawn track agrees
    with that band. Two hand-maintained lists of the same six words drift the first time a
    seventh is added to a tier -- which is exactly how the shipped regex came to read
    suboptimal_high as optimal.

    SIBLING OF THE LIBRARY, NOT A SEPARATE ARGUMENT. The engine lives beside the library inside
    process-report-worker/, so deriving the path couples the tier table to the very library whose
    band vocabulary it classifies. A second CLI argument would let someone build ranges from one
    worker's library and tier-0 from another's, and nothing would report it.

    Parsed, never retyped. Raises rather than returning a short list: a silently short family is
    the defect this whole change exists to prevent -- a missing word reads as "not optimal",
    which suppresses a legitimate track and looks exactly like a clean render.
    """
    src = Path(engine_path).read_text()
    m = re.search(r'const\s+BAND_TIERS\s*=\s*\[', src)
    if not m:
        raise SystemExit(f'BAND_TIERS not found in {engine_path}')
    # First element of the array is tier 0; take it by brace matching rather than by a greedy
    # regex, which would run to the last "}" in the file.
    i = src.index('{', m.end())
    depth = 0
    for j in range(i, len(src)):
        if src[j] == '{':
            depth += 1
        elif src[j] == '}':
            depth -= 1
            if depth == 0:
                tier0 = src[i:j + 1]
                break
    else:
        raise SystemExit(f'BAND_TIERS[0] never closes in {engine_path}')
    lm = re.search(r'labels\s*:\s*\[([^\]]*)\]', tier0)
    if not lm:
        raise SystemExit(f'BAND_TIERS[0].labels not found in {engine_path}')
    labels = re.findall(r'"([^"]+)"|\'([^\']+)\'', lm.group(1))
    labels = [a or b for a, b in labels]
    if len(labels) != EXPECTED_TIER0_COUNT:
        raise SystemExit(
            f'BAND_TIERS[0].labels parsed to {len(labels)} labels, expected '
            f'{EXPECTED_TIER0_COUNT}: {labels!r}. Refusing to emit a short optimal family.')
    if len(set(labels)) != len(labels):
        raise SystemExit(f'BAND_TIERS[0].labels contains duplicates: {labels!r}')
    return labels


# The count is pinned rather than left open because "however many I found" cannot detect the
# failure that matters. If the engine legitimately gains a seventh tier-0 band, this number moves
# in the same commit as the regenerated JSON, deliberately, and the dashboard's assertions see it.
EXPECTED_TIER0_COUNT = 6


def main(library_path, out_path):
    lib = json.loads(Path(library_path).read_text())
    engine_path = Path(library_path).parent / ENGINE_FILENAME
    band_family_optimal = parse_tier0_labels(engine_path)
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

        # MARKER_BAND_V2 — carry the CONVENTIONAL interval alongside the functional one, because
        # the band's axis is derived from it and an axis derived from her value cannot separate
        # two women whose results differ. Measured on one real panel before this line was written:
        # the value-derived axis put 11 of 16 drawn markers on the same 4.00% floor and produced 5
        # distinct dot positions in total; the conventional-derived axis produces 16 distinct
        # positions for the same 16 markers.
        #
        # SAME parse_range, no second parser. conventional_india is the same kind of string as
        # biowellth_optimal ("70-100", "<5.7", ">=40") and returns the identical {low, high}
        # shape, so a second parser would be two things to keep in step for no gain.
        #
        # EMITTED ONLY WHEN TWO-ENDED. A one-ended conventional interval cannot bound an axis, and
        # writing a null would make the consumer test for two different absences. Absent means
        # absent: the dashboard falls back to no track, which is what it already does for a marker
        # with no functional range.
        #
        # Attached to the SHARED rng object deliberately. The note below forbids PER-MAP fields,
        # because the three maps hold the same object and a field set on one would appear on all
        # three and mislead. A per-MARKER field is the opposite case: it belongs to the marker, so
        # every map that resolves to that marker should carry it. The cost is that the pair is
        # serialised once per map entry rather than once, which the byte count in the commit
        # message accounts for.
        conv = parse_range((((m.get('ranges') or {}).get('default') or {})
                            .get('conventional_india')))
        if conv and conv['low'] is not None and conv['high'] is not None:
            rng = dict(rng)
            rng['conv_low'] = conv['low']
            rng['conv_high'] = conv['high']
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
        'band_family_optimal': band_family_optimal,
    }
    Path(out_path).write_text(json.dumps(out, separators=(',', ':')))

    print(f'wrote {out_path}')
    print(f'  library schema_version: {schema_version}')
    print(f'  markers in library    : {len(markers)}')
    print(f'  by_marker_id entries  : {len(by_id)}')
    print(f'  by_display_name_lc    : {len(by_dn)}')
    print(f'  by_alias_lc           : {len(by_alias)}')
    print(f'  themes_by_marker_id   : {len(themes_by_id)}')
    print(f'  band_family_optimal   : {band_family_optimal}')
    print(f'  engine source         : {engine_path}')
    conv_n = sum(1 for v in by_id.values() if 'conv_low' in v)
    print(f'  with conv bounds      : {conv_n}')
    print(f'  without conv bounds   : {len(by_id) - conv_n}')
    print(f'  skipped (unparseable) : {len(skipped)}')
    if skipped[:5]:
        print('  first 5 skipped:')
        for s in skipped[:5]:
            print(f'    {s}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('usage: build-ranges-slim.py <library.json> <output.json>')
    main(sys.argv[1], sys.argv[2])
