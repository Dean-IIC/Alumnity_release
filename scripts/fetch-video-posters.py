"""Give the gallery's videos a still for their tiles.

    python scripts/fetch-video-posters.py [<posters-dir>]

Reads lib/gallery-videos.json and saves a still for each video's tile, 640 px wide, as
public/assets/gallery/<album>/video-<id>.jpg, so the page shows it without asking
YouTube or Meta for anything until someone presses play:
  - a "poster" the media team supplied (a file in <posters-dir>), if the video has one;
  - for YouTube, the video's own thumbnail (cropped to 16:9);
  - for Instagram, Facebook and LinkedIn, the post's link-preview image (the picture
    WhatsApp shows when the link is shared), which those sites give to preview fetchers.
A video with none of these keeps a paper tile with its name. Writes
lib/gallery-video-posters.json.
"""

import html
import json
import re
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "gallery"
WIDTH = 640
# Meta and LinkedIn only include a post's preview image for link-preview fetchers.
PREVIEW_AGENT = "Mozilla/5.0 (compatible; AlumnityLinkPreview/1.0; facebookexternalhit/1.1; +https://www.hkbk.edu.in)"


def youtube_id(url):
    m = re.search(r"(?:youtu\.be/|[?&]v=|/(?:shorts|live|embed)/)([\w-]{11})", url)
    return m.group(1) if m else None


def fetch_youtube(video_id):
    # The largest thumbnail YouTube always has (maxres exists only for HD uploads).
    for name in ("maxresdefault", "sddefault", "hqdefault"):
        try:
            with urllib.request.urlopen(f"https://i.ytimg.com/vi/{video_id}/{name}.jpg", timeout=20) as r:
                img = cv2.imdecode(np.frombuffer(r.read(), np.uint8), cv2.IMREAD_COLOR)
            if img is not None and img.shape[1] > 200:
                return img
        except OSError:
            continue
    return None


def get(url, agent=PREVIEW_AGENT):
    req = urllib.request.Request(url, headers={"User-Agent": agent})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()


def fetch_preview(url):
    """The og:image of a public post: Instagram, Facebook and LinkedIn all set one."""
    try:
        page = get(url).decode("utf8", "ignore")
    except OSError:
        return None
    m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', page) or re.search(
        r'<meta[^>]+content="([^"]+)"[^>]+property="og:image"', page
    )
    if not m:
        return None
    try:
        return cv2.imdecode(np.frombuffer(get(html.unescape(m.group(1))), np.uint8), cv2.IMREAD_COLOR)
    except OSError:
        return None


def post_id(url):
    """A short, file-safe name for a post: its code or number from the link."""
    m = re.search(r"/(?:p|reels?|tv)/([\w-]+)|(?:videos|reel)/(?:[\w.-]+/)?(\d+)|[?&]v=(\d+)|(?:activity|ugcPost|share)[-:](\d+)", url)
    return next((g for g in m.groups() if g), None) if m else re.sub(r"\W+", "-", url)[-24:]


def crop_wide(img):
    """To 16:9: YouTube's smaller thumbnails are 4:3 with black bars above and below."""
    h, w = img.shape[:2]
    target = round(w * 9 / 16)
    top = max(0, (h - target) // 2)
    return img[top : top + target]


def main() -> None:
    posters_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    videos = json.loads((ROOT / "lib" / "gallery-videos.json").read_text(encoding="utf8"))["videos"]
    out = {}
    for v in videos:
        img, name = None, None
        if v.get("poster"):
            if not posters_dir:
                raise SystemExit(f"{v['url']} has a poster; give the folder it's in")
            img = cv2.imread(str(posters_dir / v["poster"]))
            name = "video-" + Path(v["poster"]).stem
        elif vid := youtube_id(v["url"]):
            img = fetch_youtube(vid)
            img = crop_wide(img) if img is not None else None
            name = f"video-{vid}"
        else:
            img = fetch_preview(v["url"])
            name = f"video-{post_id(v['url'])}"
        if img is None:
            print("no still:", v["url"])
            continue
        h, w = img.shape[:2]
        img = cv2.resize(img, (WIDTH, round(h * WIDTH / w)), interpolation=cv2.INTER_AREA)
        folder = OUT / v["album"]
        folder.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(folder / f"{name}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 80])
        out[v["url"]] = {"src": f"/assets/gallery/{v['album']}/{name}.jpg", "width": img.shape[1], "height": img.shape[0]}
        print("still:", v["url"], "->", out[v["url"]]["src"])
    (ROOT / "lib" / "gallery-video-posters.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
