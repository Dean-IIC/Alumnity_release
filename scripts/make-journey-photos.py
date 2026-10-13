"""Build the intro's photo pairs: a pencil-sketch version and a colour version of
each real campus photograph, cropped identically so the ink reveal lines up.

    python scripts/make-journey-photos.py <photo-dir> [name=file ...]

<photo-dir> is the folder of original photographs. With no name=file pairs it
builds the campus set below (from the archive that used to live in
prototype/assets/photos); otherwise it builds just the named pairs, e.g.
    era-2008-alumni-meet=2008-alumni-meet.jpg
Output goes to public/assets/campus/journey/<name>.jpg and <name>-sketch.jpg.
"""

import sys
from pathlib import Path

import cv2
import numpy as np

# block id -> source photograph. Order is the physical route, A/CSE -> D.
SOURCES = {
    "a-cse": "hero-main-entrance-morning.jpg",
    "admin": "glass-sunset.jpg",
    "b": "corner.jpg",
    "c": "hero-blue-block-golden.jpg",
    "d": "facade.jpg",
}

MAX_EDGE = 1400
PAPER = np.array([231, 241, 247], np.float32)  # BGR of #f7f1e7
GRAPHITE = np.array([44, 50, 58], np.float32)  # BGR of #3a322c


def fit(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    scale = min(1.0, MAX_EDGE / max(h, w))
    return cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)


def pencil(img: np.ndarray, seed: int) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gray = cv2.bilateralFilter(gray, 7, 30, 7)

    # Colour-dodge sketch: soft graphite tones.
    blur = cv2.GaussianBlur(255 - gray, (0, 0), 9)
    dodge = np.clip(gray * 255.0 / np.maximum(255 - blur, 1), 0, 255)

    # Firmer contour lines on top, so it reads as drawn rather than faded.
    small = cv2.GaussianBlur(gray, (0, 0), 1.2)
    edges = cv2.Laplacian(small, cv2.CV_32F, ksize=3)
    edges = np.clip(np.abs(edges) * 2.2, 0, 255)
    lines = 255 - edges

    tone = dodge * (lines / 255.0)
    tone = np.clip((tone - 40) * 1.18, 0, 255)

    # Light diagonal hatching in the shadows only.
    h, w = gray.shape
    yy, xx = np.mgrid[0:h, 0:w]
    hatch = (np.sin((xx + yy) * 0.9) > 0.55).astype(np.float32)
    shadow = np.clip((150 - gray) / 150, 0, 1)
    tone = tone * (1 - 0.22 * hatch * shadow)

    # Paper grain.
    rng = np.random.default_rng(seed)
    grain = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 0.8)
    tone = np.clip(tone + grain * 7, 0, 255)

    t = (tone / 255.0)[..., None]
    out = GRAPHITE * (1 - t) + PAPER * t
    return out.astype(np.uint8)


def main() -> None:
    src_dir = Path(sys.argv[1])
    pairs = dict(arg.split("=", 1) for arg in sys.argv[2:]) or SOURCES
    out_dir = Path(__file__).resolve().parent.parent / "public" / "assets" / "campus" / "journey"
    out_dir.mkdir(parents=True, exist_ok=True)

    for seed, (block, name) in enumerate(pairs.items()):
        img = cv2.imread(str(src_dir / name))
        if img is None:
            raise SystemExit(f"missing {src_dir / name}")
        img = fit(img)
        cv2.imwrite(str(out_dir / f"{block}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 82])
        cv2.imwrite(str(out_dir / f"{block}-sketch.jpg"), pencil(img, seed), [cv2.IMWRITE_JPEG_QUALITY, 80])
        print(block, img.shape[1], "x", img.shape[0])


if __name__ == "__main__":
    main()
