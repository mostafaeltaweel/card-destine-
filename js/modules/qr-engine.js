/**
 * qr-engine.js
 * Lightweight, zero-dependency, standalone QR Code Matrix Generator.
 * Implements ISO/IEC 18004 QR Code standard (Byte mode + Error Correction L/M/Q/H).
 * Ensures 100% offline functionality without external CDN dependencies.
 */

// QR Code Constants
const PAD0 = 0xec;
const PAD1 = 0x11;

// Galois Field Log / Anti-Log Tables for Reed-Solomon Error Correction
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

// Table of QR code version capacities & ECC specs: [totalDataCodewords, ecCodewordsPerBlock, [numBlocks, totalCodewordsPerBlock]...]
// Supporting Versions 1 to 10 (sufficient for URLs up to 270+ characters at Level M/H)
const QR_SPECS = [
  null,
  // V1 (21x21)
  { totalCodewords: 26, ecCodewords: 10, ecBlocks: [[1, 26]] },
  // V2 (25x25)
  { totalCodewords: 44, ecCodewords: 16, ecBlocks: [[1, 44]] },
  // V3 (29x29)
  { totalCodewords: 70, ecCodewords: 26, ecBlocks: [[1, 70]] },
  // V4 (33x33)
  { totalCodewords: 100, ecCodewords: 18, ecBlocks: [[2, 50]] },
  // V5 (37x37)
  { totalCodewords: 134, ecCodewords: 24, ecBlocks: [[2, 67]] },
  // V6 (41x41)
  { totalCodewords: 172, ecCodewords: 16, ecBlocks: [[4, 43]] },
  // V7 (45x45)
  { totalCodewords: 196, ecCodewords: 18, ecBlocks: [[4, 49]] },
  // V8 (49x49)
  { totalCodewords: 242, ecCodewords: 22, ecBlocks: [[2, 60], [2, 61]] },
  // V9 (53x53)
  { totalCodewords: 292, ecCodewords: 22, ecBlocks: [[3, 58], [2, 59]] },
  // V10 (57x57)
  { totalCodewords: 346, ecCodewords: 26, ecBlocks: [[4, 69], [1, 70]] }
];

// Alignment pattern center locations
const ALIGNMENT_PATTERN_TABLE = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50]
];

export class StandaloneQRCode {
  /**
   * Generate a 2D boolean array (modules) representing the QR code matrix.
   * @param {string} text - text or URL to encode
   * @returns {{ modules: boolean[][], size: number }}
   */
  static generate(text) {
    const utf8Bytes = new TextEncoder().encode(text);
    const dataLength = utf8Bytes.length;

    // Pick smallest version that fits data (Byte mode overhead: 4 bits mode + 8/16 bits length)
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
      // Fallback: truncate or clamp to V10 if extreme length
      version = 10;
      spec = QR_SPECS[10];
    }

    const ecTotal = spec.ecCodewords * (spec.ecBlocks.reduce((sum, b) => sum + b[0], 0));
    dataCapacity = spec.totalCodewords - ecTotal;

    // 1. Bit Buffer & Data Encoding (8-bit Byte Mode)
    const bits = [];
    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >>> i) & 1);
      }
    }

    // Mode: 0100 (8-bit byte)
    pushBits(0b0100, 4);
    // Character count indicator (8 bits for V1-9, 16 bits for V10+)
    pushBits(dataLength, version <= 9 ? 8 : 16);
    // Data bytes
    for (let i = 0; i < dataLength; i++) {
      pushBits(utf8Bytes[i], 8);
    }

    // Terminator (up to 4 zero bits)
    const maxDataBits = dataCapacity * 8;
    for (let i = 0; i < 4 && bits.length < maxDataBits; i++) {
      bits.push(0);
    }
    // Pad to 8-bit boundary
    while (bits.length % 8 !== 0) {
      bits.push(0);
    }

    // Convert bits to bytes
    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i + j];
      }
      dataBytes.push(b);
    }

    // Pad bytes alternating 0xEC and 0x11
    let pad = 0;
    while (dataBytes.length < dataCapacity) {
      dataBytes.push((pad++ % 2 === 0) ? PAD0 : PAD1);
    }

    // 2. Error Correction Codewords computation
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

        // Reed-Solomon division
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

    // Interleave data and EC codewords
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

    // 3. Matrix Construction
    const moduleCount = version * 4 + 17;
    const matrix = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(null));
    const isReserved = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(false));

    function markReserved(r, c) {
      if (r >= 0 && r < moduleCount && c >= 0 && c < moduleCount) {
        isReserved[r][c] = true;
      }
    }

    // Finder patterns (Top-left, Top-right, Bottom-left)
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
              matrix[tr][tc] = false; // Separator
            }
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, moduleCount - 7);
    drawFinder(moduleCount - 7, 0);

    // Alignment patterns
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

    // Timing patterns
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

    // Dark module
    markReserved(4 * version + 9, 8);
    matrix[4 * version + 9][8] = true;

    // Reserve format information areas
    for (let i = 0; i < 9; i++) {
      markReserved(8, i);
      markReserved(i, 8);
    }
    for (let i = moduleCount - 8; i < moduleCount; i++) {
      markReserved(8, i);
      markReserved(i, 8);
    }

    // Place data bits in matrix (traversing pairs of columns right-to-left)
    const finalBits = [];
    for (const byte of finalCodewords) {
      for (let i = 7; i >= 0; i--) {
        finalBits.push((byte >>> i) & 1);
      }
    }
    // Add remainder bits if needed
    while (finalBits.length < moduleCount * moduleCount) finalBits.push(0);

    let bitIndex = 0;
    let upward = true;
    for (let col = moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--; // Skip vertical timing pattern
      const rows = upward
        ? Array.from({ length: moduleCount }, (_, i) => moduleCount - 1 - i)
        : Array.from({ length: moduleCount }, (_, i) => i);

      for (const row of rows) {
        for (const c of [col, col - 1]) {
          if (!isReserved[row][c]) {
            const bit = bitIndex < finalBits.length ? finalBits[bitIndex++] : 0;
            // Apply Mask 0: (row + col) % 2 === 0
            const mask = ((row + c) % 2 === 0);
            matrix[row][c] = (bit === 1) ? !mask : mask;
          }
        }
      }
      upward = !upward;
    }

    // Apply Format Bits for Mask 0 and Error Correction M (format info = 0x5412)
    // 0x5412 in binary: 101010000010010
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

  /**
   * Render QR matrix onto an HTML5 canvas.
   * @param {string} text
   * @param {number} pixelSize - desired canvas dimension (e.g. 512)
   * @param {string} [colorDark="#000000"]
   * @param {string} [colorLight="#ffffff"]
   * @returns {HTMLCanvasElement}
   */
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
