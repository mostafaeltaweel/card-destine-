/**
 * CardProject.js
 * State management for Double-Sided Business Card Project (90mm x 50mm).
 * Extensible for V2/V3 features (layers, vCards, local storage, CSV import).
 */

export class CardProject {
  static VERSION = "1.0";
  static DEFAULT_DIMENSIONS = {
    widthMm: 90,
    heightMm: 50,
    dpi: 300,
    get pixelWidth() {
      // 90mm / 25.4 * 300 = 1062.992 => 1063px
      return Math.round((this.widthMm / 25.4) * this.dpi);
    },
    get pixelHeight() {
      // 50mm / 25.4 * 300 = 590.551 => 591px
      return Math.round((this.heightMm / 25.4) * this.dpi);
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

  /**
   * Reset the project state to default clean values.
   * @param {boolean} notify - whether to trigger state change listeners
   */
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
        image: null,      // Image / HTMLImageElement or null
        dataUrl: null,    // base64 data string
        fileName: "",
        fileSize: 0,
        fitMode: "cover", // "cover" | "contain"
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
        side: "back",     // "front" | "back" | "none"
        url: "https://example.com",
        sizeMm: 22,       // 10mm to 35mm
        xPercent: 70,     // Top-left X normalized percentage (0-100)
        yPercent: 50,     // Top-left Y normalized percentage (0-100)
        quietZone: true,  // Clean white padding background
        quietZonePaddingMm: 1.5,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        errorCorrectionLevel: "H" // L, M, Q, H
      },
      settings: {
        showSafeZone: true,
        showCenterGuides: false,
        activeSide: "front" // "front" | "back"
      },
      layers: [] // Extensibility hook for V2 (text items, icons, badges)
    };

    if (notify) {
      this.emit("stateChange", this.state);
      this.emit("reset", this.state);
    }
  }

  /**
   * Event Emitter: subscribe to project events.
   * @param {string} event - event name
   * @param {Function} callback - listener callback
   * @returns {Function} unsubscribe function
   */
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

  /**
   * Helper specifically for state changes.
   */
  onStateChange(callback) {
    return this.subscribe("stateChange", callback);
  }

  /**
   * Emit an event to registered listeners.
   */
  emit(event, data) {
    if (this._listeners.has(event)) {
      for (const listener of this._listeners.get(event)) {
        try {
          listener(data);
        } catch (err) {
          console.error(`[CardProject] Error in listener for event "${event}":`, err);
        }
      }
    }
  }

  /**
   * Return a snapshot copy of current state.
   */
  getState() {
    return this.state;
  }

  /**
   * Update active side preview.
   * @param {"front" | "back"} side
   */
  setActiveSide(side) {
    if (side !== "front" && side !== "back") return;
    if (this.state.settings.activeSide === side) return;
    this.state.settings.activeSide = side;
    this.state.metadata.updatedAt = new Date().toISOString();
    this.emit("stateChange", this.state);
    this.emit("sideChange", side);
  }

  /**
   * Set card image for front or back.
   * @param {"front" | "back"} side
   * @param {HTMLImageElement|null} image
   * @param {string|null} dataUrl
   * @param {string} [fileName=""]
   * @param {number} [fileSize=0]
   */
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

  /**
   * Remove card image for front or back.
   * @param {"front" | "back"} side
   */
  removeImage(side) {
    this.setImage(side, null, null, "", 0);
  }

  /**
   * Set fit mode ("cover" vs "contain")
   * @param {"front" | "back"} side
   * @param {"cover" | "contain"} mode
   */
  setFitMode(side, mode) {
    if (side !== "front" && side !== "back") return;
    if (mode !== "cover" && mode !== "contain") return;

    this.state[side].fitMode = mode;
    this.state.metadata.updatedAt = new Date().toISOString();
    this.emit("stateChange", this.state);
  }

  /**
   * Set background color for contain mode.
   * @param {"front" | "back"} side
   * @param {string} color
   */
  setBgColor(side, color) {
    if (side !== "front" && side !== "back") return;
    this.state[side].bgColor = color;
    this.state.metadata.updatedAt = new Date().toISOString();
    this.emit("stateChange", this.state);
  }

  /**
   * Update QR configuration.
   * @param {Partial<typeof this.state.qr>} updates
   */
  setQRConfig(updates) {
    Object.assign(this.state.qr, updates);

    // Validate & clamp
    this.state.qr.sizeMm = Math.max(10, Math.min(35, Number(this.state.qr.sizeMm) || 20));
    this.clampQRCoordinates();

    this.state.metadata.updatedAt = new Date().toISOString();
    this.emit("stateChange", this.state);
    this.emit("qrChange", this.state.qr);
  }

  /**
   * Set QR position using normalized percentages (0-100%).
   * Automatically clamps so QR stays within card boundary.
   * @param {number} xPercent - normalized 0-100% of card width
   * @param {number} yPercent - normalized 0-100% of card height
   */
  setQRPosition(xPercent, yPercent) {
    this.state.qr.xPercent = xPercent;
    this.state.qr.yPercent = yPercent;
    this.clampQRCoordinates();

    this.state.metadata.updatedAt = new Date().toISOString();
    this.emit("stateChange", this.state);
    this.emit("qrMove", { xPercent: this.state.qr.xPercent, yPercent: this.state.qr.yPercent });
  }

  /**
   * Clamp QR normalized coordinates so it cannot be placed outside the card canvas.
   */
  clampQRCoordinates() {
    const cardWidthMm = this.state.dimensions.widthMm;
    const cardHeightMm = this.state.dimensions.heightMm;
    const qrSizeMm = this.state.qr.sizeMm;

    // Convert QR size to percentage of card width and height
    const sizePercentX = (qrSizeMm / cardWidthMm) * 100;
    const sizePercentY = (qrSizeMm / cardHeightMm) * 100;

    const maxX = Math.max(0, 100 - sizePercentX);
    const maxY = Math.max(0, 100 - sizePercentY);

    this.state.qr.xPercent = Math.max(0, Math.min(maxX, this.state.qr.xPercent));
    this.state.qr.yPercent = Math.max(0, Math.min(maxY, this.state.qr.yPercent));
  }

  /**
   * Quick alignment presets for QR code.
   * @param {"bottom-right" | "bottom-left" | "top-right" | "top-left" | "center"} preset
   */
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

  /**
   * Toggle or set general settings.
   * @param {string} key
   * @param {*} value
   */
  setSetting(key, value) {
    this.state.settings[key] = value;
    this.emit("stateChange", this.state);
  }

  /**
   * Serialize state into clean JSON for export or persistence.
   * Omits DOM HTMLImageElements and keeps clean dataUrls.
   */
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

  /**
   * Restore state from JSON string or object.
   * Rehydrates HTMLImageElements asynchronously.
   * @param {string|object} json
   * @param {boolean} notify
   * @returns {Promise<void>}
   */
  async fromJSON(json, notify = true) {
    const data = typeof json === "string" ? JSON.parse(json) : json;

    if (!data || typeof data !== "object") {
      throw new Error("Invalid project JSON data");
    }

    this.state.version = data.version || CardProject.VERSION;
    this.state.metadata = data.metadata || this.state.metadata;
    this.state.dimensions = { ...this.state.dimensions, ...(data.dimensions || {}) };

    // Front image rehydration
    if (data.front) {
      this.state.front.fileName = data.front.fileName || "";
      this.state.front.fitMode = data.front.fitMode || "cover";
      this.state.front.bgColor = data.front.bgColor || "#ffffff";
      this.state.front.dataUrl = data.front.dataUrl || null;

      if (data.front.dataUrl) {
        this.state.front.image = await this._loadImage(data.front.dataUrl);
      } else {
        this.state.front.image = null;
      }
    }

    // Back image rehydration
    if (data.back) {
      this.state.back.fileName = data.back.fileName || "";
      this.state.back.fitMode = data.back.fitMode || "cover";
      this.state.back.bgColor = data.back.bgColor || "#ffffff";
      this.state.back.dataUrl = data.back.dataUrl || null;

      if (data.back.dataUrl) {
        this.state.back.image = await this._loadImage(data.back.dataUrl);
      } else {
        this.state.back.image = null;
      }
    }

    if (data.qr) {
      this.state.qr = { ...this.state.qr, ...data.qr };
      this.clampQRCoordinates();
    }

    if (data.settings) {
      this.state.settings = { ...this.state.settings, ...data.settings };
    }

    if (Array.isArray(data.layers)) {
      this.state.layers = data.layers;
    }

    if (notify) {
      this.emit("stateChange", this.state);
      this.emit("loaded", this.state);
    }
  }

  /**
   * Helper to load an image from dataUrl into an HTMLImageElement.
   */
  _loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      if (typeof Image === "undefined") {
        // Node / non-browser environment
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error("Failed to load image data URL"));
      img.src = dataUrl;
    });
  }
}
