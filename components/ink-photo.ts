import { blobOutline, COLOUR_SPREAD, makeInkBlobs, SKETCH_SPREAD, type InkBlob, type InkSpread, type Point } from "../lib/ink";

/** Masks are drawn small and scaled up: the upscale is what makes the ink edge soft. */
const MASK_SCALE = 0.25;
const INK_TINT = "rgba(24, 36, 64, 0.5)";
/** The photo is never shown much wider than this on screen, so it needn't be drawn larger. */
const MAX_WIDTH = 1000;

function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { canvas, ctx };
}

type Surface = ReturnType<typeof surface>;

/**
 * Draws one campus photograph on a canvas: its pencil sketch develops out of the centre
 * and fades softly into the paper, then an ink splotch lands in the middle and spreads
 * into an irregular shape, soaking the real colour in. Nothing ends as a rectangle.
 */
export class InkPhoto {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly width: number;
  private readonly height: number;
  private readonly sketch: HTMLImageElement;
  private readonly photo: HTMLImageElement;
  private readonly layer: Surface;
  private readonly maskA: Surface;
  private readonly maskB: Surface;
  /** Blobs are filled sharp here, then blurred once into the target mask. */
  private readonly scratch: Surface;
  /** Blobs live in a square of this size; drawing stretches it to the photo's aspect. */
  private readonly square: number;
  private readonly sketchBlobs: InkBlob[];
  private readonly inkBlobs: InkBlob[];
  private lastKey = "";
  /** The black-and-white sketch in its final, soft-edged shape: drawn once, shown at any opacity. */
  private readonly sketchShape: Surface;

  constructor(
    canvas: HTMLCanvasElement,
    sketch: HTMLImageElement,
    photo: HTMLImageElement,
    origin: Point,
    seed: number,
    /** How far the sketch and the colour spread; defaults to the intro's. */
    spread: { sketch?: InkSpread; colour?: InkSpread } = {}
  ) {
    const fit = Math.min(1, MAX_WIDTH / photo.naturalWidth);
    this.width = Math.round(photo.naturalWidth * fit);
    this.height = Math.round(photo.naturalHeight * fit);
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.sketch = sketch;
    this.photo = photo;

    const mw = this.width * MASK_SCALE;
    const mh = this.height * MASK_SCALE;
    this.layer = surface(this.width, this.height);
    this.maskA = surface(mw, mh);
    this.maskB = surface(mw, mh);
    this.scratch = surface(mw, mh);
    this.square = Math.max(mw, mh);
    this.sketchBlobs = makeInkBlobs(this.square, origin, seed + 101, spread.sketch ?? SKETCH_SPREAD);
    this.inkBlobs = makeInkBlobs(this.square, origin, seed, spread.colour ?? COLOUR_SPREAD);

    this.sketchShape = surface(this.width, this.height);
    this.mask(this.maskA, this.sketchBlobs, 1, 6);
    this.paint(this.sketch, this.maskA.canvas, 1, this.sketchShape.ctx);
  }

  private mask(target: Surface, blobs: InkBlob[], p: number, blur: number) {
    const raw = blur > 0 ? this.scratch : target;
    const { canvas, ctx } = raw;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(canvas.width / this.square, canvas.height / this.square);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    for (const blob of blobs) {
      const points = blobOutline(blob, p, blob.main ? 120 : 40);
      if (points.length < 3) continue;
      const last = points[points.length - 1];
      ctx.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
      points.forEach((point, i) => {
        const next = points[(i + 1) % points.length];
        ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
      });
      ctx.closePath();
    }
    // One path, one fill: overlapping blobs union under the nonzero rule.
    ctx.fill("nonzero");
    ctx.restore();
    if (raw === target) return;

    target.ctx.save();
    target.ctx.globalCompositeOperation = "source-over";
    target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
    target.ctx.filter = `blur(${blur}px)`;
    target.ctx.drawImage(canvas, 0, 0);
    target.ctx.restore();
  }

  /** Paint `source` (or a flat tint) through `mask` onto the visible canvas (or `target`). */
  private paint(source: HTMLImageElement | string, mask: HTMLCanvasElement, alpha = 1, target = this.ctx) {
    const { ctx } = this.layer;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, this.width, this.height);
    if (typeof source === "string") {
      ctx.fillStyle = source;
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      ctx.drawImage(source, 0, 0, this.width, this.height);
    }
    ctx.globalCompositeOperation = "destination-in";
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(mask, 0, 0, this.width, this.height);
    target.globalAlpha = alpha;
    target.drawImage(this.layer.canvas, 0, 0);
    target.globalAlpha = 1;
  }

  /**
   * `sketchAlpha`: how strongly the black-and-white sketch shows (the intro keeps every
   * photo waiting faintly, then firms it up as the pen arrives). `inkP`: how far the
   * colour has spread, 0 → 1.
   */
  draw(sketchAlpha: number, inkP: number) {
    const key = `${sketchAlpha.toFixed(3)}:${inkP.toFixed(4)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.ctx.clearRect(0, 0, this.width, this.height);
    if (inkP >= 1) {
      // Done: the colour covers its splotch, with the sketch's soft edge around it.
      this.ctx.drawImage(this.sketchShape.canvas, 0, 0);
      this.mask(this.maskA, this.inkBlobs, 1, 0.9);
      this.paint(this.photo, this.maskA.canvas);
      return;
    }

    // 1. The sketch, at whatever strength the timeline asks for.
    if (sketchAlpha > 0) {
      this.ctx.globalAlpha = sketchAlpha;
      this.ctx.drawImage(this.sketchShape.canvas, 0, 0);
      this.ctx.globalAlpha = 1;
    }
    if (inkP <= 0) return;

    // 2. A wet ink front runs just ahead of the colour, and dries as it settles…
    this.mask(this.maskB, this.inkBlobs, Math.min(1, inkP + 0.035), 1.2);
    this.mask(this.maskA, this.inkBlobs, inkP, 0.9);
    this.maskB.ctx.globalCompositeOperation = "destination-out";
    this.maskB.ctx.drawImage(this.maskA.canvas, 0, 0);
    this.paint(INK_TINT, this.maskB.canvas, 1 - inkP ** 2 * 0.75);

    // 3. …and the real colour soaks in behind it.
    this.paint(this.photo, this.maskA.canvas);
  }
}
