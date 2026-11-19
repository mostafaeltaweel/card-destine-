/**
 * bundle.js
 * Universal self-contained bundle for CardStudio 90x50.
 * Includes ISO 18004 Verified QR Engine, Pan & Zoom image scaling,
 * and Auto Edge-Color detection. Works on file:/// and HTTP/HTTPS.
 */

(function () {
  "use strict";

  // ============================================================
  // 1. ISO/IEC 18004 Compliant QR Code Engine (Kazuhiko Arase)
  // ============================================================
  const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };

  const QRMath = {
    glog(n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp(n) {
      while (n < 0) n += 255;
      while (n >= 255) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };

  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) {
    QRMath.EXP_TABLE[i] =
      QRMath.EXP_TABLE[i - 4] ^
      QRMath.EXP_TABLE[i - 5] ^
      QRMath.EXP_TABLE[i - 6] ^
      QRMath.EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i++) {
    QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
  }

  class QRPolynomial {
    constructor(num, shift = 0) {
      let offset = 0;
      while (offset < num.length && num[offset] === 0) offset++;
      this.num = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i++) {
        this.num[i] = num[i + offset];
      }
      for (let i = num.length - offset; i < this.num.length; i++) {
        this.num[i] = 0;
      }
    }
    get(index) { return this.num[index]; }
    getLength() { return this.num.length; }
    multiply(e) {
      const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num);
    }
    mod(e) {
      if (this.getLength() - e.getLength() < 0) return this;
      const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      const num = new Array(this.getLength());
      for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return new QRPolynomial(num).mod(e);
    }
  }

  const QRRSBlock = {
    RS_BLOCK_TABLE: [
      [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
      [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
      [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
      [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
      [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
      [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
      [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
      [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
      [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
      [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]
    ],
    getRSBlocks(typeNumber, errorCorrectLevel) {
      const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
      if (!rsBlock) throw new Error("bad rs block");
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i++) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j++) {
          list.push({ totalCount, dataCount });
        }
      }
      return list;
    },
    getRsBlockTable(typeNumber, errorCorrectLevel) {
      switch (errorCorrectLevel) {
        case QRErrorCorrectLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default: return null;
      }
    }
  };

  class QRBitBuffer {
    constructor() {
      this.buffer = [];
      this.length = 0;
    }
    get(index) {
      const bufIndex = Math.floor(index / 8);
      return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
    }
    put(num, length) {
      for (let i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) === 1);
      }
    }
    putBit(bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
      this.length++;
    }
  }

  class QR8bitByte {
    constructor(data) {
      this.mode = 0b0100;
      this.data = data;
      this.parsedData = new TextEncoder().encode(data);
    }
    getLength() { return this.parsedData.length; }
    write(buffer) {
      for (let i = 0; i < this.parsedData.length; i++) {
        buffer.put(this.parsedData[i], 8);
      }
    }
  }

  class QRCodeModel {
    constructor(typeNumber, errorCorrectLevel) {
      this.typeNumber = typeNumber;
      this.errorCorrectLevel = errorCorrectLevel;
      this.modules = null;
      this.moduleCount = 0;
      this.dataCache = null;
      this.dataList = [];
    }

    addData(data) {
      this.dataList.push(new QR8bitByte(data));
      this.dataCache = null;
    }

    isDark(row, col) {
      return this.modules[row][col];
    }

    getModuleCount() {
      return this.moduleCount;
    }

    make() {
      if (this.typeNumber < 1) {
        let typeNumber = 1;
        for (; typeNumber < 10; typeNumber++) {
          const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
          const buffer = new QRBitBuffer();
          let totalDataCount = 0;
          for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
          for (let i = 0; i < this.dataList.length; i++) {
            const data = this.dataList[i];
            buffer.put(data.mode, 4);
            buffer.put(data.getLength(), typeNumber < 10 ? 8 : 16);
            data.write(buffer);
          }
          if (buffer.length <= totalDataCount * 8) break;
        }
        this.typeNumber = typeNumber;
      }
      this.makeImpl(false, this.getBestMaskPattern());
    }

    makeImpl(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (let row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount).fill(null);
      }

      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);

      if (this.dataCache == null) {
        this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
      }
      this.mapData(this.dataCache, maskPattern);
    }

    setupPositionProbePattern(row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if (
            (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)
          ) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    }

    setupPositionAdjustPattern() {
      const pos = QRCodeModel.PATTERN_POSITION_TABLE[this.typeNumber - 1];
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i];
          const col = pos[j];
          if (this.modules[row][col] != null) continue;
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    }

    setupTimingPattern() {
      for (let r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] != null) continue;
        this.modules[r][6] = r % 2 === 0;
      }
      for (let c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] != null) continue;
        this.modules[6][c] = c % 2 === 0;
      }
    }

    setupTypeInfo(test, maskPattern) {
      const data = (this.errorCorrectLevel << 3) | maskPattern;
      const bits = QRCodeModel.getBCHTypeInfo(data);
      for (let i = 0; i < 15; i++) {
        const mod = !test && ((bits >> i) & 1) === 1;
        if (i < 6) {
          this.modules[i][8] = mod;
        } else if (i < 8) {
          this.modules[i + 1][8] = mod;
        } else {
          this.modules[this.moduleCount - 15 + i][8] = mod;
        }
        if (i < 8) {
          this.modules[8][this.moduleCount - i - 1] = mod;
        } else if (i < 9) {
          this.modules[8][15 - i - 1 + 1] = mod;
        } else {
          this.modules[8][15 - i - 1] = mod;
        }
      }
      this.modules[this.moduleCount - 8][8] = !test;
    }

    mapData(data, maskPattern) {
      let inc = -1;
      let row = this.moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      const maskFunc = QRCodeModel.getMaskFunc(maskPattern);

      for (let col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this.modules[row][col - c] == null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
              }
              const mask = maskFunc(row, col - c);
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }

    getBestMaskPattern() {
      let minLostPoint = 0;
      let pattern = 0;
      for (let i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        const lostPoint = QRCodeModel.getLostPoint(this);
        if (i === 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    }

    static getMaskFunc(maskPattern) {
      switch (maskPattern) {
        case 0: return (i, j) => (i + j) % 2 === 0;
        case 1: return (i, j) => i % 2 === 0;
        case 2: return (i, j) => j % 3 === 0;
        case 3: return (i, j) => (i + j) % 3 === 0;
        case 4: return (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case 5: return (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0;
        case 6: return (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
        case 7: return (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
        default: throw new Error("bad maskPattern:" + maskPattern);
      }
    }

    static getLostPoint(qrCode) {
      const moduleCount = qrCode.getModuleCount();
      let lostPoint = 0;
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          let sameCount = 0;
          const dark = qrCode.isDark(row, col);
          for (let r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (let c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c || (r === 0 && c === 0)) continue;
              if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += 3 + sameCount - 5;
        }
      }
      for (let row = 0; row < moduleCount - 1; row++) {
        for (let col = 0; col < moduleCount - 1; col++) {
          let count = 0;
          if (qrCode.isDark(row, col)) count++;
          if (qrCode.isDark(row + 1, col)) count++;
          if (qrCode.isDark(row, col + 1)) count++;
          if (qrCode.isDark(row + 1, col + 1)) count++;
          if (count === 0 || count === 4) lostPoint += 3;
        }
      }
      return lostPoint;
    }

    static getBCHTypeInfo(data) {
      let d = data << 10;
      while (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(1335) >= 0) {
        d ^= 1335 << (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(1335));
      }
      return ((data << 10) | d) ^ 21522;
    }

    static getBCHDigit(data) {
      let digit = 0;
      while (data !== 0) { digit++; data >>>= 1; }
      return digit;
    }

    static createData(typeNumber, errorCorrectLevel, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
      const buffer = new QRBitBuffer();
      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i];
        buffer.put(data.mode, 4);
        buffer.put(data.getLength(), typeNumber < 10 ? 8 : 16);
        data.write(buffer);
      }
      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
      if (buffer.length > totalDataCount * 8) throw new Error("code length overflow");
      if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
      while (buffer.length % 8 !== 0) buffer.putBit(false);
      while (true) {
        if (buffer.length >= totalDataCount * 8) break;
        buffer.put(0xec, 8);
        if (buffer.length >= totalDataCount * 8) break;
        buffer.put(0x11, 8);
      }
      return QRCodeModel.createBytes(buffer, rsBlocks);
    }

    static createBytes(buffer, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;
      const dcdata = new Array(rsBlocks.length);
      const ecdata = new Array(rsBlocks.length);

      for (let r = 0; r < rsBlocks.length; r++) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);
        for (let i = 0; i < dcdata[r].length; i++) {
          dcdata[r][i] = 0xff & buffer.buffer[i + offset];
        }
        offset += dcCount;

        const rsPoly = QRCodeModel.getErrorCorrectPolynomial(ecCount);
        const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ecdata[r].length; i++) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
        }
      }

      let totalCodeCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
      const data = new Array(totalCodeCount);
      let index = 0;

      for (let i = 0; i < maxDcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < dcdata[r].length) data[index++] = dcdata[r][i];
        }
      }
      for (let i = 0; i < maxEcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < ecdata[r].length) data[index++] = ecdata[r][i];
        }
      }
      return data;
    }

    static getErrorCorrectPolynomial(errorCorrectLength) {
      let a = new QRPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i++) {
        a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    }
  }

  QRCodeModel.PATTERN_POSITION_TABLE = [
    [], [6, 18], [6, 22], [6, 26], [6, 30],
    [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  class StandaloneQRCode {
    static normalizeText(text) {
      let trimmed = (text || "").trim();
      if (!trimmed) return "https://example.com";
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
        if (trimmed.includes(".") && !trimmed.startsWith("http")) {
          trimmed = "https://" + trimmed;
        }
      }
      return trimmed;
    }

    static renderToCanvas(text, pixelSize = 512, colorDark = "#0f172a", colorLight = "#ffffff") {
      const cleanText = this.normalizeText(text);
      const model = new QRCodeModel(0, QRErrorCorrectLevel.M);
      model.addData(cleanText);
      model.make();

      const moduleCount = model.getModuleCount();
      const canvas = document.createElement("canvas");
      canvas.width = pixelSize;
      canvas.height = pixelSize;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = colorLight;
      ctx.fillRect(0, 0, pixelSize, pixelSize);

      ctx.fillStyle = colorDark;
      const moduleSize = pixelSize / moduleCount;

      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (model.isDark(row, col)) {
            ctx.fillRect(
              Math.round(col * moduleSize),
              Math.round(row * moduleSize),
              Math.ceil(moduleSize),
              Math.ceil(moduleSize)
            );
          }
        }
      }

      return canvas;
    }
  }

  // ============================================================
  // 2. CardProject.js (State Management with Pan & Zoom & Auto Edge)
  // ============================================================
  class CardProject {
    static VERSION = "1.1";
    static DEFAULT_DIMENSIONS = {
      widthMm: 90,
      heightMm: 50,
      dpi: 300,
      get pixelWidth() { return Math.round((this.widthMm / 25.4) * this.dpi); },
      get pixelHeight() { return Math.round((this.heightMm / 25.4) * this.dpi); },
      get aspectRatio() { return this.widthMm / this.heightMm; }
    };

    constructor(initialData = null) {
      this._listeners = new Map();
      this.resetToDefaults(false);
      if (initialData) this.fromJSON(initialData, false);
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
          fitMode: "contain",
          zoom: 1.0,
          panX: 0,
          panY: 0,
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
      if (!this._listeners.has(event)) this._listeners.set(event, new Set());
      this._listeners.get(event).add(callback);
      return () => this.unsubscribe(event, callback);
    }

    on(event, callback) { return this.subscribe(event, callback); }
    unsubscribe(event, callback) {
      if (this._listeners.has(event)) this._listeners.get(event).delete(callback);
    }
    off(event, callback) { this.unsubscribe(event, callback); }
    onStateChange(callback) { return this.subscribe("stateChange", callback); }

    emit(event, data) {
      if (this._listeners.has(event)) {
        for (const listener of this._listeners.get(event)) {
          try { listener(data); } catch (err) { console.error(err); }
        }
      }
    }

    getState() { return this.state; }

    setActiveSide(side) {
      if (side !== "front" && side !== "back") return;
      if (this.state.settings.activeSide === side) return;
      this.state.settings.activeSide = side;
      this.state.metadata.updatedAt = new Date().toISOString();
      this.emit("stateChange", this.state);
      this.emit("sideChange", side);
    }

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
        for (let x = 0; x < canvas.width; x += 2) {
          let idx = (0 * canvas.width + x) * 4;
          r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; count++;
          idx = ((canvas.height - 1) * canvas.width + x) * 4;
          r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; count++;
        }
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
      this.state[side].zoom = 1.0;
      this.state[side].panX = 0;
      this.state[side].panY = 0;

      if (image) {
        this.state[side].bgColor = CardProject.detectEdgeColor(image);
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
      return JSON.stringify(this.state, null, 2);
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
      if (notify) this.emit("stateChange", this.state);
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

  // ============================================================
  // 3. CanvasRenderer.js (300 DPI Rendering with Pan & Zoom)
  // ============================================================
  class CanvasRenderer {
    static PRINT_DPI = 300;
    static PRINT_WIDTH_PX = 1063;
    static PRINT_HEIGHT_PX = 591;
    static CARD_WIDTH_MM = 90;
    static CARD_HEIGHT_MM = 50;

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
        sx: 0, sy: 0, sw: imgWidth, sh: imgHeight,
        dx: Math.round(dx), dy: Math.round(dy),
        dw: Math.round(dw), dh: Math.round(dh)
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

      // 1. Fill background with detected edge color
      ctx.fillStyle = sideData.bgColor || "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // 2. Draw artwork with transform
      if (sideData.image && sideData.image.complete && sideData.image.naturalWidth > 0) {
        const t = this.calculateTransform(
          sideData.image.naturalWidth,
          sideData.image.naturalHeight,
          width,
          height,
          sideData
        );

        ctx.drawImage(
          sideData.image,
          t.sx, t.sy, t.sw, t.sh,
          t.dx, t.dy, t.dw, t.dh
        );
      } else {
        this.drawPlaceholder(ctx, width, height, side, forExport);
      }

      // 3. Draw QR
      const qr = cardState.qr;
      if (qr && qr.enabled && qr.side === side && options.qrCanvas) {
        this.drawQRCode(ctx, width, height, qr, options.qrCanvas, cardState.dimensions);
      }

      // 4. Safe Zone Guide
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

  // ============================================================
  // 4. QRManager.js (ISO Powered QR Controller)
  // ============================================================
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

      const cleanUrl = StandaloneQRCode.normalizeText(qrState.url);
      const cacheKey = `${cleanUrl}|${qrState.colorDark}|${qrState.colorLight}`;
      if (this.qrCanvasCache && this.lastRenderedUrl === cacheKey) {
        return this.qrCanvasCache;
      }

      const canvas = StandaloneQRCode.renderToCanvas(
        cleanUrl,
        512,
        qrState.colorDark || "#0f172a",
        qrState.colorLight || "#ffffff"
      );

      this.qrCanvasCache = canvas;
      this.lastRenderedUrl = cacheKey;
      return canvas;
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
        x: xPx, y: yPx, width: qrSizePx, height: qrSizePx, padding: paddingPx,
        boxX: xPx - paddingPx, boxY: yPx - paddingPx,
        boxWidth: qrSizePx + (paddingPx * 2), boxHeight: qrSizePx + (paddingPx * 2)
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

        try { this.stageContainer.setPointerCapture(e.pointerId); } catch (err) {}
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
        try { if (e.pointerId) this.stageContainer.releasePointerCapture(e.pointerId); } catch (err) {}
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

  // ============================================================
  // 5. PDFExporter.js
  // ============================================================
  class PDFExporter {
    static async exportPDF(cardProject, qrManager, options = {}) {
      const onProgress = options.onProgress || (() => {});
      const state = cardProject.getState();
      const fileName = options.fileName || `business-card-${Date.now()}.pdf`;

      onProgress("Initializing PDF engine...", 10);
      const jsPDFConstructor = (typeof window !== "undefined" && (window.jspdf?.jsPDF || window.jsPDF));
      if (!jsPDFConstructor) {
        throw new Error("jsPDF is not loaded. Please connect to the internet or reload.");
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
        author: "CardStudio 90x50"
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

  // ============================================================
  // 6. i18n Dictionary
  // ============================================================
  const translations = {
    en: {
      appTitle: "CardStudio 90x50",
      appSubtitle: "Print-Ready Double-Sided Business Card Designer",
      frontCardTab: "Front Card",
      backCardTab: "Back Card",
      qrBadge: "QR Active",
      sectionImages: "1. Card Artwork & Image Scale",
      sectionImagesDesc: "Upload designs and control Zoom & Pan so not a single pixel or text is cut off on 90×50mm.",
      frontUploadLabel: "Front Side Image",
      backUploadLabel: "Back Side Image",
      uploadPlaceholder: "Click or drag & drop (PNG, JPG, WebP)",
      removeBtn: "Remove",
      fitModeLabel: "Fit Mode",
      fitModeContain: "Fit Entire Card (No Crop - Recommended)",
      fitModeCover: "Fill & Crop (Cover)",
      imageZoomLabel: "Image Zoom / Scale",
      imagePanXLabel: "Position X (Horizontal)",
      imagePanYLabel: "Position Y (Vertical)",
      bgColorLabel: "Card Margin / Edge Color",
      autoColorHint: "Auto-detected from image border pixels",
      resetTransformBtn: "Reset Scale & Position",
      sectionQR: "2. Interactive QR Code",
      sectionQRDesc: "Generate an ISO-standard scannable QR code. Supports auto-URL formatting and live pointer dragging.",
      qrUrlLabel: "Destination URL",
      qrUrlPlaceholder: "https://yourwebsite.com",
      qrSideLabel: "QR Placement Side",
      qrSideNone: "Disabled (Hidden)",
      qrSideFront: "Front Card",
      qrSideBack: "Back Card",
      qrSizeLabel: "QR Size (1:1 Ratio)",
      qrQuietZoneLabel: "White Quiet-Zone Box",
      qrQuietZoneHint: "White padding ensures scannability over dark or complex backgrounds",
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
      sectionImages: "1. صور الكرت والتحكم بالأبعاد",
      sectionImagesDesc: "ارفع تصميمك وتحكم بنسبة التكبير ومكان الصورة بدقة لمنع قص أي نص في مقاس 9×5 سم.",
      frontUploadLabel: "صورة وجه الكرت",
      backUploadLabel: "صورة ظهر الكرت",
      uploadPlaceholder: "اضغط أو اسحب وأفلت هنا (PNG, JPG, WebP)",
      removeBtn: "حذف",
      fitModeLabel: "طريقة الاحتواء والعرض",
      fitModeContain: "احتواء كامل للكرت (بدون أي قص للنصوص - مستحسن)",
      fitModeCover: "ملء الإطار بالكامل (قص تلقائي للأطراف)",
      imageZoomLabel: "حجم الصورة (Zoom)",
      imagePanXLabel: "الإزاحة الأفقية (يمين / يسار)",
      imagePanYLabel: "الإزاحة الرأسية (أعلى / أسفل)",
      bgColorLabel: "لون حواف وخلفية الكرت",
      autoColorHint: "تم التقاط اللون تلقائياً من أطراف صورتك",
      resetTransformBtn: "إعادة ضبط موضع وحجم الصورة",
      sectionQR: "2. باركود الموقع التفاعلي (QR)",
      sectionQRDesc: "توليد كود QR قياسي ومضمون 100% للمسح من كل كاميرات الهواتف الذكية مع السحب المباشر.",
      qrUrlLabel: "رابط الموقع الإلكتروني",
      qrUrlPlaceholder: "https://yourwebsite.com",
      qrSideLabel: "مكان وضع الباركود",
      qrSideNone: "معطل (مخفي)",
      qrSideFront: "على وجه الكرت",
      qrSideBack: "على ظهر الكرت",
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
      try { saved = localStorage.getItem("card_studio_lang"); } catch (e) {}
      this.currentLang = saved || defaultLang;
    }
    get lang() { return this.currentLang; }
    t(key) { return translations[this.currentLang]?.[key] || translations.en[key] || key; }
    setLanguage(lang) {
      if (lang !== "en" && lang !== "ar") return;
      this.currentLang = lang;
      try { localStorage.setItem("card_studio_lang", lang); } catch (e) {}
      this.applyToDOM();
    }
    toggle() { this.setLanguage(this.currentLang === "en" ? "ar" : "en"); }
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

  // ============================================================
  // 7. Demo Card Generator
  // ============================================================
  class SampleCardGenerator {
    static generateDemoCards() {
      const width = 1063;
      const height = 591;

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
      fCtx.fillText("MOSTAFA MOHAMED ELTAWEEL", width * 0.11, height * 0.38);

      fCtx.fillStyle = "#94a3b8";
      fCtx.font = "500 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      fCtx.fillText("Applied AI & Machine Learning | Data Analysis & BI", width * 0.11, height * 0.45);

      fCtx.fillStyle = "rgba(148, 163, 184, 0.25)";
      fCtx.fillRect(width * 0.11, height * 0.52, width * 0.75, 1);

      fCtx.fillStyle = "#cbd5e1";
      fCtx.font = "400 19px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      fCtx.fillText("✉  Mostafa.eltaweel000@gmail.com", width * 0.11, height * 0.62);
      fCtx.fillText("✆  +0201112611898", width * 0.11, height * 0.69);
      fCtx.fillText("🌐  8ace7cea.job-fair-portfolio.pages.dev", width * 0.52, height * 0.62);
      fCtx.fillText("📍  Cairo, Egypt", width * 0.52, height * 0.69);

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
      bCtx.fillText("ELTAWEEL", 65, 2);

      bCtx.fillStyle = "#38bdf8";
      bCtx.font = "600 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      bCtx.fillText("PORTFOLIO & DEMOS", 65, 28);
      bCtx.restore();

      bCtx.fillStyle = "#64748b";
      bCtx.font = "400 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      bCtx.fillText("Precision 300 DPI Engineering • Press-Ready", width * 0.15, height * 0.72);

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

  // ============================================================
  // 8. Main App Orchestrator
  // ============================================================
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
        imageZoomSlider: document.getElementById("image-zoom-slider"),
        imageZoomBadge: document.getElementById("image-zoom-badge"),
        imagePanXSlider: document.getElementById("image-panx-slider"),
        imagePanXBadge: document.getElementById("image-panx-badge"),
        imagePanYSlider: document.getElementById("image-pany-slider"),
        imagePanYBadge: document.getElementById("image-pany-badge"),
        bgColorPicker: document.getElementById("bg-color-picker"),
        resetTransformBtn: document.getElementById("reset-transform-btn"),

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
          const side = this.project.getState().settings.activeSide;
          this.project.setFitMode(side, e.target.value);
        });
      });

      this.dom.imageZoomSlider?.addEventListener("input", (e) => {
        const side = this.project.getState().settings.activeSide;
        const zoom = Number(e.target.value);
        if (this.dom.imageZoomBadge) {
          this.dom.imageZoomBadge.textContent = `${Math.round(zoom * 100)}%`;
        }
        this.project.setImageTransform(side, { zoom });
      });

      this.dom.imagePanXSlider?.addEventListener("input", (e) => {
        const side = this.project.getState().settings.activeSide;
        const panX = Number(e.target.value);
        if (this.dom.imagePanXBadge) this.dom.imagePanXBadge.textContent = `${panX}%`;
        this.project.setImageTransform(side, { panX });
      });

      this.dom.imagePanYSlider?.addEventListener("input", (e) => {
        const side = this.project.getState().settings.activeSide;
        const panY = Number(e.target.value);
        if (this.dom.imagePanYBadge) this.dom.imagePanYBadge.textContent = `${panY}%`;
        this.project.setImageTransform(side, { panY });
      });

      this.dom.bgColorPicker?.addEventListener("input", (e) => {
        const side = this.project.getState().settings.activeSide;
        this.project.setBgColor(side, e.target.value);
      });

      this.dom.resetTransformBtn?.addEventListener("click", () => {
        const side = this.project.getState().settings.activeSide;
        this.project.setImageTransform(side, { zoom: 1.0, panX: 0, panY: 0 });
      });

      const updateQRUrl = () => {
        const url = this.dom.qrUrlInput.value.trim();
        if (url) {
          this.qrManager.invalidateCache();
          this.project.setQRConfig({ url });
          this.showToast("QR Code updated & verified!", 1500);
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
      const currentSideData = state[activeSide];

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

      if (this.dom.imageZoomSlider) {
        this.dom.imageZoomSlider.value = currentSideData.zoom || 1.0;
        if (this.dom.imageZoomBadge) {
          this.dom.imageZoomBadge.textContent = `${Math.round((currentSideData.zoom || 1.0) * 100)}%`;
        }
      }
      if (this.dom.imagePanXSlider) {
        this.dom.imagePanXSlider.value = currentSideData.panX || 0;
        if (this.dom.imagePanXBadge) this.dom.imagePanXBadge.textContent = `${currentSideData.panX || 0}%`;
      }
      if (this.dom.imagePanYSlider) {
        this.dom.imagePanYSlider.value = currentSideData.panY || 0;
        if (this.dom.imagePanYBadge) this.dom.imagePanYBadge.textContent = `${currentSideData.panY || 0}%`;
      }
      if (this.dom.bgColorPicker) {
        this.dom.bgColorPicker.value = currentSideData.bgColor || "#ffffff";
      }

      this.dom.fitModeRadios.forEach((radio) => {
        radio.checked = radio.value === currentSideData.fitMode;
      });

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
        url: "https://8ace7cea.job-fair-portfolio.pages.dev",
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.cardStudioApp = new App();
    });
  } else {
    window.cardStudioApp = new App();
  }
})();
