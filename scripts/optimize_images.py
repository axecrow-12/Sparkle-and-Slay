#!/usr/bin/env python3
"""
Optimise oversized raster images for the Sparkle & Slay storefront.

Screaming Frog flagged several images in photos/ over 100 KB (up to 2.1 MB).
This downscales anything wider than --max-width and re-encodes it, keeping a
one-time copy of the original in photos/_originals/.

    python scripts/optimize_images.py                 # dry run, shows the table
    python scripts/optimize_images.py --apply         # actually rewrite files
    python scripts/optimize_images.py --apply --webp   # also emit .webp siblings

Needs Pillow (already in the project .venv):  pip install Pillow
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is not installed. Run:  pip install Pillow")

REPO = Path(__file__).resolve().parent.parent
DEFAULT_DIRS = ["photos", "server-php/public/uploads"]
EXTS = {".jpg", ".jpeg", ".png"}


def human(n: float) -> str:
    if n < 1024:
        return f"{n:.0f} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.0f} KB"
    return f"{n / (1024 * 1024):.2f} MB"


def process(path: Path, args, backup_root: Path) -> tuple[int, int] | None:
    before = path.stat().st_size
    try:
        img = Image.open(path)
        img.load()
    except Exception as exc:  # noqa: BLE001
        print(f"  skip {path.name}: {exc}")
        return None

    too_big = before > args.max_bytes
    too_wide = img.width > args.max_width
    if not (too_big or too_wide):
        return None

    resized = img
    if too_wide:
        ratio = args.max_width / img.width
        resized = img.resize((args.max_width, round(img.height * ratio)), Image.LANCZOS)

    import io

    is_jpeg = path.suffix.lower() in {".jpg", ".jpeg"}
    # Big PNGs here are photos — JPEG shrinks them far more than PNG optimisation
    # can. --png-to-jpeg flattens any transparency onto white; review the output.
    to_jpeg = args.png_to_jpeg and not is_jpeg

    fmt = "JPEG" if is_jpeg or to_jpeg else "PNG"
    save_kwargs: dict = {"optimize": True}
    out = resized
    if fmt == "JPEG":
        save_kwargs.update(quality=args.quality, progressive=True)
        if out.mode in ("RGBA", "LA", "P"):
            rgba = out.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[-1])
            out = bg
        elif out.mode != "RGB":
            out = out.convert("RGB")

    buf = io.BytesIO()
    out.save(buf, format=fmt, **save_kwargs)
    after = buf.tell()

    # Never make a file bigger.
    if after >= before and not to_jpeg:
        return None

    out_path = path.with_suffix(".jpg") if to_jpeg else path
    if args.apply:
        backup = backup_root / path.name
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_bytes(path.read_bytes())
        out_path.write_bytes(buf.getvalue())
        if to_jpeg and out_path != path:
            path.unlink()
            print(f"  note: {path.name} -> {out_path.name}; update references in HTML/CSS/JS")
        if args.webp:
            out.save(path.with_suffix(".webp"), format="WEBP", quality=args.quality, method=6)

    return before, after


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--webp", action="store_true", help="also write a .webp sibling")
    ap.add_argument(
        "--png-to-jpeg",
        action="store_true",
        help="convert large opaque PNGs to JPEG (renames the file; you must update references)",
    )
    ap.add_argument("--max-width", type=int, default=1400)
    ap.add_argument("--max-bytes", type=int, default=100 * 1024)
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--dirs", nargs="*", default=DEFAULT_DIRS)
    args = ap.parse_args()

    backup_root = REPO / "photos" / "_originals"
    total_before = total_after = 0
    rows: list[tuple[str, int, int]] = []

    for d in args.dirs:
        base = REPO / d
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if path.suffix.lower() not in EXTS or "_originals" in path.parts:
                continue
            result = process(path, args, backup_root)
            if result:
                before, after = result
                rows.append((str(path.relative_to(REPO)), before, after))
                total_before += before
                total_after += after

    if not rows:
        print("Nothing over the threshold. Everything is already optimised.")
        return

    width = max(len(r[0]) for r in rows)
    print(f"{'file':<{width}}  {'before':>10}  {'after':>10}  saved")
    for name, before, after in rows:
        print(f"{name:<{width}}  {human(before):>10}  {human(after):>10}  {human(before - after)}")
    print(f"{'TOTAL':<{width}}  {human(total_before):>10}  {human(total_after):>10}  {human(total_before - total_after)}")
    if not args.apply:
        print("\nDry run — re-run with --apply to write. Originals go to photos/_originals/.")


if __name__ == "__main__":
    main()
