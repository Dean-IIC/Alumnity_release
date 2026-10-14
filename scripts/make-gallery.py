"""Build the gallery's photos from the college's own archives.

    python scripts/make-gallery.py <old-site-dir> <portal-dir> <alpha-1-gallery-dir> <college-site-dir>

<old-site-dir>: photos from hkbkeducation.org as kept by the Wayback Machine (2014),
named like "05-2008BE-Alumni-Meet-dsc01315.jpg" (the folder they came from is in the name).
<portal-dir>: the old alumni portal's gallery_photos folder.
<alpha-1-gallery-dir>: alpha 1's static/img/gallery (the portal's albums, one folder each).
<college-site-dir>: photos saved from the college's own news pages (hkbk.edu.in, News &
Events), one per event, named as listed below.

An album is one kind of event; when it happened more than once (the alumni meets, the job
drives), each time is a part of the album. For every photo it writes a display copy (at
most 1600 px) and a thumbnail (640 px wide) to public/assets/gallery/<album>/, numbered
through the album. Each album's cover is also written at 1000 px with a pencil-sketch
copy, for the ink bloom that opens the album's page. Everything is listed, with sizes, in
lib/gallery-photos.json.
"""

import importlib.util
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "gallery"
# Photos smaller than this were only ever thumbnails; blown up they'd look broken.
MIN_WIDTH = 600
COVER_EDGE = 1000  # what the ink renderer draws at most (components/ink-photo.ts)

# The pencil-sketch filter the intro and the hero use, so the bloom looks the same.
_spec = importlib.util.spec_from_file_location("journey_photos", Path(__file__).with_name("make-journey-photos.py"))
_journey = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_journey)


def old_site(folder):
    return ("old-site", folder)


def portal(*names):
    return ("portal", names)


def alpha1(folder):
    return ("alpha1", folder)


def college_site(*names):
    return ("college-site", names)


# album slug -> its parts (key, where the photos come from) and its cover (part, photo).
# Only HKBK College of Engineering's own events: the college website (hkbk.edu.in, news and
# events) shows alpha 1's Abhinandana '25 (school and PU toppers from Haveri), Mega Job
# Fair '25 and Mega Pool Campus Drive '25 (both HKBK Degree College) were not, so they're out.
ALBUMS = {
    "graduation-day-2025": {"parts": [("all", portal("t1759211086_zD7Zrrplip.jpg"))], "cover": (0, 0)},
    # The group dance was on Swagatha's stage (same tent and flower-lined front, uploaded with it).
    "swagatha-2025": {"parts": [("all", [alpha1("swagatha-25"), portal("t1759138979_0RbEM9Nlxf.jpg")])], "cover": (0, 0)},
    "onam-2025": {"parts": [("all", portal("t1759145246_xGwjHPqxkl.jpg"))], "cover": (0, 0)},
    "independence-day-2025": {"parts": [("all", alpha1("independence-day-79"))], "cover": (0, 4)},
    "cyber-security-conclave-2025": {"parts": [("all", alpha1("cyber-security-conclave"))], "cover": (0, 1)},
    "swachh-bharat-2024": {"parts": [("all", alpha1("swachh-bharat"))], "cover": (0, 0)},
    "job-drives": {
        "parts": [
            ("indian-air-force-2011", old_site("2011AirForce")),
            ("indian-army-2010", old_site("2010IndianArmy")),
        ],
        "cover": (1, 3),
    },
    "alumni-meets": {
        "parts": [("2009", old_site("2009BE-Alumni-Meet")), ("2008", old_site("2008BE-Alumni-Meet"))],
        "cover": (1, 4),
    },
    # Single photos of engineering events from the college's news pages, one part each.
    "around-campus-2024-25": {
        "parts": [
            ("yoga-day-2025", college_site("yoga-day-2025.webp")),
            ("cse-poster-competition-2024", college_site("cse-poster-competition-2024.webp")),
            ("ece-mock-interviews-2024", college_site("ece-mock-interviews-2024.jpg")),
            ("food-carnival-2024", college_site("food-carnival-2024.jpg")),
            ("vyom-2024", college_site("vyom-2024.jpg")),
        ],
        "cover": (0, 0),
    },
    "sports-day": {"parts": [("all", old_site("sports-day"))], "cover": (0, 2)},
    "uninor-cup": {"parts": [("all", old_site("uninor-cup"))], "cover": (0, 0)},
}


def trim(img, tolerance=12):
    """Crop away a plain white frame (some portal uploads were padded to a square)."""
    ink = (255 - img.min(axis=2)) > tolerance
    rows, cols = np.flatnonzero(ink.any(axis=1)), np.flatnonzero(ink.any(axis=0))
    return img[rows[0] : rows[-1] + 1, cols[0] : cols[-1] + 1]


def fit(img, longest):
    h, w = img.shape[:2]
    scale = min(1.0, longest / max(h, w))
    return cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)


def width_to(img, width):
    h, w = img.shape[:2]
    scale = min(1.0, width / w)
    return cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)


def sources(kind_and_where, dirs):
    if isinstance(kind_and_where, list):  # a part drawn from more than one place
        return [src for each in kind_and_where for src in sources(each, dirs)]
    kind, where = kind_and_where
    if kind == "old-site":
        return sorted(p for p in dirs["old-site"].glob("*.jpg") if f"-{where}-" in p.name)
    if kind == "portal":
        return [dirs["portal"] / name for name in where]
    if kind == "college-site":
        return [dirs["college-site"] / name for name in where]
    return sorted(p for p in (dirs["alpha1"] / where).glob("??.jpg"))  # skips alpha 1's own _t thumbnails


def main() -> None:
    dirs = {"old-site": Path(sys.argv[1]), "portal": Path(sys.argv[2]), "alpha1": Path(sys.argv[3]), "college-site": Path(sys.argv[4])}
    manifest = {}
    for slug, spec in ALBUMS.items():
        folder = OUT / slug
        folder.mkdir(parents=True, exist_ok=True)
        n = 0
        parts = []
        cover_img = None
        cover_n = 0
        for part_i, (key, where) in enumerate(spec["parts"]):
            photos = []
            kept = 0
            for src in sources(where, dirs):
                img = cv2.imread(str(src))
                if img is None:
                    raise SystemExit(f"missing {src}")
                img = trim(img)
                if img.shape[1] < MIN_WIDTH:
                    print(f"  skipped {src.name}: only {img.shape[1]} px wide")
                    continue
                n += 1
                if (part_i, kept) == spec["cover"]:
                    cover_img, cover_n = img, n
                kept += 1
                full = fit(img, 1600)
                thumb = width_to(img, 640)
                cv2.imwrite(str(folder / f"{n:02d}.jpg"), full, [cv2.IMWRITE_JPEG_QUALITY, 80])
                cv2.imwrite(str(folder / f"{n:02d}-thumb.jpg"), thumb, [cv2.IMWRITE_JPEG_QUALITY, 78])
                photos.append({"n": n, "w": full.shape[1], "h": full.shape[0], "tw": thumb.shape[1], "th": thumb.shape[0]})
            parts.append({"key": key, "photos": photos})
        if cover_img is None:
            raise SystemExit(f"{slug}: no cover at {spec['cover']}")
        cover = fit(cover_img, COVER_EDGE)
        cv2.imwrite(str(folder / "cover.jpg"), cover, [cv2.IMWRITE_JPEG_QUALITY, 82])
        cv2.imwrite(str(folder / "cover-sketch.jpg"), _journey.pencil(cover, cover_n), [cv2.IMWRITE_JPEG_QUALITY, 78])
        manifest[slug] = {"cover": cover_n, "coverWidth": cover.shape[1], "coverHeight": cover.shape[0], "parts": parts}
        print(slug, " + ".join(f"{p['key']} {len(p['photos'])}" for p in parts))
    (ROOT / "lib" / "gallery-photos.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
