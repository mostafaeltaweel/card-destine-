/**
 * test-card-studio.js
 * Automated test suite for CardStudio 90x50.
 * Verifies CardProject, CanvasRenderer math, QR matrix engine, and JSON serialization.
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

  const calculatedW = Math.round((90 / 25.4) * 300);
  const calculatedH = Math.round((50 / 25.4) * 300);
  assert.strictEqual(calculatedW, 1063);
  assert.strictEqual(calculatedH, 591);
});

// 2. CardProject State Management & Event Emitter
it("CardProject initializes with clean V1 schema and fires state changes", () => {
  const project = new CardProject();
  const state = project.getState();

  assert.strictEqual(state.version, "1.0");
  assert.strictEqual(state.dimensions.widthMm, 90);
  assert.strictEqual(state.dimensions.heightMm, 50);
  assert.strictEqual(state.qr.sizeMm, 22);
  assert.strictEqual(state.settings.activeSide, "front");

  let stateChangeCalled = false;
  project.onStateChange((s) => {
    stateChangeCalled = true;
    assert.strictEqual(s.settings.activeSide, "back");
  });

  project.setActiveSide("back");
  assert.strictEqual(stateChangeCalled, true);
});

// 3. QR Coordinate Clamping & Normalization
it("Clamps QR coordinates within boundaries to prevent overflowing card edges", () => {
  const project = new CardProject();
  
  // Try placing at 95% X and 95% Y (overflow)
  project.setQRConfig({ sizeMm: 22 });
  project.setQRPosition(95, 95);

  const state = project.getState();
  const sizePercentX = (22 / 90) * 100; // ~24.44%
  const sizePercentY = (22 / 50) * 100; // 44%
  const expectedMaxX = 100 - sizePercentX;
  const expectedMaxY = 100 - sizePercentY;

  assert(state.qr.xPercent <= expectedMaxX + 0.001, `xPercent ${state.qr.xPercent} <= ${expectedMaxX}`);
  assert(state.qr.yPercent <= expectedMaxY + 0.001, `yPercent ${state.qr.yPercent} <= ${expectedMaxY}`);
});

// 4. QR Preset Positions
it("Calculates preset alignment positions (bottom-right, center, etc.) with safe margin", () => {
  const project = new CardProject();
  project.setQRConfig({ sizeMm: 20 }); // 20mm QR
  project.setQRPresetPosition("bottom-right");

  const state = project.getState();
  assert(state.qr.xPercent > 70, "Bottom right X should be > 70%");
  assert(state.qr.yPercent > 50, "Bottom right Y should be > 50%");

  project.setQRPresetPosition("center");
  const centerState = project.getState();
  // Card is 90x50, QR is 20x20
  // X: (100 - (20/90)*100)/2 = 38.88%
  // Y: (100 - (20/50)*100)/2 = 30.00%
  assert(Math.abs(centerState.qr.xPercent - 38.888) < 0.1);
  assert(Math.abs(centerState.qr.yPercent - 30.0) < 0.1);
});

// 5. Smart Center-Crop Math (object-fit: cover)
it("Calculates smart center-crop for wider images (crop left/right)", () => {
  // Source: 2000 x 800 (ratio 2.5) -> Target: 1063 x 591 (ratio 1.7986)
  const crop = CanvasRenderer.calculateSmartCrop(2000, 800, 1063, 591, "cover");

  assert.strictEqual(crop.sh, 800, "Should use full image height");
  assert(crop.sw < 2000, "Should crop width");
  assert(crop.sx > 0, "Source X offset should be centered > 0");
  assert.strictEqual(crop.sy, 0, "Source Y offset should be 0");
  assert.strictEqual(crop.dw, 1063, "Target width should match canvas");
  assert.strictEqual(crop.dh, 591, "Target height should match canvas");
});

it("Calculates smart center-crop for taller images (crop top/bottom)", () => {
  // Source: 1000 x 1000 (ratio 1.0) -> Target: 1063 x 591 (ratio 1.7986)
  const crop = CanvasRenderer.calculateSmartCrop(1000, 1000, 1063, 591, "cover");

  assert.strictEqual(crop.sw, 1000, "Should use full image width");
  assert(crop.sh < 1000, "Should crop height");
  assert.strictEqual(crop.sx, 0, "Source X offset should be 0");
  assert(crop.sy > 0, "Source Y offset should be centered > 0");
  assert.strictEqual(crop.dw, 1063);
  assert.strictEqual(crop.dh, 591);
});

it("Calculates contain mode (fit with margin, no cropping)", () => {
  // Source: 1000 x 1000 square inside 1063 x 591 target
  const fit = CanvasRenderer.calculateSmartCrop(1000, 1000, 1063, 591, "contain");

  assert.strictEqual(fit.sx, 0);
  assert.strictEqual(fit.sy, 0);
  assert.strictEqual(fit.sw, 1000);
  assert.strictEqual(fit.sh, 1000);
  assert.strictEqual(fit.dh, 591, "Fitted height should equal target height");
  assert.strictEqual(fit.dw, 591, "Fitted width should match height for 1:1 image");
  assert(fit.dx > 0, "Left offset should center the image horizontally");
});

// 6. Standalone QR Code Generator
it("Generates valid QR matrix for URLs", () => {
  const result = StandaloneQRCode.generate("https://nexusai-systems.io");
  assert(result.size >= 21, "QR matrix size should be at least 21x21");
  assert(Array.isArray(result.modules), "Modules should be 2D array");
  assert.strictEqual(result.modules.length, result.size);
  assert.strictEqual(result.modules[0].length, result.size);

  // Check top-left finder pattern corners: [0][0] must be true (dark)
  assert.strictEqual(result.modules[0][0], true, "Top-left finder pattern corner is dark");
});

// 7. Project JSON Serialization and Restoration
it("Serializes project state to clean JSON and restores accurately", async () => {
  const project = new CardProject();
  project.setQRConfig({
    url: "https://mybusiness.com",
    sizeMm: 26,
    side: "front"
  });
  project.setFitMode("front", "contain");

  const jsonString = project.toJSON();
  assert(typeof jsonString === "string");

  const restoredProject = new CardProject();
  await restoredProject.fromJSON(jsonString, false);
  const restoredState = restoredProject.getState();

  assert.strictEqual(restoredState.qr.url, "https://mybusiness.com");
  assert.strictEqual(restoredState.qr.sizeMm, 26);
  assert.strictEqual(restoredState.qr.side, "front");
  assert.strictEqual(restoredState.front.fitMode, "contain");
});

console.log(`\n========================================`);
console.log(`Results: ${passed}/${total} tests passed successfully!`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
