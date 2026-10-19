/*
 * A small QR code maker, for the alumni card's "scan to verify" square. No library: the card
 * only ever encodes one short link (a member's page), so this does just that much of the
 * standard: byte mode, error correction level M (a scuffed or half-covered code still
 * scans), versions 1 to 10 (up to 213 bytes, far more than a link needs). It follows the
 * well-known reference design by Project Nayuki, cut down to those cases.
 *
 * qrModules(text) gives the grid (true = dark), qrPath(modules) one SVG path of the dark
 * squares, so the same code draws on the page and in the downloadable PNG.
 */

// Level M, versions 1–10: error-correction bytes per block, and the number of blocks.
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;

/** How many modules carry data (not the fixed patterns) in a version. */
function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

const dataCodewords = (ver: number) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * BLOCKS[ver];

// ---------- Reed–Solomon over GF(256), the error-correction bytes ----------

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMultiply(coef, factor)));
  }
  return result;
}

/** The data split into blocks, each with its error correction, then interleaved as the standard lays them out. */
function withErrorCorrection(data: number[], ver: number): number[] {
  const numBlocks = BLOCKS[ver];
  const eccLen = ECC_PER_BLOCK[ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const shortBlocks = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < shortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < shortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      // Short blocks carry a placeholder in this column: skip it.
      if (i !== shortLen - eccLen || j >= shortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// ---------- The grid ----------

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

function alignmentPositions(ver: number, size: number): number[] {
  if (ver === 1) return [];
  const count = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

class Grid {
  readonly size: number;
  readonly dark: boolean[][];
  readonly fixed: boolean[][];

  constructor(readonly ver: number) {
    this.size = ver * 4 + 17;
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  set(x: number, y: number, dark: boolean) {
    this.dark[y][x] = dark;
    this.fixed[y][x] = true;
  }

  drawPatterns() {
    const { size } = this;
    for (let i = 0; i < size; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    // The three big squares in the corners, each with its white margin.
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) this.set(x, y, d !== 2 && d !== 4);
        }
    }
    const align = alignmentPositions(this.ver, size);
    const n = align.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    this.drawFormat(0); // reserves the cells; drawn again with the chosen mask
    this.drawVersion();
  }

  drawFormat(mask: number) {
    const data = (0 << 3) | mask; // level M is 0b00
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const { size } = this;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.set(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, size - 15 + i, bit(bits, i));
    this.set(8, size - 8, true);
  }

  drawVersion() {
    if (this.ver < 7) return;
    let rem = this.ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, bit(bits, i));
      this.set(b, a, bit(bits, i));
    }
  }

  /** The bytes, two columns at a time, snaking up and down from the bottom right. */
  drawData(codewords: number[]) {
    const { size } = this;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!this.fixed[y][x] && i < codewords.length * 8) {
            this.dark[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) if (!this.fixed[y][x] && MASKS[mask](x, y)) this.dark[y][x] = !this.dark[y][x];
  }

  /**
   * How hard the grid is to scan: long runs of one colour, 2×2 blocks, and an uneven share
   * of dark. (The standard also scores finder-like patterns; any mask makes a valid code,
   * so the simpler score is enough to pick a good one.)
   */
  penalty(): number {
    const { size, dark } = this;
    let score = 0;
    for (let a = 0; a < size; a++) {
      for (const horizontal of [true, false]) {
        let run = 1;
        for (let b = 1; b <= size; b++) {
          const same = b < size && (horizontal ? dark[a][b] === dark[a][b - 1] : dark[b][a] === dark[b - 1][a]);
          if (same) run++;
          else {
            if (run >= 5) score += run - 2;
            run = 1;
          }
        }
      }
    }
    let darkCount = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (dark[y][x]) darkCount++;
        if (x < size - 1 && y < size - 1) {
          const c = dark[y][x];
          if (c === dark[y][x + 1] && c === dark[y + 1][x] && c === dark[y + 1][x + 1]) score += 3;
        }
      }
    const total = size * size;
    score += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
}

/** The QR code for `text`, as rows of modules (true = dark). Throws if it's too long for version 10. */
export function qrModules(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1;
  while (ver <= MAX_VERSION && 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8 > dataCodewords(ver) * 8) ver++;
  if (ver > MAX_VERSION) throw new Error("Too long for a QR code here.");

  const capacity = dataCodewords(ver) * 8;
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  const grid = new Grid(ver);
  grid.drawPatterns();
  grid.drawData(withErrorCorrection(data, ver));
  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    grid.applyMask(mask);
    grid.drawFormat(mask);
    const score = grid.penalty();
    if (score < bestScore) {
      best = mask;
      bestScore = score;
    }
    grid.applyMask(mask); // undo (masking twice is no mask)
  }
  grid.applyMask(best);
  grid.drawFormat(best);
  return grid.dark;
}

/** One SVG path of the dark modules, one unit each, offset by a quiet zone of `margin` units. */
export function qrPath(modules: boolean[][], margin = 0): string {
  let d = "";
  modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      // A run of dark modules along the row becomes one rectangle.
      let end = x;
      while (end + 1 < row.length && row[end + 1]) end++;
      d += `M${x + margin} ${y + margin}h${end - x + 1}v1h${-(end - x + 1)}z`;
      x = end;
    }
  });
  return d;
}
