/**
 * bundle.js
 * Universal self-contained bundle for CardStudio 90x50.
 * Works seamlessly both when double-clicked directly from Windows Explorer (file:///)
 * and when hosted on Cloudflare Pages / GitHub Pages (http/https).
 * Zero CORS restrictions, zero build step required.
 */

(function () {
  "use strict";

  // ==========================================
  // 1. qr-engine.js (Standalone QR Code Engine)
  // ==========================================
  const PAD0 = 0xec;
  const PAD1 = 0x11;

  const EXP_TABLE = new Uint8Array(256);
  const LOG_TABLE = new Uint8Array(256);
  for (let i = 0, x = 1; i < 256; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x = (x << 1) ^ (x & 128 ? 0x11d : 0);
  }

  function glog(n) {
    if (n < 1) throw new Error("glog(" + n + ")");
    return LOG_TABLE[n];
  }

  function gexp(n) {
    while (n < 0) n += 255;
    while (n >= 255) n -= 255;
    return EXP_TABLE[n];
  }

  function getErrorCorrectPolynomial(errorCorrectLength) {
    let a = [1];
    for (let i = 0; i < errorCorrectLength; i++) {
      const b = [1, gexp(i)];
      const c = new Array(a.length + b.length - 1).fill(0);
      for (let j = 0; j < a.length; j++) {
        for (let k = 0; k < b.length; k++) {
          c[j + k] ^= gexp(glog(a[j]) + glog(b[k]));
        }
      }
      a = c;
    }
    return a;
  }

  const QR_SPECS = [
    null,
    { totalCodewords: 26, ecCodewords: 10, ecBlocks: [[1, 26]] },
    { totalCodewords: 44, ecCodewords: 16, ecBlocks: [[1, 44]] },
    { totalCodewords: 70, ecCodewords: 26, ecBlocks: [[1, 70]] },
    { totalCodewords: 100, ecCodewords: 18, ecBlocks: [[2, 50]] },
    { totalCodewords: 134, ecCodewords: 24, ecBlocks: [[2, 67]] },
    { totalCodewords: 172, ecCodewords: 16, ecBlocks: [[4, 43]] },
    { totalCodewords: 196, ecCodewords: 18, ecBlocks: [[4, 49]] },
    { totalCodewords: 242, ecCodewords: 22, ecBlocks: [[2, 60], [2, 61]] },
    { totalCodewords: 292, ecCodewords: 22, ecBlocks: [[3, 58], [2, 59]] },
    { totalCodewords: 346, ecCodewords: 26, ecBlocks: [[4, 69], [1, 70]] }
  ];

  const ALIGNMENT_PATTERN_TABLE = [
    [], [], [6, 18], [6, 22], [6, 26], [6, 30],
    [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  class StandaloneQRCode {
    static generate(text) {
      const utf8Bytes = new TextEncoder().encode(text);
      const dataLength = utf8Bytes.length;

      let version = 1;
      let spec = null;
      let dataCapacity = 0;

      for (let v = 1; v <= 10; v++) {
        spec = QR_SPECS[v];
        const ecTotal = spec.ecCodewords * (spec.ecBlocks.reduce((sum, b) => sum + b[0], 0));
        dataCapacity = spec.totalCodewords - ecTotal;
        const headerBits = 4 + (v <= 9 ? 8 : 16);
        const totalBitsNeeded = headerBits + (dataLength * 8);
        const totalBytesNeeded = Math.ceil(totalBitsNeeded / 8);

        if (totalBytesNeeded <= dataCapacity) {
          version = v;
          break;
        }
      }

      if (!spec || version > 10) {
        version = 10;
        spec = QR_SPECS[10];
      }

      const ecTotal = spec.ecCodewords * (spec.ecBlocks.reduce((sum, b) => sum + b[0], 0));
      dataCapacity = spec.totalCodewords - ecTotal;

      const bits = [];
      function pushBits(val, len) {
        for (let i = len - 1; i >= 0; i--) {
          bits.push((val >>> i) & 1);
        }
      }

      pushBits(0b0100, 4);
      pushBits(dataLength, version <= 9 ? 8 : 16);
      for (let i = 0; i < dataLength; i++) {
        pushBits(utf8Bytes[i], 8);
      }

      const maxDataBits = dataCapacity * 8;
      for (let i = 0; i < 4 && bits.length < maxDataBits; i++) {
        bits.push(0);
      }
      while (bits.length % 8 !== 0) {
        bits.push(0);
      }

      const dataBytes = [];
      for (let i = 0; i < bits.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) {
          b = (b << 1) | bits[i + j];
        }
        dataBytes.push(b);
      }

      let pad = 0;
      while (dataBytes.length < dataCapacity) {
        dataBytes.push((pad++ % 2 === 0) ? PAD0 : PAD1);
      }

      const rsPoly = getErrorCorrectPolynomial(spec.ecCodewords);
      const blocksData = [];
      const blocksEC = [];
      let byteOffset = 0;

      for (const [numBlocks, blockSize] of spec.ecBlocks) {
        const dataInBlock = blockSize - spec.ecCodewords;
        for (let b = 0; b < numBlocks; b++) {
          const d = dataBytes.slice(byteOffset, byteOffset + dataInBlock);
          byteOffset += dataInBlock;
          blocksData.push(d);

          const num = [...d, ...new Array(spec.ecCodewords).fill(0)];
          for (let i = 0; i < d.length; i++) {
            const factor = num[i];
            if (factor !== 0) {
              const logFactor = glog(factor);
              for (let j = 0; j < rsPoly.length; j++) {
                num[i + j] ^= gexp(logFactor + glog(rsPoly[j]));
              }
            }
          }
          blocksEC.push(num.slice(d.length));
        }
      }

      const finalCodewords = [];
      const maxDataBlockLen = Math.max(...blocksData.map(b => b.length));
      for (let i = 0; i < maxDataBlockLen; i++) {
        for (let b = 0; b < blocksData.length; b++) {
          if (i < blocksData[b].length) {
            finalCodewords.push(blocksData[b][i]);
          }
        }
      }
      for (let i = 0; i < spec.ecCodewords; i++) {
        for (let b = 0; b < blocksEC.length; b++) {
          finalCodewords.push(blocksEC[b][i]);
        }
      }

      const moduleCount = version * 4 + 17;
      const matrix = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(null));
      const isReserved = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(false));

      function markReserved(r, c) {
        if (r >= 0 && r < moduleCount && c >= 0 && c < moduleCount) {
          isReserved[r][c] = true;
        }
      }

      function drawFinder(row, col) {
        for (let r = -1; r <= 7; r++) {
          for (let c = -1; c <= 7; c++) {
            const tr = row + r;
            const tc = col + c;
            if (tr >= 0 && tr < moduleCount && tc >= 0 && tc < moduleCount) {
              markReserved(tr, tc);
              if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
                matrix[tr][tc] = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
              } else {
                matrix[tr][tc] = false;
              }
            }
          }
        }
      }

      drawFinder(0, 0);
      drawFinder(0, moduleCount - 7);
      drawFinder(moduleCount - 7, 0);

      const alignCoords = ALIGNMENT_PATTERN_TABLE[version];
      for (const r of alignCoords) {
        for (const c of alignCoords) {
          if (isReserved[r][c]) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              markReserved(r + dr, c + dc);
              matrix[r + dr][c + dc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
            }
          }
        }
      }

      for (let i = 8; i < moduleCount - 8; i++) {
        if (!isReserved[6][i]) {
          markReserved(6, i);
          matrix[6][i] = (i % 2 === 0);
        }
        if (!isReserved[i][6]) {
          markReserved(i, 6);
          matrix[i][6] = (i % 2 === 0);
        }
      }

      markReserved(4 * version + 9, 8);
      matrix[4 * version + 9][8] = true;

      for (let i = 0; i < 9; i++) {
        markReserved(8, i);
        markReserved(i, 8);
      }
      for (let i = moduleCount - 8; i < moduleCount; i++) {
        markReserved(8, i);
        markReserved(i, 8);
      }

      const finalBits = [];
      for (const byte of finalCodewords) {
        for (let i = 7; i >= 0; i--) {
          finalBits.push((byte >>> i) & 1);
        }
      }
      while (finalBits.length < moduleCount * moduleCount) finalBits.push(0);

      let bitIndex = 0;
      let upward = true;
      for (let col = moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        const rows = upward
          ? Array.from({ length: moduleCount }, (_, i) => moduleCount - 1 - i)
          : Array.from({ length: moduleCount }, (_, i) => i);

        for (const row of rows) {
          for (const c of [col, col - 1]) {
            if (!isReserved[row][c]) {
              const bit = bitIndex < finalBits.length ? finalBits[bitIndex++] : 0;
              const mask = ((row + c) % 2 === 0);
              matrix[row][c] = (bit === 1) ? !mask : mask;
            }
          }
        }
        upward = !upward;
      }

      const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
      for (let i = 0; i < 6; i++) matrix[8][i] = !!formatBits[i];
      matrix[8][7] = !!formatBits[6];
      matrix[8][8] = !!formatBits[7];
      matrix[7][8] = !!formatBits[8];
      for (let i = 0; i < 6; i++) matrix[5 - i][8] = !!formatBits[9 + i];

      for (let i = 0; i < 8; i++) matrix[moduleCount - 1 - i][8] = !!formatBits[i];
      for (let i = 0; i < 7; i++) matrix[8][moduleCount - 7 + i] = !!formatBits[8 + i];

      return { modules: matrix, size: moduleCount };
    }

    static renderToCanvas(text, pixelSize = 512, colorDark = "#0f172a", colorLight = "#ffffff") {
      const { modules, size } = this.generate(text);
      const canvas = document.createElement("canvas");
      canvas.width = pixelSize;
      canvas.height = pixelSize;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = colorLight;
      ctx.fillRect(0, 0, pixelSize, pixelSize);

      ctx.fillStyle = colorDark;
      const moduleSize = pixelSize / size;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (modules[r][c]) {
            ctx.fillRect(
              Math.round(c * moduleSize),
              Math.round(r * moduleSize),
              Math.ceil(moduleSize),
              Math.ceil(moduleSize)
            );
          }
        }
      }

      return canvas;
    }
  }

  // ==========================================
  // 2. CardProject.js (State Management)
  // ==========================================
  class CardProject {
    static VERSION = "1.0";
    static DEFAULT_DIMENSIONS = {
      widthMm: 90,
      heightMm: 50,
      dpi: 300,
      get pixelWidth() {
        return Math.round((this.widthMm / 25.4) * this.dpi);
      },
      get pixelHeight() {
        return Math.round((this.heightMm / 25.4) * this.dpi);
      },
      get aspectRatio() {
        return this.widthMm / this.heightMm;
      }
    };

    constructor(initialData = null) {
      this._listeners = new Map();
      this.resetToDefaults(false);

      if (initialData) {
        this.fromJSON(initialData, false);
      }
    }

    resetToDefaults(notify = true) {
      this.state = {
        version: CardProject.VERSION,
        metadata: {
          title: "Untitled Business Card",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        dimensions: {
          widthMm: 90,
          heightMm: 50,
          dpi: 300,
          safeZoneMarginMm: 3
        },
        front: {
          image: null,
          dataUrl: null,
          fileName: "",
          fileSize: 0,
          fitMode: "cover",
          bgColor: "#ffffff"
        },
        back: {
          image: null,
          dataUrl: null,
          fileName: "",
          fileSize: 0,
          fitMode: "cover",
          bgColor: "#ffffff"
        },
        qr: {
          enabled: true,
          side: "back",
          url: "https://nexusai-systems.io",
          sizeMm: 22,
          xPercent: 70,
          yPercent: 50,
          quietZone: true,
          quietZonePaddingMm: 1.5,
          colorDark: "#0f172a",
          colorLight: "#ffffff",
          errorCorrectionLevel: "H"
        },
        settings: {
          showSafeZone: true,
          showCenterGuides: false,
          activeSide: "front"
        },
        layers: []
      };

      if (notify) {
        this.emit("stateChange", this.state);
        this.emit("reset", this.state);
      }
    }

    subscribe(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(callback);
      return () => this.unsubscribe(event, callback);
    }

    on(event, callback) {
      return this.subscribe(event, callback);
    }

    unsubscribe(event, callback) {
      if (this._listeners.has(event)) {
        this._listeners.get(event).delete(callback);
      }
    }

    off(event, callback) {
      this.unsubscribe(event, callback);
    }

    onStateChange(callback) {
      return this.subscribe("stateChange", callback);
    }

    emit(event, data) {
      if (this._listeners.has(event)) {
        for (const listener of this._listeners.get(event)) {
          try {
            listener(data);
          } catch (err) {
            console.error(`[CardProject] Error in listener "${event}":`, err);
          }
        }
      }
    }

    getState() {
      return this.state;
    }

    setActiveSide(side) {
      if (side !== "front" && side !== "back") return;
      if (this.state.settings.activeSide === side) return;
      this.state.settings.activeSide = side;
      this.state.metadata.updatedAt = new Date().toISOString();
      this.emit("stateChange", this.state);
      this.emit("sideChange", side);
    }

    setImage(side, image, dataUrl, fileName = "", fileSize = 0) {
      if (side !== "front" && side !== "back") return;

      this.state[side].image = image;
      this.state[side].dataUrl = dataUrl;
      this.state[side].fileName = fileName;
      this.state[side].fileSize = fileSize;
      this.state.metadata.updatedAt = new Date().toISOString();

      this.emit("stateChange", this.state);
      this.emit("imageChange", { side, hasImage: !!dataUrl, fileName });
    }

    removeImage(side) {
      this.setImage(side, null, null, "", 0);
    }

    setFitMode(side, mode) {
      if (side !== "front" && side !== "back") return;
      if (mode !== "cover" && mode !== "contain") return;

      this.state[side].fitMode = mode;
      this.state.metadata.updatedAt = new Date().toISOString();
      this.emit("stateChange", this.state);
    }

    setQRConfig(updates) {
      Object.assign(this.state.qr, updates);
      this.state.qr.sizeMm = Math.max(10, Math.min(35, Number(this.state.qr.sizeMm) || 20));
      this.clampQRCoordinates();

      this.state.metadata.updatedAt = new Date().toISOString();
      this.emit("stateChange", this.state);
      this.emit("qrChange", this.state.qr);
    }

    setQRPosition(xPercent, yPercent) {
      this.state.qr.xPercent = xPercent;
      this.state.qr.yPercent = yPercent;
      this.clampQRCoordinates();

      this.state.metadata.updatedAt = new Date().toISOString();
      this.emit("stateChange", this.state);
      this.emit("qrMove", { xPercent: this.state.qr.xPercent, yPercent: this.state.qr.yPercent });
    }

    clampQRCoordinates() {
      const cardWidthMm = this.state.dimensions.widthMm;
      const cardHeightMm = this.state.dimensions.heightMm;
      const qrSizeMm = this.state.qr.sizeMm;

      const sizePercentX = (qrSizeMm / cardWidthMm) * 100;
      const sizePercentY = (qrSizeMm / cardHeightMm) * 100;

      const maxX = Math.max(0, 100 - sizePercentX);
      const maxY = Math.max(0, 100 - sizePercentY);

      this.state.qr.xPercent = Math.max(0, Math.min(maxX, this.state.qr.xPercent));
      this.state.qr.yPercent = Math.max(0, Math.min(maxY, this.state.qr.yPercent));
    }

    setQRPresetPosition(preset) {
      const cardWidthMm = this.state.dimensions.widthMm;
      const cardHeightMm = this.state.dimensions.heightMm;
      const qrSizeMm = this.state.qr.sizeMm;
      const marginMm = this.state.dimensions.safeZoneMarginMm || 3;

      const marginPercentX = (marginMm / cardWidthMm) * 100;
      const marginPercentY = (marginMm / cardHeightMm) * 100;
      const sizePercentX = (qrSizeMm / cardWidthMm) * 100;
      const sizePercentY = (qrSizeMm / cardHeightMm) * 100;

      switch (preset) {
        case "bottom-right":
          this.state.qr.xPercent = 100 - marginPercentX - sizePercentX;
          this.state.qr.yPercent = 100 - marginPercentY - sizePercentY;
          break;
        case "bottom-left":
          this.state.qr.xPercent = marginPercentX;
          this.state.qr.yPercent = 100 - marginPercentY - sizePercentY;
          break;
        case "top-right":
          this.state.qr.xPercent = 100 - marginPercentX - sizePercentX;
          this.state.qr.yPercent = marginPercentY;
          break;
        case "top-left":
          this.state.qr.xPercent = marginPercentX;
          this.state.qr.yPercent = marginPercentY;
          break;
        case "center":
          this.state.qr.xPercent = (100 - sizePercentX) / 2;
          this.state.qr.yPercent = (100 - sizePercentY) / 2;
          break;
      }

      this.clampQRCoordinates();
      this.state.metadata.updatedAt = new Date().toISOString();
      this.emit("stateChange", this.state);
      this.emit("qrMove", { xPercent: this.state.qr.xPercent, yPercent: this.state.qr.yPercent });
    }

    setSetting(key, value) {
      this.state.settings[key] = value;
      this.emit("stateChange", this.state);
    }

    toJSON() {
      return JSON.stringify({
        version: this.state.version,
        metadata: this.state.metadata,
        dimensions: this.state.dimensions,
        front: {
          dataUrl: this.state.front.dataUrl,
          fileName: this.state.front.fileName,
          fitMode: this.state.front.fitMode,
          bgColor: this.state.front.bgColor
        },
        back: {
          dataUrl: this.state.back.dataUrl,
          fileName: this.state.back.fileName,
          fitMode: this.state.back.fitMode,
          bgColor: this.state.back.bgColor
        },
        qr: { ...this.state.qr },
        settings: { ...this.state.settings },
        layers: [...this.state.layers]
      }, null, 2);
    }

    async fromJSON(json, notify = true) {
      const data = typeof json === "string" ? JSON.parse(json) : json;
      if (!data) return;

      this.state.version = data.version || CardProject.VERSION;
      this.state.dimensions = { ...this.state.dimensions, ...(data.dimensions || {}) };

      if (data.front) {
        this.state.front = { ...this.state.front, ...data.front };
        if (data.front.dataUrl) {
          this.state.front.image = await this._loadImage(data.front.dataUrl);
        }
      }

      if (data.back) {
        this.state.back = { ...this.state.back, ...data.back };
        if (data.back.dataUrl) {
          this.state.back.image = await this._loadImage(data.back.dataUrl);
        }
      }

      if (data.qr) {
        this.state.qr = { ...this.state.qr, ...data.qr };
        this.clampQRCoordinates();
      }

      if (data.settings) {
        this.state.settings = { ...this.state.settings, ...data.settings };
      }

      if (notify) {
        this.emit("stateChange", this.state);
      }
    }

    _loadImage(dataUrl) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
    }
  }

  // ==========================================
  // 3. CanvasRenderer.js (300 DPI Rendering)
  // ==========================================
  class CanvasRenderer {
    static PRINT_DPI = 300;
    static PRINT_WIDTH_PX = 1063;
    static PRINT_HEIGHT_PX = 591;
    static CARD_WIDTH_MM = 90;
    static CARD_HEIGHT_MM = 50;

    static calculateSmartCrop(imgWidth, imgHeight, targetWidth, targetHeight, fitMode = "cover") {
      if (!imgWidth || !imgHeight || !targetWidth || !targetHeight) {
        return { sx: 0, sy: 0, sw: 0, sh: 0, dx: 0, dy: 0, dw: 0, dh: 0 };
      }

      const imgAspect = imgWidth / imgHeight;
      const targetAspect = targetWidth / targetHeight;

      if (fitMode === "contain") {
        let dw, dh, dx, dy;
        if (imgAspect > targetAspect) {
          dw = targetWidth;
          dh = targetWidth / imgAspect;
          dx = 0;
          dy = (targetHeight - dh) / 2;
        } else {
          dh = targetHeight;
          dw = targetHeight * imgAspect;
          dx = (targetWidth - dw) / 2;
          dy = 0;
        }
        return {
          sx: 0, sy: 0, sw: imgWidth, sh: imgHeight,
          dx: Math.round(dx), dy: Math.round(dy), dw: Math.round(dw), dh: Math.round(dh)
        };
      }

      let sx = 0, sy = 0, sw = imgWidth, sh = imgHeight;
      if (imgAspect > targetAspect) {
        sw = imgHeight * targetAspect;
        sh = imgHeight;
        sx = (imgWidth - sw) / 2;
        sy = 0;
      } else {
        sw = imgWidth;
        sh = imgWidth / targetAspect;
        sx = 0;
        sy = (imgHeight - sh) / 2;
      }

      return {
        sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(sw), sh: Math.round(sh),
        dx: 0, dy: 0, dw: targetWidth, dh: targetHeight
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

      // 1. Clear background
      ctx.fillStyle = sideData.bgColor || "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // 2. Render Artwork
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
        this.drawPlaceholder(ctx, width, height, side, forExport);
      }

      // 3. Render QR Code
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
      ctx.fillText("Auto-crops to 1.8:1 aspect ratio", width / 2, height / 2 + baseFontSize * 1.5);
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
        const borderRadius = Math.max(2, Math.round(paddingPx * 0.4));

        ctx.fillStyle = qrState.colorLight || "#ffffff";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(boxX, boxY, boxW, boxH, borderRadius);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();

        ctx.strokeStyle = "rgba(0,0,0,0.06)";
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

  // ==========================================
  // 4. QRManager.js (Drag & Drop + Generation)
  // ==========================================
  class QRManager {
    constructor(cardProject, stageContainer) {
      this.project = cardProject;
      this.stageContainer = stageContainer;
      this.qrCanvasCache = null;
      this.lastRenderedUrl = "";

      this.isDragging = false;
      this.pointerId = null;
      this.dragStartPointer = { x: 0, y: 0 };
      this.dragStartCoords = { xPercent: 0, yPercent: 0 };
      this.onPositionChange = null;

      this._initPointerListeners();
    }

    async getQRCanvas() {
      const qrState = this.project.getState().qr;
      if (!qrState.enabled || qrState.side === "none" || !qrState.url) {
        return null;
      }

      const cacheKey = `${qrState.url}|${qrState.colorDark}|${qrState.colorLight}`;
      if (this.qrCanvasCache && this.lastRenderedUrl === cacheKey) {
        return this.qrCanvasCache;
      }

      const canvas = await this._generateQRCanvas(
        qrState.url,
        512,
        qrState.colorDark || "#0f172a",
        qrState.colorLight || "#ffffff"
      );

      this.qrCanvasCache = canvas;
      this.lastRenderedUrl = cacheKey;
      return canvas;
    }

    async _generateQRCanvas(url, size, colorDark, colorLight) {
      if (typeof window !== "undefined" && window.QRCode) {
        try {
          const tempDiv = document.createElement("div");
          tempDiv.style.display = "none";
          document.body.appendChild(tempDiv);

          new window.QRCode(tempDiv, {
            text: url,
            width: size,
            height: size,
            colorDark: colorDark,
            colorLight: colorLight,
            correctLevel: window.QRCode.CorrectLevel.H
          });

          await new Promise((r) => setTimeout(r, 20));

          const canvas = tempDiv.querySelector("canvas");
          if (canvas) {
            const resCanvas = document.createElement("canvas");
            resCanvas.width = size;
            resCanvas.height = size;
            resCanvas.getContext("2d").drawImage(canvas, 0, 0);
            document.body.removeChild(tempDiv);
            return resCanvas;
          }
          document.body.removeChild(tempDiv);
        } catch (e) {
          // Fallback to standalone
        }
      }

      return StandaloneQRCode.renderToCanvas(url, size, colorDark, colorLight);
    }

    invalidateCache() {
      this.qrCanvasCache = null;
      this.lastRenderedUrl = "";
    }

    getQRBoundingBoxPx() {
      if (!this.stageContainer) return null;

      const rect = this.stageContainer.getBoundingClientRect();
      const state = this.project.getState();
      const qr = state.qr;
      const activeSide = state.settings.activeSide;

      if (!qr.enabled || qr.side !== activeSide) return null;

      const cardWidthMm = state.dimensions.widthMm;
      const qrSizePx = (qr.sizeMm / cardWidthMm) * rect.width;
      const xPx = (qr.xPercent / 100) * rect.width;
      const yPx = (qr.yPercent / 100) * rect.height;

      const paddingMm = qr.quietZone ? (qr.quietZonePaddingMm || 1.5) : 0;
      const paddingPx = (paddingMm / cardWidthMm) * rect.width;

      return {
        x: xPx,
        y: yPx,
        width: qrSizePx,
        height: qrSizePx,
        padding: paddingPx,
        boxX: xPx - paddingPx,
        boxY: yPx - paddingPx,
        boxWidth: qrSizePx + (paddingPx * 2),
        boxHeight: qrSizePx + (paddingPx * 2)
      };
    }

    isPointerOverQR(clientX, clientY) {
      if (!this.stageContainer) return false;
      const rect = this.stageContainer.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;

      const box = this.getQRBoundingBoxPx();
      if (!box) return false;

      return (
        localX >= box.boxX &&
        localX <= box.boxX + box.boxWidth &&
        localY >= box.boxY &&
        localY <= box.boxY + box.boxHeight
      );
    }

    _initPointerListeners() {
      if (!this.stageContainer) return;

      this.stageContainer.addEventListener("pointerdown", (e) => this._onPointerDown(e));
      window.addEventListener("pointermove", (e) => this._onPointerMove(e));
      window.addEventListener("pointerup", (e) => this._onPointerUp(e));
      window.addEventListener("pointercancel", (e) => this._onPointerUp(e));
    }

    _onPointerDown(e) {
      const state = this.project.getState();
      if (!state.qr.enabled || state.qr.side !== state.settings.activeSide) return;

      if (this.isPointerOverQR(e.clientX, e.clientY)) {
        this.isDragging = true;
        this.pointerId = e.pointerId;
        this.dragStartPointer = { x: e.clientX, y: e.clientY };
        this.dragStartCoords = {
          xPercent: state.qr.xPercent,
          yPercent: state.qr.yPercent
        };

        try {
          this.stageContainer.setPointerCapture(e.pointerId);
        } catch (err) {}

        this.stageContainer.classList.add("cursor-grabbing");
        e.preventDefault();
      }
    }

    _onPointerMove(e) {
      if (!this.isDragging) {
        const isOver = this.isPointerOverQR(e.clientX, e.clientY);
        if (isOver) {
          this.stageContainer.classList.add("cursor-grab");
        } else {
          this.stageContainer.classList.remove("cursor-grab");
        }
        return;
      }

      const rect = this.stageContainer.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaX = e.clientX - this.dragStartPointer.x;
      const deltaY = e.clientY - this.dragStartPointer.y;

      const deltaPercentX = (deltaX / rect.width) * 100;
      const deltaPercentY = (deltaY / rect.height) * 100;

      const newXPercent = this.dragStartCoords.xPercent + deltaPercentX;
      const newYPercent = this.dragStartCoords.yPercent + deltaPercentY;

      this.project.setQRPosition(newXPercent, newYPercent);

      if (this.onPositionChange) {
        const state = this.project.getState();
        const xMm = (state.qr.xPercent / 100) * state.dimensions.widthMm;
        const yMm = (state.qr.yPercent / 100) * state.dimensions.heightMm;
        this.onPositionChange({
          xPercent: state.qr.xPercent.toFixed(1),
          yPercent: state.qr.yPercent.toFixed(1),
          xMm: xMm.toFixed(1),
          yMm: yMm.toFixed(1),
          sizeMm: state.qr.sizeMm
        });
      }
    }

    _onPointerUp(e) {
      if (this.isDragging) {
        this.isDragging = false;
        this.pointerId = null;
        this.stageContainer.classList.remove("cursor-grabbing");
        try {
          if (e.pointerId) this.stageContainer.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    }

    getFormattedCoordinates() {
      const state = this.project.getState();
      const xMm = (state.qr.xPercent / 100) * state.dimensions.widthMm;
      const yMm = (state.qr.yPercent / 100) * state.dimensions.heightMm;
      return {
        xPercent: state.qr.xPercent.toFixed(1),
        yPercent: state.qr.yPercent.toFixed(1),
        xMm: xMm.toFixed(1),
        yMm: yMm.toFixed(1),
        sizeMm: state.qr.sizeMm
      };
    }
  }

  // ==========================================
  // 5. PDFExporter.js (Print PDF)
  // ==========================================
  class PDFExporter {
    static async exportPDF(cardProject, qrManager, options = {}) {
      const onProgress = options.onProgress || (() => {});
      const state = cardProject.getState();
      const fileName = options.fileName || `business-card-${Date.now()}.pdf`;

      onProgress("Initializing PDF engine...", 10);

      const jsPDFConstructor = (typeof window !== "undefined" && (window.jspdf?.jsPDF || window.jsPDF));
      if (!jsPDFConstructor) {
        throw new Error("jsPDF library is not loaded. Please ensure you are connected to the internet or reload.");
      }

      onProgress("Rendering high-res elements...", 25);
      const qrCanvas = await qrManager.getQRCanvas();

      onProgress("Rendering Front Card (300 DPI)...", 45);
      const frontCanvas = CanvasRenderer.create300DPICanvas(state, "front", qrCanvas);

      const hasBackImage = !!(state.back.image || state.back.dataUrl);
      const hasBackQR = state.qr.enabled && state.qr.side === "back";
      const shouldIncludeBack = hasBackImage || hasBackQR;

      let backCanvas = null;
      if (shouldIncludeBack) {
        onProgress("Rendering Back Card (300 DPI)...", 70);
        backCanvas = CanvasRenderer.create300DPICanvas(state, "back", qrCanvas);
      }

      onProgress("Compiling print-ready PDF...", 85);
      const doc = new jsPDFConstructor({
        orientation: "landscape",
        unit: "mm",
        format: [90, 50],
        compress: true
      });

      const frontDataUrl = frontCanvas.toDataURL("image/jpeg", 0.98);
      doc.addImage(frontDataUrl, "JPEG", 0, 0, 90, 50, undefined, "FAST");

      if (shouldIncludeBack && backCanvas) {
        const backDataUrl = backCanvas.toDataURL("image/jpeg", 0.98);
        doc.addPage([90, 50], "landscape");
        doc.addImage(backDataUrl, "JPEG", 0, 0, 90, 50, undefined, "FAST");
      }

      doc.setProperties({
        title: state.metadata.title || "Business Card 90x50mm",
        subject: "Print-ready double-sided business card",
        author: "CardStudio 90x50",
        creator: "CardStudio 90x50"
      });

      onProgress("Finalizing download...", 95);
      doc.save(fileName);
      onProgress("Complete!", 100);

      return doc.output("blob");
    }

    static async exportPNG(cardProject, qrManager, side = "front") {
      const state = cardProject.getState();
      const qrCanvas = await qrManager.getQRCanvas();
      const canvas = CanvasRenderer.create300DPICanvas(state, side, qrCanvas);

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `card-${side}-300dpi-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // ==========================================
  // 6. i18n.js (Bilingual Controller)
  // ==========================================
  const translations = {
    en: {
      appTitle: "CardStudio 90x50",
      appSubtitle: "Print-Ready Double-Sided Business Card Designer",
      frontCardTab: "Front Card",
      backCardTab: "Back Card",
      qrBadge: "QR Active",
      sectionImages: "1. Card Artwork",
      sectionImagesDesc: "Upload Front and Back designs. Images automatically auto-crop to 90×50mm (1.8:1 aspect ratio).",
      frontUploadLabel: "Front Side Image",
      backUploadLabel: "Back Side Image",
      uploadPlaceholder: "Click or drag & drop (PNG, JPG, WebP)",
      removeBtn: "Remove",
      fitModeLabel: "Smart Fit Mode",
      fitModeCover: "Auto-Crop Fill (Cover - Recommended)",
      fitModeContain: "Fit with Margin (Contain)",
      sectionQR: "2. Interactive QR Code",
      sectionQRDesc: "Generate a dynamic QR code and position it smoothly with drag & drop on the card preview.",
      qrUrlLabel: "Destination URL",
      qrUrlPlaceholder: "https://yourwebsite.com",
      qrSideLabel: "QR Placement Side",
      qrSideNone: "None (Disabled)",
      qrSideFront: "Front Card",
      qrSideBack: "Back Card (Recommended)",
      qrSizeLabel: "QR Size (1:1 Ratio)",
      qrQuietZoneLabel: "White Quiet-Zone Box",
      qrQuietZoneHint: "Adds white padding so QR scans easily on busy/dark designs",
      quickAlignLabel: "Quick Snap Presets",
      alignBottomRight: "Bottom-Right",
      alignBottomLeft: "Bottom-Left",
      alignTopRight: "Top-Right",
      alignCenter: "Center",
      sectionGuides: "3. Print Guides & View",
      safeZoneLabel: "3mm Safe Cut Margin (Inner dashed line)",
      safeZoneHint: "Ensures text & logos aren't chopped off at the print shop (preview only)",
      centerGuidesLabel: "Center Alignment Crosshairs",
      downloadPdfBtn: "Download Print-Ready PDF (90×50mm)",
      downloadPdfHint: "300 DPI press-ready 2-page PDF with exact millimeter bounds",
      exportPngFront: "Export Front PNG (300 DPI)",
      exportPngBack: "Export Back PNG (300 DPI)",
      loadDemoBtn: "Load Demo Template",
      resetBtn: "Reset",
      liveCoordsLabel: "Live QR Position",
      printSpecsBadge: "Spec: 90×50 mm • 300 DPI (1063×591 px) • Press-Ready",
      dragHint: "💡 Tip: Click & drag the QR code directly on the preview card!",
      pdfGenerating: "Generating 300 DPI PDF...",
      pdfSuccess: "PDF downloaded successfully!",
      demoLoaded: "Demo card loaded successfully!",
      resetConfirm: "Are you sure you want to reset the current card design?",
      imageLoaded: "Image loaded"
    },
    ar: {
      appTitle: "استوديو كروت العمل 90×50",
      appSubtitle: "أداة احترافية لتصميم وتصدير كروت العمل للطباعة مباشرة",
      frontCardTab: "وجه الكرت",
      backCardTab: "ظهر الكرت",
      qrBadge: "الباركود هنا",
      sectionImages: "1. صور وتصميم الكرت",
      sectionImagesDesc: "ارفع تصميم الوجه والظهر. يتم القص التلقائي الذكي بدقة ليتطابق مع مقاس 90×50 مم (نسبة 1.8:1).",
      frontUploadLabel: "صورة وجه الكرت",
      backUploadLabel: "صورة ظهر الكرت",
      uploadPlaceholder: "اضغط أو اسحب وأفلت هنا (PNG, JPG, WebP)",
      removeBtn: "حذف",
      fitModeLabel: "طريقة الملاءمة الذكية",
      fitModeCover: "ملء وقص تلقائي ذكي (مستحسن - Cover)",
      fitModeContain: "احتواء كامل مع هوامش (Contain)",
      sectionQR: "2. باركود الموقع التفاعلي (QR)",
      sectionQRDesc: "أنشئ كود QR وضع مكانه بسهولة بالسحب والإفلات المباشر على الكرت في الشاشة.",
      qrUrlLabel: "رابط الموقع الإلكتروني",
      qrUrlPlaceholder: "https://yourwebsite.com",
      qrSideLabel: "مكان وضع الباركود",
      qrSideNone: "بدون باركود",
      qrSideFront: "على وجه الكرت",
      qrSideBack: "على ظهر الكرت (مستحسن)",
      qrSizeLabel: "حجم الباركود (مربع 1:1)",
      qrQuietZoneLabel: "خلفية بيضاء حول الباركود (Quiet Zone)",
      qrQuietZoneHint: "تضمن سهولة وسرعة مسح الكود حتى فوق الخلفيات الداكنة أو المزدحمة",
      quickAlignLabel: "محاذاة سريعة للمواقع",
      alignBottomRight: "أسفل اليمين",
      alignBottomLeft: "أسفل اليسار",
      alignTopRight: "أعلى اليمين",
      alignCenter: "في المنتصف",
      sectionGuides: "3. خطوط الأمان والطباعة",
      safeZoneLabel: "منطقة الأمان للقص (3 مم - خط متقطع)",
      safeZoneHint: "توضح حدود القطع الآمنة لمنع قص النصوص في المطبعة (تظهر للمعاينة فقط ولا تطبع)",
      centerGuidesLabel: "خطوط منتصف الكرت",
      downloadPdfBtn: "تحميل ملف PDF للطباعة (90×50 مم)",
      downloadPdfHint: "ملف PDF عالي الجودة 300 DPI صفحتين بدون هوامش زائدة، جاهز للمطبعة فوراً",
      exportPngFront: "تصدير الوجه كصورة (300 DPI)",
      exportPngBack: "تصدير الظهر كصورة (300 DPI)",
      loadDemoBtn: "تجربة نموذج جاهز",
      resetBtn: "إعادة ضبط",
      liveCoordsLabel: "موقع الباركود الفعلي",
      printSpecsBadge: "المقاس: 90×50 مم • الدقة: 300 نقطة (1063×591 بكسل) • جاهز للطباعة",
      dragHint: "💡 تلميح: يمكنك سحب كود الـ QR بالماوس أو اللمس وتغيير مكانه بحرية على الكرت!",
      pdfGenerating: "جاري إنشاء ملف الـ PDF بدقة 300 DPI...",
      pdfSuccess: "تم تنزيل ملف الـ PDF بنجاح!",
      demoLoaded: "تم تحميل النموذج التجريبي بنجاح!",
      resetConfirm: "هل أنت متأكد من رغبتك في إعادة ضبط التصميم ومسح التغييرات؟",
      imageLoaded: "تم تحميل الصورة"
    }
  };

  class I18nManager {
    constructor(defaultLang = "en") {
      let saved = null;
      try {
        saved = localStorage.getItem("card_studio_lang");
      } catch (e) {}
      this.currentLang = saved || defaultLang;
    }

    get lang() {
      return this.currentLang;
    }

    t(key) {
      return translations[this.currentLang]?.[key] || translations.en[key] || key;
    }

    setLanguage(lang) {
      if (lang !== "en" && lang !== "ar") return;
      this.currentLang = lang;
      try {
        localStorage.setItem("card_studio_lang", lang);
      } catch (e) {}
      this.applyToDOM();
    }

    toggle() {
      this.setLanguage(this.currentLang === "en" ? "ar" : "en");
    }

    applyToDOM() {
      const isRtl = this.currentLang === "ar";
      document.documentElement.dir = isRtl ? "rtl" : "ltr";
      document.documentElement.lang = this.currentLang;

      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        const text = this.t(key);
        if (text) el.textContent = text;
      });

      document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        const text = this.t(key);
        if (text) el.placeholder = text;
      });

      const langBtn = document.getElementById("lang-toggle-btn");
      if (langBtn) {
        langBtn.innerHTML = isRtl
          ? `<span>English</span> <span class="text-xs opacity-75">🇺🇸</span>`
          : `<span>العربية</span> <span class="text-xs opacity-75">🇸🇦</span>`;
      }
    }
  }

  // ==========================================
  // 7. sample-cards.js (Dynamic Demo Cards)
  // ==========================================
  class SampleCardGenerator {
    static generateDemoCards() {
      const width = 1063;
      const height = 591;

      // Front Canvas
      const fCanvas = document.createElement("canvas");
      fCanvas.width = width;
      fCanvas.height = height;
      const fCtx = fCanvas.getContext("2d");

      const fGrad = fCtx.createLinearGradient(0, 0, width, height);
      fGrad.addColorStop(0, "#090d16");
      fGrad.addColorStop(1, "#111827");
      fCtx.fillStyle = fGrad;
      fCtx.fillRect(0, 0, width, height);

      const circGrad = fCtx.createRadialGradient(width * 0.85, height * 0.2, 10, width * 0.85, height * 0.2, 450);
      circGrad.addColorStop(0, "rgba(56, 189, 248, 0.12)");
      circGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      fCtx.fillStyle = circGrad;
      fCtx.beginPath();
      fCtx.arc(width * 0.85, height * 0.2, 450, 0, Math.PI * 2);
      fCtx.fill();

      fCtx.fillStyle = "#38bdf8";
      fCtx.fillRect(width * 0.08, height * 0.28, 6, height * 0.44);

      fCtx.fillStyle = "#ffffff";
      fCtx.font = "bold 44px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      fCtx.fillText("MOSTAFA ELTAWEEL", width * 0.11, height * 0.38);

      fCtx.fillStyle = "#94a3b8";
      fCtx.font = "500 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      fCtx.fillText("Founder & Lead Software Engineer", width * 0.11, height * 0.45);

      fCtx.fillStyle = "rgba(148, 163, 184, 0.25)";
      fCtx.fillRect(width * 0.11, height * 0.52, width * 0.75, 1);

      fCtx.fillStyle = "#cbd5e1";
      fCtx.font = "400 19px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      fCtx.fillText("✉  contact@eltaweel.dev", width * 0.11, height * 0.62);
      fCtx.fillText("✆  +20 (100) 123-4567", width * 0.11, height * 0.69);
      fCtx.fillText("🌐  www.card-destine.io", width * 0.52, height * 0.62);
      fCtx.fillText("📍  Cairo, Egypt", width * 0.52, height * 0.69);

      // Back Canvas
      const bCanvas = document.createElement("canvas");
      bCanvas.width = width;
      bCanvas.height = height;
      const bCtx = bCanvas.getContext("2d");

      const bGrad = bCtx.createLinearGradient(0, 0, width, height);
      bGrad.addColorStop(0, "#0b0f19");
      bGrad.addColorStop(1, "#131c2e");
      bCtx.fillStyle = bGrad;
      bCtx.fillRect(0, 0, width, height);

      bCtx.save();
      bCtx.translate(width * 0.30, height * 0.48);
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
      bCtx.fillText("DESTINE", 65, 2);

      bCtx.fillStyle = "#38bdf8";
      bCtx.font = "600 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      bCtx.fillText("CARDS & PRINTS", 65, 28);
      bCtx.restore();

      bCtx.fillStyle = "#64748b";
      bCtx.font = "400 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      bCtx.fillText("Precision 300 DPI Engineering • Ready for Press", width * 0.15, height * 0.72);

      const frontDataUrl = fCanvas.toDataURL("image/png");
      const backDataUrl = bCanvas.toDataURL("image/png");

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

  // ==========================================
  // 8. Main App Orchestrator
  // ==========================================
  class App {
    constructor() {
      this.project = new CardProject();
      this.i18n = new I18nManager();

      this.dom = {
        langToggleBtn: document.getElementById("lang-toggle-btn"),
        loadDemoBtn: document.getElementById("load-demo-btn"),
        resetProjectBtn: document.getElementById("reset-project-btn"),
        tabFrontBtn: document.getElementById("tab-front-btn"),
        tabBackBtn: document.getElementById("tab-back-btn"),
        flipViewBtn: document.getElementById("flip-view-btn"),
        frontQrBadge: document.getElementById("front-qr-badge"),
        backQrBadge: document.getElementById("back-qr-badge"),
        stageContainer: document.getElementById("card-stage-container"),
        canvas: document.getElementById("card-preview-canvas"),
        qrDragOverlay: document.getElementById("qr-drag-overlay"),
        liveCoordsText: document.getElementById("live-coords-text"),
        frontDropzone: document.getElementById("front-dropzone"),
        frontFileInput: document.getElementById("front-file-input"),
        frontDropzonePrompt: document.getElementById("front-dropzone-prompt"),
        frontLoadedInfo: document.getElementById("front-loaded-info"),
        frontFileName: document.getElementById("front-file-name"),
        removeFrontBtn: document.getElementById("remove-front-btn"),
        backDropzone: document.getElementById("back-dropzone"),
        backFileInput: document.getElementById("back-file-input"),
        backDropzonePrompt: document.getElementById("back-dropzone-prompt"),
        backLoadedInfo: document.getElementById("back-loaded-info"),
        backFileName: document.getElementById("back-file-name"),
        removeBackBtn: document.getElementById("remove-back-btn"),
        fitModeRadios: document.querySelectorAll('input[name="fit-mode"]'),
        qrUrlInput: document.getElementById("qr-url-input"),
        qrUpdateBtn: document.getElementById("qr-update-btn"),
        qrSideBtns: document.querySelectorAll(".qr-side-btn"),
        qrSizeSlider: document.getElementById("qr-size-slider"),
        qrSizeBadge: document.getElementById("qr-size-badge"),
        qrQuietZoneCheckbox: document.getElementById("qr-quiet-zone-checkbox"),
        qrPresetBtns: document.querySelectorAll("[data-qr-preset]"),
        safeZoneToggle: document.getElementById("safe-zone-toggle"),
        centerGuidesToggle: document.getElementById("center-guides-toggle"),
        downloadPdfBtn: document.getElementById("download-pdf-btn"),
        exportPngFrontBtn: document.getElementById("export-png-front-btn"),
        exportPngBackBtn: document.getElementById("export-png-back-btn"),
        toastModal: document.getElementById("toast-modal"),
        toastSpinner: document.getElementById("toast-spinner"),
        toastMessage: document.getElementById("toast-message")
      };

      this.qrManager = new QRManager(this.project, this.dom.stageContainer);
      this.init();
    }

    async init() {
      this.i18n.applyToDOM();
      this._setupCanvasDimensions();
      this._bindEvents();

      await this.loadDemoTemplate(false);
      await this.render();
      this.updateUI();
    }

    _setupCanvasDimensions() {
      if (this.dom.canvas) {
        this.dom.canvas.width = CanvasRenderer.PRINT_WIDTH_PX;
        this.dom.canvas.height = CanvasRenderer.PRINT_HEIGHT_PX;
      }
    }

    _bindEvents() {
      this.dom.langToggleBtn?.addEventListener("click", () => {
        this.i18n.toggle();
        this.updateUI();
      });

      this.dom.loadDemoBtn?.addEventListener("click", () => this.loadDemoTemplate(true));
      this.dom.resetProjectBtn?.addEventListener("click", () => this.resetProject());

      this.dom.tabFrontBtn?.addEventListener("click", () => this.setActiveSide("front"));
      this.dom.tabBackBtn?.addEventListener("click", () => this.setActiveSide("back"));
      this.dom.flipViewBtn?.addEventListener("click", () => {
        const cur = this.project.getState().settings.activeSide;
        this.setActiveSide(cur === "front" ? "back" : "front");
      });

      window.addEventListener("keydown", (e) => {
        if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
          const cur = this.project.getState().settings.activeSide;
          this.setActiveSide(cur === "front" ? "back" : "front");
        }
      });

      this._setupDropzone(
        this.dom.frontDropzone,
        this.dom.frontFileInput,
        (img, dataUrl, name, size) => this.project.setImage("front", img, dataUrl, name, size)
      );
      this.dom.removeFrontBtn?.addEventListener("click", () => this.project.removeImage("front"));

      this._setupDropzone(
        this.dom.backDropzone,
        this.dom.backFileInput,
        (img, dataUrl, name, size) => this.project.setImage("back", img, dataUrl, name, size)
      );
      this.dom.removeBackBtn?.addEventListener("click", () => this.project.removeImage("back"));

      this.dom.fitModeRadios.forEach((radio) => {
        radio.addEventListener("change", (e) => {
          const mode = e.target.value;
          this.project.setFitMode("front", mode);
          this.project.setFitMode("back", mode);
        });
      });

      const updateQRUrl = () => {
        const url = this.dom.qrUrlInput.value.trim();
        if (url) {
          this.qrManager.invalidateCache();
          this.project.setQRConfig({ url });
          this.showToast("QR Code updated!", 1500);
        }
      };
      this.dom.qrUpdateBtn?.addEventListener("click", updateQRUrl);
      this.dom.qrUrlInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") updateQRUrl();
      });

      this.dom.qrSideBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const side = btn.getAttribute("data-qr-side");
          this.project.setQRConfig({ side, enabled: side !== "none" });
        });
      });

      this.dom.qrSizeSlider?.addEventListener("input", (e) => {
        const sizeMm = Number(e.target.value);
        if (this.dom.qrSizeBadge) this.dom.qrSizeBadge.textContent = `${sizeMm} mm`;
        this.project.setQRConfig({ sizeMm });
      });

      this.dom.qrQuietZoneCheckbox?.addEventListener("change", (e) => {
        this.project.setQRConfig({ quietZone: e.target.checked });
      });

      this.dom.qrPresetBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const preset = btn.getAttribute("data-qr-preset");
          this.project.setQRPresetPosition(preset);
        });
      });

      this.dom.safeZoneToggle?.addEventListener("change", (e) => {
        this.project.setSetting("showSafeZone", e.target.checked);
      });

      this.dom.centerGuidesToggle?.addEventListener("change", (e) => {
        this.project.setSetting("showCenterGuides", e.target.checked);
      });

      this.qrManager.onPositionChange = (coords) => {
        if (this.dom.liveCoordsText) {
          this.dom.liveCoordsText.textContent = `X: ${coords.xMm} mm (${coords.xPercent}%) | Y: ${coords.yMm} mm (${coords.yPercent}%) | Size: ${coords.sizeMm} mm`;
        }
        this._updateQROverlayBox();
      };

      window.addEventListener("resize", () => {
        this._updateQROverlayBox();
      });

      this.project.onStateChange(async () => {
        await this.render();
        this.updateUI();
      });

      this.dom.downloadPdfBtn?.addEventListener("click", () => this.exportPrintPDF());
      this.dom.exportPngFrontBtn?.addEventListener("click", () => PDFExporter.exportPNG(this.project, this.qrManager, "front"));
      this.dom.exportPngBackBtn?.addEventListener("click", () => PDFExporter.exportPNG(this.project, this.qrManager, "back"));
    }

    _setupDropzone(dropzone, fileInput, onImageLoaded) {
      if (!dropzone || !fileInput) return;

      dropzone.addEventListener("click", () => fileInput.click());

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) this._processImageFile(file, onImageLoaded);
      });

      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("drag-over");
      });

      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("drag-over");
      });

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        const file = e.dataTransfer?.files?.[0];
        if (file) this._processImageFile(file, onImageLoaded);
      });
    }

    _processImageFile(file, callback) {
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file (PNG, JPG, or WebP).");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          callback(img, dataUrl, file.name, file.size);
          this.showToast(`${this.i18n.t("imageLoaded")}: ${img.naturalWidth}×${img.naturalHeight}px`, 2000);
        };
        img.onerror = () => {
          alert("Failed to parse image file. Please try another format.");
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }

    async render() {
      const state = this.project.getState();
      const activeSide = state.settings.activeSide;
      const qrCanvas = await this.qrManager.getQRCanvas();

      CanvasRenderer.render(this.dom.canvas, state, activeSide, {
        forExport: false,
        includeSafeZone: state.settings.showSafeZone,
        includeCenterGuides: state.settings.showCenterGuides,
        qrCanvas
      });

      this._updateQROverlayBox();
    }

    _updateQROverlayBox() {
      const state = this.project.getState();
      const overlay = this.dom.qrDragOverlay;
      if (!overlay) return;

      if (!state.qr.enabled || state.qr.side !== state.settings.activeSide) {
        overlay.classList.add("hidden");
        return;
      }

      const box = this.qrManager.getQRBoundingBoxPx();
      if (!box) {
        overlay.classList.add("hidden");
        return;
      }

      overlay.classList.remove("hidden");
      overlay.style.left = `${box.boxX}px`;
      overlay.style.top = `${box.boxY}px`;
      overlay.style.width = `${box.boxWidth}px`;
      overlay.style.height = `${box.boxHeight}px`;

      const coords = this.qrManager.getFormattedCoordinates();
      if (this.dom.liveCoordsText) {
        this.dom.liveCoordsText.textContent = `X: ${coords.xMm} mm (${coords.xPercent}%) | Y: ${coords.yMm} mm (${coords.yPercent}%) | Size: ${coords.sizeMm} mm`;
      }
    }

    updateUI() {
      const state = this.project.getState();
      const activeSide = state.settings.activeSide;

      if (activeSide === "front") {
        this.dom.tabFrontBtn?.classList.remove("text-slate-600", "hover:bg-slate-100");
        this.dom.tabFrontBtn?.classList.add("bg-slate-900", "text-white");
        this.dom.tabBackBtn?.classList.remove("bg-slate-900", "text-white");
        this.dom.tabBackBtn?.classList.add("text-slate-600", "hover:bg-slate-100");
      } else {
        this.dom.tabBackBtn?.classList.remove("text-slate-600", "hover:bg-slate-100");
        this.dom.tabBackBtn?.classList.add("bg-slate-900", "text-white");
        this.dom.tabFrontBtn?.classList.remove("bg-slate-900", "text-white");
        this.dom.tabFrontBtn?.classList.add("text-slate-600", "hover:bg-slate-100");
      }

      const qrSide = state.qr.side;
      const qrEnabled = state.qr.enabled && qrSide !== "none";
      this.dom.frontQrBadge?.classList.toggle("hidden", !(qrEnabled && qrSide === "front"));
      this.dom.backQrBadge?.classList.toggle("hidden", !(qrEnabled && qrSide === "back"));

      const hasFront = !!state.front.dataUrl;
      this.dom.frontDropzonePrompt?.classList.toggle("hidden", hasFront);
      this.dom.frontLoadedInfo?.classList.toggle("hidden", !hasFront);
      this.dom.removeFrontBtn?.classList.toggle("hidden", !hasFront);
      if (hasFront && this.dom.frontFileName) {
        this.dom.frontFileName.textContent = state.front.fileName || "front-card.png";
      }

      const hasBack = !!state.back.dataUrl;
      this.dom.backDropzonePrompt?.classList.toggle("hidden", hasBack);
      this.dom.backLoadedInfo?.classList.toggle("hidden", !hasBack);
      this.dom.removeBackBtn?.classList.toggle("hidden", !hasBack);
      if (hasBack && this.dom.backFileName) {
        this.dom.backFileName.textContent = state.back.fileName || "back-card.png";
      }

      this.dom.qrSideBtns.forEach((btn) => {
        const side = btn.getAttribute("data-qr-side");
        const isActive = (state.qr.side === side) || (!state.qr.enabled && side === "none");
        if (isActive) {
          btn.classList.add("bg-brand-50", "border-brand-500", "text-brand-700");
          btn.classList.remove("bg-white", "border-slate-200", "text-slate-600");
        } else {
          btn.classList.remove("bg-brand-50", "border-brand-500", "text-brand-700");
          btn.classList.add("bg-white", "border-slate-200", "text-slate-600");
        }
      });

      if (this.dom.qrSizeSlider) {
        this.dom.qrSizeSlider.value = state.qr.sizeMm;
        if (this.dom.qrSizeBadge) this.dom.qrSizeBadge.textContent = `${state.qr.sizeMm} mm`;
      }

      if (this.dom.qrQuietZoneCheckbox) {
        this.dom.qrQuietZoneCheckbox.checked = state.qr.quietZone;
      }
      if (this.dom.safeZoneToggle) {
        this.dom.safeZoneToggle.checked = state.settings.showSafeZone;
      }
      if (this.dom.centerGuidesToggle) {
        this.dom.centerGuidesToggle.checked = state.settings.showCenterGuides;
      }
    }

    setActiveSide(side) {
      this.project.setActiveSide(side);
    }

    async loadDemoTemplate(notify = true) {
      const demo = SampleCardGenerator.generateDemoCards();
      const frontImg = await demo.loadFrontImage();
      const backImg = await demo.loadBackImage();

      this.project.setImage("front", frontImg, demo.frontDataUrl, "demo-front-card.png", 145000);
      this.project.setImage("back", backImg, demo.backDataUrl, "demo-back-card.png", 132000);

      this.project.setQRConfig({
        enabled: true,
        side: "back",
        url: "https://card-destine.io",
        sizeMm: 22,
        quietZone: true
      });
      this.project.setQRPresetPosition("bottom-right");
      this.project.setActiveSide("back");

      if (notify) {
        this.showToast(this.i18n.t("demoLoaded"), 2500);
      }
    }

    resetProject() {
      if (confirm(this.i18n.t("resetConfirm"))) {
        this.project.resetToDefaults();
        this.qrManager.invalidateCache();
        this.showToast("Project reset to defaults", 2000);
      }
    }

    async exportPrintPDF() {
      const btn = this.dom.downloadPdfBtn;
      const originalText = btn.innerHTML;

      try {
        btn.disabled = true;
        btn.classList.add("opacity-75", "cursor-wait");

        this.showToast(this.i18n.t("pdfGenerating"), 4000, true);

        await PDFExporter.exportPDF(this.project, this.qrManager, {
          fileName: `BusinessCard-90x50mm-${Date.now()}.pdf`,
          onProgress: (status, percent) => {
            this.showToast(`${status} (${percent}%)`, 2000, true);
          }
        });

        this.showToast(this.i18n.t("pdfSuccess"), 3000, false);
      } catch (err) {
        console.error("[CardStudio] PDF Export error:", err);
        alert(`Export Failed: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.classList.remove("opacity-75", "cursor-wait");
        btn.innerHTML = originalText;
      }
    }

    showToast(message, duration = 2500, showSpinner = false) {
      const modal = this.dom.toastModal;
      const msg = this.dom.toastMessage;
      const spinner = this.dom.toastSpinner;

      if (!modal || !msg) return;

      msg.textContent = message;
      spinner?.classList.toggle("hidden", !showSpinner);

      modal.classList.remove("translate-y-24", "opacity-0", "pointer-events-none");
      modal.classList.add("translate-y-0", "opacity-100");

      if (this._toastTimer) clearTimeout(this._toastTimer);
      if (duration > 0) {
        this._toastTimer = setTimeout(() => {
          modal.classList.add("translate-y-24", "opacity-0", "pointer-events-none");
          modal.classList.remove("translate-y-0", "opacity-100");
        }, duration);
      }
    }
  }

  // Auto-boot on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.cardStudioApp = new App();
    });
  } else {
    window.cardStudioApp = new App();
  }
})();
