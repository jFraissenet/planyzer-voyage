/* eslint-disable */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const SRC = path.join(__dirname, "..", "assets", "planyzer_logo.png");
const OUT = path.join(__dirname, "..", "assets", "planyzer_logo.png");

const data = fs.readFileSync(SRC);
const png = PNG.sync.read(data);

const { width: w, height: h } = png;

// Detect "logo" pixels: alpha > threshold AND not near-white.
const ALPHA_MIN = 16;
const WHITE_LIMIT = 245; // pixels with R,G,B all > limit are considered background

let minX = w,
  minY = h,
  maxX = -1,
  maxY = -1;

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    const a = png.data[i + 3];
    if (a < ALPHA_MIN) continue;
    if (r > WHITE_LIMIT && g > WHITE_LIMIT && b > WHITE_LIMIT) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

if (maxX < 0) {
  console.error("No logo pixels detected.");
  process.exit(1);
}

const bboxW = maxX - minX + 1;
const bboxH = maxY - minY + 1;

// Square crop centered on the bbox.
const side = Math.max(bboxW, bboxH);
const cx = (minX + maxX) / 2;
const cy = (minY + maxY) / 2;
let x0 = Math.round(cx - side / 2);
let y0 = Math.round(cy - side / 2);
// Add small padding (5% of side).
const pad = Math.round(side * 0.05);
x0 -= pad;
y0 -= pad;
const finalSide = side + pad * 2;

// Out-of-bounds → pad with transparent pixels.
const out = new PNG({ width: finalSide, height: finalSide });
for (let y = 0; y < finalSide; y++) {
  for (let x = 0; x < finalSide; x++) {
    const sx = x0 + x;
    const sy = y0 + y;
    const oi = (y * finalSide + x) * 4;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) {
      out.data[oi] = 0;
      out.data[oi + 1] = 0;
      out.data[oi + 2] = 0;
      out.data[oi + 3] = 0;
      continue;
    }
    const si = (sy * w + sx) * 4;
    const r = png.data[si];
    const g = png.data[si + 1];
    const b = png.data[si + 2];
    const a = png.data[si + 3];
    // Make near-white pixels transparent (so the logo blends with any header bg).
    if (a > 0 && r > WHITE_LIMIT && g > WHITE_LIMIT && b > WHITE_LIMIT) {
      out.data[oi] = 0;
      out.data[oi + 1] = 0;
      out.data[oi + 2] = 0;
      out.data[oi + 3] = 0;
    } else {
      out.data[oi] = r;
      out.data[oi + 1] = g;
      out.data[oi + 2] = b;
      out.data[oi + 3] = a;
    }
  }
}

fs.writeFileSync(OUT, PNG.sync.write(out));
console.log(
  `Source ${w}x${h} → bbox ${minX},${minY} ${bboxW}x${bboxH} → output ${finalSide}x${finalSide}`,
);
