/**
 * CanvasRenderer.js
 * High-DPI 300 DPI HTML5 Canvas rendering & smart center-crop logic.
 * Handles exact millimeter-to-pixel math, safe-zone guides, and QR placement.
 */

export class CanvasRenderer {
  /**
   * Standard 300 DPI dimensions for 90mm x 50mm card:
   * Width:  90mm / 25.4 * 300 = 1062.992 => 1063 px
   * Height: 50mm / 25.4 * 300 = 590.551  => 591 px
   */
  static PRINT_DPI = 300;
  static PRINT_WIDTH_PX = 1063;
  static PRINT_HEIGHT_PX = 591;
  static CARD_WIDTH_MM = 90;
  static CARD_HEIGHT_MM = 50;

  /**
   * Calculate smart center-crop or contain dimensions.
   * Preserves aspect ratio completely without stretching or distortion.
   *
   * @param {number} imgWidth - source image natural width
   * @param {number} imgHeight - source image natural height
   * @param {number} targetWidth - target canvas width
   * @param {number} targetHeight - target canvas height
   * @param {"cover" | "contain"} [fitMode="cover"]
   * @returns {{ sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number }}
   */
  static calculateSmartCrop(imgWidth, imgHeight, targetWidth, targetHeight, fitMode = "cover") {
    if (!imgWidth || !imgHeight || !targetWidth || !targetHeight) {
      return { sx: 0, sy: 0, sw: 0, sh: 0, dx: 0, dy: 0, dw: 0, dh: 0 };
    }

    const imgAspect = imgWidth / imgHeight;
    const targetAspect = targetWidth / targetHeight;

    if (fitMode === "contain") {
      // Fit entire image inside target, centered, letterboxed
      let dw, dh, dx, dy;
      if (imgAspect > targetAspect) {
        // Image is wider: fit to width
        dw = targetWidth;
        dh = targetWidth / imgAspect;
        dx = 0;
        dy = (targetHeight - dh) / 2;
      } else {
        // Image is taller or equal: fit to height
        dh = targetHeight;
        dw = targetHeight * imgAspect;
        dx = (targetWidth - dw) / 2;
        dy = 0;
      }
      return {
        sx: 0,
        sy: 0,
        sw: imgWidth,
        sh: imgHeight,
        dx: Math.round(dx),
        dy: Math.round(dy),
        dw: Math.round(dw),
        dh: Math.round(dh)
      };
    }

    // Default: "cover" (smart center-crop)
    let sx = 0;
    let sy = 0;
    let sw = imgWidth;
    let sh = imgHeight;

    if (imgAspect > targetAspect) {
      // Source is wider than target: crop left & right sides
      sw = imgHeight * targetAspect;
      sh = imgHeight;
      sx = (imgWidth - sw) / 2;
      sy = 0;
    } else {
      // Source is taller than target: crop top & bottom sides
      sw = imgWidth;
      sh = imgWidth / targetAspect;
      sx = 0;
      sy = (imgHeight - sh) / 2;
    }

    return {
      sx: Math.round(sx),
      sy: Math.round(sy),
      sw: Math.round(sw),
      sh: Math.round(sh),
      dx: 0,
      dy: 0,
      dw: targetWidth,
      dh: targetHeight
    };
  }

  /**
   * Render a card face onto a canvas.
   *
   * @param {HTMLCanvasElement} canvas - target canvas
   * @param {object} cardState - current CardProject state
   * @param {"front" | "back"} side - which side to render
   * @param {object} [options]
   * @param {boolean} [options.forExport=false] - if true, never renders guides or UI overlays
   * @param {boolean} [options.includeSafeZone=false] - override to draw safe zone
   * @param {boolean} [options.includeCenterGuides=false]
   * @param {HTMLCanvasElement|HTMLImageElement|null} [options.qrCanvas=null] - pre-rendered QR element
   */
  static render(canvas, cardState, side, options = {}) {
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const sideData = cardState[side] || {};
    const forExport = options.forExport ?? false;

    // High quality smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Clear background
    ctx.fillStyle = sideData.bgColor || "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Render Card Artwork / Image
    if (sideData.image && sideData.image.complete && sideData.image.naturalWidth > 0) {
      const crop = this.calculateSmartCrop(
        sideData.image.naturalWidth,
        sideData.image.naturalHeight,
        width,
        height,
        sideData.fitMode || "cover"
      );

      ctx.drawImage(
        sideData.image,
        crop.sx, crop.sy, crop.sw, crop.sh,
        crop.dx, crop.dy, crop.dw, crop.dh
      );
    } else {
      // Clean fallback placeholder when no image uploaded yet
      this.drawPlaceholder(ctx, width, height, side, forExport);
    }

    // 3. Render QR Code (if active on this side)
    const qr = cardState.qr;
    if (qr && qr.enabled && qr.side === side && options.qrCanvas) {
      this.drawQRCode(ctx, width, height, qr, options.qrCanvas, cardState.dimensions);
    }

    // 4. Render Safe Zone Guide (ONLY for live preview, NEVER in print/export!)
    if (!forExport) {
      const showSafeZone = options.includeSafeZone ?? cardState.settings?.showSafeZone ?? true;
      if (showSafeZone) {
        const marginMm = cardState.dimensions?.safeZoneMarginMm || 3;
        this.drawSafeZoneGuide(ctx, width, height, marginMm, cardState.dimensions);
      }

      const showCenterGuides = options.includeCenterGuides ?? cardState.settings?.showCenterGuides ?? false;
      if (showCenterGuides) {
        this.drawCenterGuides(ctx, width, height);
      }
    }
  }

  /**
   * Render an empty side placeholder with subtle minimalist guides.
   */
  static drawPlaceholder(ctx, width, height, side, forExport) {
    if (forExport) {
      // In export, plain white background is standard
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // Modern calm minimalist gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f8fafc");
    gradient.addColorStop(1, "#f1f5f9");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle micro grid / dots pattern
    ctx.fillStyle = "#e2e8f0";
    const dotSpacing = Math.round(width / 36);
    for (let x = dotSpacing; x < width; x += dotSpacing) {
      for (let y = dotSpacing; y < height; y += dotSpacing) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Placeholder label in center
    ctx.save();
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const baseFontSize = Math.round(height * 0.045);
    ctx.font = `600 ${baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const sideTitle = side === "front" ? "FRONT CARD (وجه الكرت)" : "BACK CARD (ظهر الكرت)";
    ctx.fillText(sideTitle, width / 2, height / 2 - baseFontSize);

    ctx.font = `400 ${Math.round(baseFontSize * 0.75)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "#64748b";
    ctx.fillText("Upload PNG / JPG / WebP (90 x 50 mm)", width / 2, height / 2 + baseFontSize * 0.5);
    ctx.fillText("Auto-crops to 1.8:1 aspect ratio", width / 2, height / 2 + baseFontSize * 1.5);
    ctx.restore();
  }

  /**
   * Render QR Code with optional white quiet-zone padding onto canvas.
   */
  static drawQRCode(ctx, canvasWidth, canvasHeight, qrState, qrCanvasOrImage, dimensions) {
    const cardWidthMm = dimensions?.widthMm || this.CARD_WIDTH_MM;
    const cardHeightMm = dimensions?.heightMm || this.CARD_HEIGHT_MM;

    // Calculate QR size in pixels (strictly 1:1 square)
    // qrSizeMm relative to card width
    const qrSizePx = Math.round((qrState.sizeMm / cardWidthMm) * canvasWidth);

    // Coordinates from normalized percentages
    const xPx = Math.round((qrState.xPercent / 100) * canvasWidth);
    const yPx = Math.round((qrState.yPercent / 100) * canvasHeight);

    // Quiet zone padding (default 1.5mm)
    const quietZonePaddingMm = qrState.quietZone ? (qrState.quietZonePaddingMm || 1.5) : 0;
    const paddingPx = Math.round((quietZonePaddingMm / cardWidthMm) * canvasWidth);

    ctx.save();

    // 1. Draw quiet zone background box if enabled
    if (qrState.quietZone) {
      const boxX = xPx - paddingPx;
      const boxY = yPx - paddingPx;
      const boxW = qrSizePx + (paddingPx * 2);
      const boxH = qrSizePx + (paddingPx * 2);
      const borderRadius = Math.max(2, Math.round(paddingPx * 0.4));

      // Draw rounded white box
      ctx.fillStyle = qrState.colorLight || "#ffffff";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(boxX, boxY, boxW, boxH, borderRadius);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();

      // Subtle border for crisp contrast in preview
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 2. Draw QR code image/canvas
    ctx.drawImage(qrCanvasOrImage, xPx, yPx, qrSizePx, qrSizePx);

    ctx.restore();
  }

  /**
   * Draw the 3mm safe cut zone dashed guide line.
   * This is ONLY for interactive on-screen preview.
   */
  static drawSafeZoneGuide(ctx, width, height, marginMm, dimensions) {
    const cardWidthMm = dimensions?.widthMm || this.CARD_WIDTH_MM;
    const cardHeightMm = dimensions?.heightMm || this.CARD_HEIGHT_MM;

    const insetXPx = Math.round((marginMm / cardWidthMm) * width);
    const insetYPx = Math.round((marginMm / cardHeightMm) * height);

    const safeW = width - (insetXPx * 2);
    const safeH = height - (insetYPx * 2);

    ctx.save();
    // Dashed guide border
    ctx.strokeStyle = "rgba(14, 165, 233, 0.75)"; // Sky blue
    ctx.lineWidth = Math.max(1, Math.round(width / 700));
    ctx.setLineDash([Math.max(4, Math.round(width / 180)), Math.max(3, Math.round(width / 240))]);
    ctx.strokeRect(insetXPx, insetYPx, safeW, safeH);

    // Subtle corner badge for Safe Zone
    ctx.setLineDash([]);
    const fontSize = Math.max(9, Math.round(height * 0.026));
    ctx.font = `500 ${fontSize}px sans-serif`;
    ctx.fillStyle = "rgba(14, 165, 233, 0.9)";
    ctx.fillText(`${marginMm}mm Safe Cut Zone`, insetXPx + 6, insetYPx + fontSize + 4);

    ctx.restore();
  }

  /**
   * Draw subtle center alignment crosshairs.
   */
  static drawCenterGuides(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.35)"; // Indigo
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Horizontal center
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Vertical center
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Create an off-screen high-resolution 300 DPI canvas for export.
   * Width: 1063px, Height: 591px (90mm x 50mm @ 300 DPI)
   *
   * @param {object} cardState
   * @param {"front" | "back"} side
   * @param {HTMLCanvasElement|null} qrCanvas
   * @returns {HTMLCanvasElement}
   */
  static create300DPICanvas(cardState, side, qrCanvas = null) {
    const canvas = document.createElement("canvas");
    canvas.width = this.PRINT_WIDTH_PX;
    canvas.height = this.PRINT_HEIGHT_PX;

    this.render(canvas, cardState, side, {
      forExport: true,
      includeSafeZone: false,
      includeCenterGuides: false,
      qrCanvas
    });

    return canvas;
  }
}
