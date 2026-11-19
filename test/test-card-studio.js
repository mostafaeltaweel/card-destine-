/**
 * test-card-studio.js
 * Automated test suite for CardStudio 90x50.
 * Verifies CardProject, CanvasRenderer math, ISO QR engine, and transforms.
 */

import assert from "node:assert";
import { CardProject } from "../js/modules/CardProject.js";
import { CanvasRenderer } from "../js/modules/CanvasRenderer.js";
import { StandaloneQRCode } from "../js/modules/qr-engine.js";

console.log("🚀 Starting CardStudio Automated Verification Suite...\n");

let passed = 0;
let total = 0;

function it(description, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(err);
  }
}

// 1. Dimensions and Math Specs
it("Standard dimensions are 90mm x 50mm at 300 DPI (1063 x 591 px)", () => {
  assert.strictEqual(CanvasRenderer.CARD_WIDTH_MM, 90);
  assert.strictEqual(CanvasRenderer.CARD_HEIGHT_MM, 50);
  assert.strictEqual(CanvasRenderer.PRINT_WIDTH_PX, 1063);
  assert.strictEqual(CanvasRenderer.PRINT_HEIGHT_PX, 591);
  assert.strictEqual(CanvasRenderer.PRINT_DPI, 300);
});

// 2. CardProject State Management
it("CardProject initializes with clean V1.1 schema and supports Pan & Zoom", () => {
  const project = new CardProject();
  const state = project.getState();

  assert.strictEqual(state.version, "1.1");
  assert.strictEqual(state.dimensions.widthMm, 90);
  assert.strictEqual(state.dimensions.heightMm, 50);
  assert.strictEqual(state.front.zoom, 1.0);
  assert.strictEqual(state.front.panX, 0);
  assert.strictEqual(state.front.panY, 0);

  project.setImageTransform("front", { zoom: 1.15, panX: -5, panY: 10 });
  const updated = project.getState();
  assert.strictEqual(updated.front.zoom, 1.15);
  assert.strictEqual(updated.front.panX, -5);
  assert.strictEqual(updated.front.panY, 10);
});

// 3. QR Coordinate Clamping
it("Clamps QR coordinates within boundaries", () => {
  const project = new CardProject();
  project.setQRConfig({ sizeMm: 22 });
  project.setQRPosition(95, 95);

  const state = project.getState();
  const sizePercentX = (22 / 90) * 100;
  const sizePercentY = (22 / 50) * 100;
  assert(state.qr.xPercent <= (100 - sizePercentX) + 0.001);
  assert(state.qr.yPercent <= (100 - sizePercentY) + 0.001);
});

// 4. ISO QR Code Normalization & Matrix Generation
it("ISO QR Code engine automatically prepends https:// to URLs and generates valid matrix", () => {
  const url1 = "8ace7cea.job-fair-portfolio.pages.dev";
  const norm1 = StandaloneQRCode.normalizeText(url1);
  assert.strictEqual(norm1, "https://8ace7cea.job-fair-portfolio.pages.dev");

  const matrixRes = StandaloneQRCode.getMatrix(norm1);
  assert(matrixRes.moduleCount >= 21);
  assert.strictEqual(matrixRes.modules.length, matrixRes.moduleCount);
  // Check top-left finder pattern corner
  assert.strictEqual(matrixRes.modules[0][0], true);
  assert.strictEqual(matrixRes.modules[0][1], true);
  assert.strictEqual(matrixRes.modules[0][6], true);
});

// 5. Transform Calculations (Fit Inside - No Crop)
it("Calculates contain transform for 3:2 (890x600) cards so 0% of text is clipped", () => {
  // Source: 890 x 600 (aspect 1.483) -> Target: 1063 x 591 (aspect 1.7986)
  const t = CanvasRenderer.calculateTransform(890, 600, 1063, 591, {
    fitMode: "contain",
    zoom: 1.0,
    panX: 0,
    panY: 0
  });

  // Since image is taller, it fits height exactly: dh = 591
  assert.strictEqual(t.dh, 591, "Height should match canvas height");
  assert(t.dw < 1063, "Width should be less than canvas width (letterboxed on sides)");
  assert(t.dx > 0, "Image is horizontally centered");
  assert.strictEqual(t.dy, 0, "No vertical offset, 100% of top and bottom text preserved");
});

// 6. JSON Export and Restore
it("Serializes and deserializes project state including zoom & pan values", async () => {
  const project = new CardProject();
  project.setImageTransform("front", { zoom: 0.95, panX: 4, panY: -2, bgColor: "#0c266f" });
  project.setQRConfig({ url: "https://my-site.com", sizeMm: 25 });

  const json = project.toJSON();
  const restored = new CardProject();
  await restored.fromJSON(json, false);
  const state = restored.getState();

  assert.strictEqual(state.front.zoom, 0.95);
  assert.strictEqual(state.front.panX, 4);
  assert.strictEqual(state.front.panY, -2);
  assert.strictEqual(state.front.bgColor, "#0c266f");
  assert.strictEqual(state.qr.url, "https://my-site.com");
});

console.log(`\n========================================`);
console.log(`Results: ${passed}/${total} tests passed successfully!`);
console.log(`========================================\n`);

if (passed !== total) process.exit(1);
