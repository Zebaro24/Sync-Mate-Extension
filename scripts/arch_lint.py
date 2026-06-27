#!/usr/bin/env python3
"""arch_lint_ext - architecture guard for the WXT/React extension (Sync-Mate-Extension).

Enforces the layering & invariants documented in Sync-Mate-Extension/CLAUDE.md and
.claude/docs/architecture.md. Pure stdlib, regex based, low false-positive (comments are
stripped first via a string-aware scanner so `//` inside URLs and `@keyframes` mentions in
comments don't trip the checks).

Rules:
  1. Import direction. Lower/shared layers must not depend on higher ones:
       src/shared/**   must not import  @/features  or  @/entrypoints
       src/locators/** must not import  @/entrypoints
       src/features/** must not import  @/entrypoints
  2. Two-enum separation (do NOT confuse the WS protocol with internal IPC):
       `enum WSMessageTypes`     defined ONLY in features/room/model/messageTypes.ts
       `enum BrowserMessageTypes` defined ONLY in shared/constants/message-types.ts
  3. Page-injected CSS isolation. Every literal `@keyframes <name>` must use the
     `sync-mate-` prefix — short names get clobbered by Rezka. (Interpolated names like
     `@keyframes ${NAME}` are skipped — they can't be checked statically.)
  4. YouTube stays out of the content script `matches` until YouTubeLocators exist,
     otherwise the content script silently fails.

Run:  python scripts/arch_lint_ext.py [--root <repo dir>]
Exit 0 = clean, 1 = violations. Defaults to cwd (the gate runs it with cwd = repo dir).
"""
import argparse
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CODE_EXT = (".ts", ".tsx", ".mts", ".cts", ".js", ".jsx")


def code_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in {"node_modules", ".output", ".wxt", ".idea"}]
        for fn in filenames:
            if fn.endswith(CODE_EXT):
                yield os.path.join(dirpath, fn)


def rel(path, root):
    return os.path.relpath(path, root).replace("\\", "/")


def strip_comments(src):
    """Remove // and /* */ comments while respecting ' " ` string literals (so `https://`
    and `// ...` inside strings survive). Newlines are kept so multi-line structure stays."""
    out = []
    i, n = 0, len(src)
    quote = None  # current string delimiter: ' " or `
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if quote:
            out.append(c)
            if c == "\\" and i + 1 < n:  # escaped char inside a string
                out.append(nxt)
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in ("'", '"', "`"):
            quote = c
            out.append(c)
            i += 1
            continue
        if c == "/" and nxt == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        if c == "/" and nxt == "*":
            i += 2
            while i < n and not (src[i] == "*" and i + 1 < n and src[i + 1] == "/"):
                if src[i] == "\n":
                    out.append("\n")
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def read_code(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return strip_comments(fh.read())
    except OSError:
        return ""


IMPORT_FROM_RE = re.compile(r"""(?:import|export)\b[^;\n]*?\bfrom\s+["']([^"']+)["']""")


def check_import_direction(src, root, violations):
    for path in code_files(src):
        r = rel(path, root)  # e.g. src/shared/foo.ts
        imps = set(IMPORT_FROM_RE.findall(read_code(path)))
        in_shared = "/shared/" in "/" + r
        in_locators = "/locators/" in "/" + r
        in_features = "/features/" in "/" + r
        for imp in imps:
            if in_shared and imp.startswith("@/features"):
                violations.append(f"{r}: shared/ must not import `{imp}` (@/features) — shared is the lower layer")
            if (in_shared or in_locators or in_features) and imp.startswith("@/entrypoints"):
                violations.append(f"{r}: must not import `{imp}` (@/entrypoints) — entrypoints are the top layer")


def check_enum_locations(src, root, violations):
    expected = {
        "WSMessageTypes": "src/features/room/model/messageTypes.ts",
        "BrowserMessageTypes": "src/shared/constants/message-types.ts",
    }
    for path in code_files(src):
        text = read_code(path)
        for name, exp in expected.items():
            if re.search(rf"\benum\s+{name}\b", text):
                loc = rel(path, root)
                if loc != exp:
                    violations.append(f"{loc}: `enum {name}` must be defined ONLY in {exp} (found a second definition)")


def check_keyframes_prefix(src, root, violations):
    kf = re.compile(r"@keyframes\s+([A-Za-z_][\w-]*)")
    for path in code_files(src):
        for name in kf.findall(read_code(path)):
            if not name.startswith("sync-mate-"):
                violations.append(
                    f"{rel(path, root)}: @keyframes '{name}' must be prefixed `sync-mate-` "
                    f"(Rezka clobbers short animation names)"
                )


def check_no_youtube(src, root, violations):
    content = os.path.join(src, "entrypoints", "content.ts")
    if not os.path.isfile(content):
        return
    text = read_code(content)
    # a youtube URL inside a single quoted string literal (the matches/host area)
    if re.search(r"""["'][^"'\n]*youtube[^"'\n]*["']""", text, re.I):
        violations.append(
            "src/entrypoints/content.ts: a YouTube pattern is present in `matches` but "
            "YouTubeLocators are not implemented — the content script will silently fail. "
            "Add YouTubeLocators + pickLocators branch first (see CLAUDE.md)."
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.getcwd(), help="repo dir (default: cwd)")
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    src = os.path.join(root, "src")
    if not os.path.isdir(src):
        print(f"arch(ext): no src/ dir under {root} — nothing to check")
        return 0

    violations: list[str] = []
    check_import_direction(src, root, violations)
    check_enum_locations(src, root, violations)
    check_keyframes_prefix(src, root, violations)
    check_no_youtube(src, root, violations)

    if violations:
        print(f"arch(ext): {len(violations)} violation(s):")
        for v in violations:
            print(f"  ✗ {v}")
        return 1
    print("arch(ext): OK — import direction, enum separation, sync-mate- keyframes, no stray YouTube")
    return 0


if __name__ == "__main__":
    sys.exit(main())
