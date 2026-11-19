/**
 * sample-cards.js
 * Generates sample high-resolution business card designs dynamically.
 * Allows users to test the application instantly with 1-click demo templates.
 */

export class SampleCardGenerator {
  /**
   * Generate sleek modern demo front & back cards.
   * @returns {{ frontDataUrl: string, backDataUrl: string, frontImage: Promise<HTMLImageElement>, backImage: Promise<HTMLImageElement> }}
   */
  static generateDemoCards() {
    const width = 1063; // 300 DPI for 90mm
    const height = 591; // 300 DPI for 50mm

    // 1. Generate Front Card (Executive Minimalist)
    const frontCanvas = document.createElement("canvas");
    frontCanvas.width = width;
    frontCanvas.height = height;
    const fCtx = frontCanvas.getContext("2d");

    // Luxury Dark Gradient Background
    const fGrad = fCtx.createLinearGradient(0, 0, width, height);
    fGrad.addColorStop(0, "#090d16");
    fGrad.addColorStop(1, "#111827");
    fCtx.fillStyle = fGrad;
    fCtx.fillRect(0, 0, width, height);

    // Subtle ambient decorative circle
    const circGrad = fCtx.createRadialGradient(width * 0.85, height * 0.2, 10, width * 0.85, height * 0.2, 450);
    circGrad.addColorStop(0, "rgba(56, 189, 248, 0.12)");
    circGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
    fCtx.fillStyle = circGrad;
    fCtx.beginPath();
    fCtx.arc(width * 0.85, height * 0.2, 450, 0, Math.PI * 2);
    fCtx.fill();

    // Geometric accent bar
    fCtx.fillStyle = "#38bdf8"; // Cyan
    fCtx.fillRect(width * 0.08, height * 0.28, 6, height * 0.44);

    // Typography
    fCtx.fillStyle = "#ffffff";
    fCtx.font = "bold 44px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    fCtx.fillText("MOHAMED ELTAWEEL", width * 0.11, height * 0.38);

    fCtx.fillStyle = "#94a3b8";
    fCtx.font = "500 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    fCtx.fillText("Chief AI Architect & Principal Engineer", width * 0.11, height * 0.45);

    // Subtle divider
    fCtx.fillStyle = "rgba(148, 163, 184, 0.25)";
    fCtx.fillRect(width * 0.11, height * 0.52, width * 0.75, 1);

    // Contact Details
    fCtx.fillStyle = "#cbd5e1";
    fCtx.font = "400 19px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    fCtx.fillText("✉  contact@company.ai", width * 0.11, height * 0.62);
    fCtx.fillText("✆  +1 (555) 019-2834", width * 0.11, height * 0.69);
    fCtx.fillText("🌐  www.nexusai-systems.io", width * 0.52, height * 0.62);
    fCtx.fillText("📍  San Francisco, CA", width * 0.52, height * 0.69);

    // Logo icon mark in corner
    fCtx.save();
    fCtx.translate(width * 0.86, height * 0.22);
    fCtx.strokeStyle = "#38bdf8";
    fCtx.lineWidth = 4;
    fCtx.beginPath();
    fCtx.moveTo(-20, 0);
    fCtx.lineTo(0, -20);
    fCtx.lineTo(20, 0);
    fCtx.lineTo(0, 20);
    fCtx.closePath();
    fCtx.stroke();
    fCtx.restore();

    // 2. Generate Back Card (Brand Emblem & QR Area)
    const backCanvas = document.createElement("canvas");
    backCanvas.width = width;
    backCanvas.height = height;
    const bCtx = backCanvas.getContext("2d");

    // Clean Dark Background matching front
    const bGrad = bCtx.createLinearGradient(0, 0, width, height);
    bGrad.addColorStop(0, "#0b0f19");
    bGrad.addColorStop(1, "#131c2e");
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(0, 0, width, height);

    // Center Logo Mark
    bCtx.save();
    bCtx.translate(width * 0.32, height * 0.48);
    bCtx.strokeStyle = "#38bdf8";
    bCtx.lineWidth = 6;
    bCtx.beginPath();
    bCtx.moveTo(-45, 0);
    bCtx.lineTo(0, -45);
    bCtx.lineTo(45, 0);
    bCtx.lineTo(0, 45);
    bCtx.closePath();
    bCtx.stroke();

    bCtx.fillStyle = "#ffffff";
    bCtx.font = "bold 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    bCtx.textAlign = "left";
    bCtx.fillText("NEXUS", 65, 2);

    bCtx.fillStyle = "#38bdf8";
    bCtx.font = "600 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    bCtx.fillText("SYSTEMS AI", 65, 28);
    bCtx.restore();

    // Tagline
    bCtx.fillStyle = "#64748b";
    bCtx.font = "400 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    bCtx.fillText("Precision Engineering • Intelligent Automation", width * 0.18, height * 0.72);

    // Convert to Data URLs and Images
    const frontDataUrl = frontCanvas.toDataURL("image/png");
    const backDataUrl = backCanvas.toDataURL("image/png");

    const loadImg = (url) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = url;
      });

    return {
      frontDataUrl,
      backDataUrl,
      loadFrontImage: () => loadImg(frontDataUrl),
      loadBackImage: () => loadImg(backDataUrl)
    };
  }
}
