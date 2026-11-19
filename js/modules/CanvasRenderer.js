/**
 * CanvasRenderer.js
 * High-DPI 300 DPI HTML5 Canvas rendering & transform logic.
 * Handles Pan & Zoom, Auto Edge Color matching, safe-zone guides, and QR placement.
 */

export class CanvasRenderer {
  static PRINT_DPI = 300;
  static PRINT_WIDTH_PX = 1063;
  static PRINT_HEIGHT_PX = 591;
  static CARD_WIDTH_MM = 90;
  static CARD_HEIGHT_MM = 50;

  /**
   * Calculate drawing coordinates with Pan & Zoom support.
   */
  static calculateTransform(imgWidth, imgHeight, targetWidth, targetHeight, sideData = {}) {
    if (!imgWidth || !imgHeight || !targetWidth || !targetHeight) {
      return { sx: 0, sy: 0, sw: 0, sh: 0, dx: 0, dy: 0, dw: 0, dh: 0 };
    }

    const fitMode = sideData.fitMode || "contain";
    const zoom = Number(sideData.zoom) || 1.0;
    const panX = (Number(sideData.panX) || 0) / 100;
    const panY = (Number(sideData.panY) || 0) / 100;

    const imgAspect = imgWidth / imgHeight;
    const targetAspect = targetWidth / targetHeight;

    let baseW, baseH;

    if (fitMode === "cover") {
      if (imgAspect > targetAspect) {
        baseH = targetHeight;
        baseW = targetHeight * imgAspect;
      } else {
        baseW = targetWidth;
        baseH = targetWidth / imgAspect;
      }
    } else {
      // Default: "contain" (Fit entire card without cutting off any text)
      if (imgAspect > targetAspect) {
        baseW = targetWidth;
        baseH = targetWidth / imgAspect;
      } else {
        baseH = targetHeight;
        baseW = targetHeight * imgAspect;
      }
    }

    const dw = baseW * zoom;
    const dh = baseH * zoom;
    const dx = (targetWidth - dw) / 2 + (panX * targetWidth);
    const dy = (targetHeight - dh) / 2 + (panY * targetHeight);

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

  static render(canvas, cardState, side, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const sideData = cardState[side] || {};
    const forExport = options.forExport ?? false;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Fill background with detected or chosen edge color
    ctx.fillStyle = sideData.bgColor || "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Render Card Artwork with Pan & Zoom transform
    if (sideData.image && sideData.image.complete && sideData.image.naturalWidth > 0) {
      const transform = this.calculateTransform(
        sideData.image.naturalWidth,
        sideData.image.naturalHeight,
        width,
        height,
        sideData
      );

      ctx.drawImage(
        sideData.image,
        transform.sx, transform.sy, transform.sw, transform.sh,
        transform.dx, transform.dy, transform.dw, transform.dh
      );
    } else {
      this.drawPlaceholder(ctx, width, height, side, forExport);
    }

    // 3. Render QR Code (if assigned to this side)
    const qr = cardState.qr;
    if (qr && qr.enabled && qr.side === side && options.qrCanvas) {
      this.drawQRCode(ctx, width, height, qr, options.qrCanvas, cardState.dimensions);
    }

    // 4. Safe Zone Guide (preview only)
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

  static drawPlaceholder(ctx, width, height, side, forExport) {
    if (forExport) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f8fafc");
    gradient.addColorStop(1, "#f1f5f9");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#e2e8f0";
    const dotSpacing = Math.round(width / 36);
    for (let x = dotSpacing; x < width; x += dotSpacing) {
      for (let y = dotSpacing; y < height; y += dotSpacing) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

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
    ctx.fillText("Smart Zoom & Auto-Edge match", width / 2, height / 2 + baseFontSize * 1.5);
    ctx.restore();
  }

  static drawQRCode(ctx, canvasWidth, canvasHeight, qrState, qrCanvasOrImage, dimensions) {
    const cardWidthMm = dimensions?.widthMm || this.CARD_WIDTH_MM;
    const qrSizePx = Math.round((qrState.sizeMm / cardWidthMm) * canvasWidth);
    const xPx = Math.round((qrState.xPercent / 100) * canvasWidth);
    const yPx = Math.round((qrState.yPercent / 100) * canvasHeight);

    const quietZonePaddingMm = qrState.quietZone ? (qrState.quietZonePaddingMm || 1.5) : 0;
    const paddingPx = Math.round((quietZonePaddingMm / cardWidthMm) * canvasWidth);

    ctx.save();
    if (qrState.quietZone) {
      const boxX = xPx - paddingPx;
      const boxY = yPx - paddingPx;
      const boxW = qrSizePx + (paddingPx * 2);
      const boxH = qrSizePx + (paddingPx * 2);
      const borderRadius = Math.max(3, Math.round(paddingPx * 0.4));

      ctx.fillStyle = qrState.colorLight || "#ffffff";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(boxX, boxY, boxW, boxH, borderRadius);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.drawImage(qrCanvasOrImage, xPx, yPx, qrSizePx, qrSizePx);
    ctx.restore();
  }

  static drawSafeZoneGuide(ctx, width, height, marginMm, dimensions) {
    const cardWidthMm = dimensions?.widthMm || this.CARD_WIDTH_MM;
    const cardHeightMm = dimensions?.heightMm || this.CARD_HEIGHT_MM;

    const insetXPx = Math.round((marginMm / cardWidthMm) * width);
    const insetYPx = Math.round((marginMm / cardHeightMm) * height);

    const safeW = width - (insetXPx * 2);
    const safeH = height - (insetYPx * 2);

    ctx.save();
    ctx.strokeStyle = "rgba(14, 165, 233, 0.75)";
    ctx.lineWidth = Math.max(1, Math.round(width / 700));
    ctx.setLineDash([Math.max(4, Math.round(width / 180)), Math.max(3, Math.round(width / 240))]);
    ctx.strokeRect(insetXPx, insetYPx, safeW, safeH);

    ctx.setLineDash([]);
    const fontSize = Math.max(9, Math.round(height * 0.026));
    ctx.font = `500 ${fontSize}px sans-serif`;
    ctx.fillStyle = "rgba(14, 165, 233, 0.9)";
    ctx.fillText(`${marginMm}mm Safe Cut Zone`, insetXPx + 6, insetYPx + fontSize + 4);
    ctx.restore();
  }

  static drawCenterGuides(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    ctx.restore();
  }

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
