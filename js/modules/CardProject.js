/**
 * CardProject.js
 * State management for Double-Sided Business Card Project (90mm x 50mm).
 * Now supports Pan & Zoom, Auto Edge Color detection, and ISO QR standards.
 */

export class CardProject {
  static VERSION = "1.1";
  static DEFAULT_DIMENSIONS = {
    widthMm: 90,
    heightMm: 50,
    dpi: 300,
    get pixelWidth() {
      return Math.round((this.widthMm / 25.4) * this.dpi); // 1063px
    },
    get pixelHeight() {
      return Math.round((this.heightMm / 25.4) * this.dpi); // 591px
    },
    get aspectRatio() {
      return this.widthMm / this.heightMm; // 1.8
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
        fitMode: "contain", // default to contain/safe fit so no text is cut
        zoom: 1.0,          // 0.5 to 2.5
        panX: 0,            // -50% to +50%
        panY: 0,            // -50% to +50%
        bgColor: "#ffffff"
      },
      back: {
        image: null,
        dataUrl: null,
        fileName: "",
        fileSize: 0,
        fitMode: "contain",
        zoom: 1.0,
        panX: 0,
        panY: 0,
        bgColor: "#ffffff"
      },
      qr: {
        enabled: true,
        side: "back",
        url: "https://8ace7cea.job-fair-portfolio.pages.dev",
        sizeMm: 22,
        xPercent: 70,
        yPercent: 50,
        quietZone: true,
        quietZonePaddingMm: 1.5,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        errorCorrectionLevel: "M"
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

  /**
   * Automatically sample image border pixels to find dominant edge color.
   */
  static detectEdgeColor(image) {
    if (!image || !image.naturalWidth || !image.naturalHeight || typeof document === "undefined") {
      return "#ffffff";
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(64, image.naturalWidth);
      canvas.height = Math.min(64, image.naturalHeight);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let r = 0, g = 0, b = 0, count = 0;
      // Top and bottom edges
      for (let x = 0; x < canvas.width; x += 2) {
        let idx = (0 * canvas.width + x) * 4;
        r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; count++;
        idx = ((canvas.height - 1) * canvas.width + x) * 4;
        r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; count++;
      }
      // Left and right edges
      for (let y = 0; y < canvas.height; y += 2) {
        let idx = (y * canvas.width + 0) * 4;
        r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; count++;
        idx = (y * canvas.width + (canvas.width - 1)) * 4;
        r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; count++;
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) {
      return "#ffffff";
    }
  }

  setImage(side, image, dataUrl, fileName = "", fileSize = 0) {
    if (side !== "front" && side !== "back") return;

    this.state[side].image = image;
    this.state[side].dataUrl = dataUrl;
    this.state[side].fileName = fileName;
    this.state[side].fileSize = fileSize;

    // Reset pan & zoom defaults for fresh image
    this.state[side].zoom = 1.0;
    this.state[side].panX = 0;
    this.state[side].panY = 0;

    // Detect and set edge color automatically
    if (image) {
      const detectedColor = CardProject.detectEdgeColor(image);
      this.state[side].bgColor = detectedColor;
    }

    this.state.metadata.updatedAt = new Date().toISOString();
    this.emit("stateChange", this.state);
    this.emit("imageChange", { side, hasImage: !!dataUrl, fileName });
  }

  removeImage(side) {
    if (side !== "front" && side !== "back") return;
    this.state[side].image = null;
    this.state[side].dataUrl = null;
    this.state[side].fileName = "";
    this.state[side].fileSize = 0;
    this.state[side].zoom = 1.0;
    this.state[side].panX = 0;
    this.state[side].panY = 0;
    this.state.metadata.updatedAt = new Date().toISOString();
    this.emit("stateChange", this.state);
  }

  setImageTransform(side, { zoom, panX, panY, fitMode, bgColor }) {
    if (side !== "front" && side !== "back") return;

    if (zoom !== undefined) this.state[side].zoom = Math.max(0.4, Math.min(2.5, Number(zoom) || 1.0));
    if (panX !== undefined) this.state[side].panX = Math.max(-50, Math.min(50, Number(panX) || 0));
    if (panY !== undefined) this.state[side].panY = Math.max(-50, Math.min(50, Number(panY) || 0));
    if (fitMode !== undefined) this.state[side].fitMode = fitMode;
    if (bgColor !== undefined) this.state[side].bgColor = bgColor;

    this.state.metadata.updatedAt = new Date().toISOString();
    this.emit("stateChange", this.state);
  }

  setFitMode(side, mode) {
    if (side !== "front" && side !== "back") return;
    this.state[side].fitMode = mode;
    this.state.metadata.updatedAt = new Date().toISOString();
    this.emit("stateChange", this.state);
  }

  setBgColor(side, color) {
    if (side !== "front" && side !== "back") return;
    this.state[side].bgColor = color;
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
        zoom: this.state.front.zoom,
        panX: this.state.front.panX,
        panY: this.state.front.panY,
        bgColor: this.state.front.bgColor
      },
      back: {
        dataUrl: this.state.back.dataUrl,
        fileName: this.state.back.fileName,
        fitMode: this.state.back.fitMode,
        zoom: this.state.back.zoom,
        panX: this.state.back.panX,
        panY: this.state.back.panY,
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
      if (typeof Image === "undefined") {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }
}
