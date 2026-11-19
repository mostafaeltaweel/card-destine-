/**
 * QRManager.js
 * QR code generation, drag-and-drop positioning, and scaling.
 * Supports window.QRCode (CDN) with seamless fallback to StandaloneQRCode.
 * Handles mouse and touch pointer events with normalized coordinate mapping.
 */

import { StandaloneQRCode } from "./qr-engine.js";

export class QRManager {
  /**
   * @param {import("./CardProject.js").CardProject} cardProject
   * @param {HTMLElement} stageContainer - preview card container element
   */
  constructor(cardProject, stageContainer) {
    this.project = cardProject;
    this.stageContainer = stageContainer;

    this.qrCanvasCache = null;
    this.lastRenderedUrl = "";
    this.lastRenderedColors = "";

    // Drag-and-drop state
    this.isDragging = false;
    this.pointerId = null;
    this.dragStartPointer = { x: 0, y: 0 };
    this.dragStartCoords = { xPercent: 0, yPercent: 0 };

    this.onPositionChange = null; // Callback for live coordinate HUD updates

    this._initPointerListeners();
  }

  /**
   * Get or generate the cached QR Code canvas element.
   * @returns {Promise<HTMLCanvasElement|null>}
   */
  async getQRCanvas() {
    const qrState = this.project.getState().qr;
    if (!qrState.enabled || qrState.side === "none" || !qrState.url) {
      return null;
    }

    const cacheKey = `${qrState.url}|${qrState.colorDark}|${qrState.colorLight}`;
    if (this.qrCanvasCache && this.lastRenderedUrl === cacheKey) {
      return this.qrCanvasCache;
    }

    // Generate high-res QR canvas (512x512) for razor-sharp rendering on preview & 300 DPI print
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

  /**
   * Internal generator: checks for window.QRCode (CDN), otherwise uses StandaloneQRCode.
   */
  async _generateQRCanvas(url, size, colorDark, colorLight) {
    // 1. Try window.QRCode (qrcodejs CDN)
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

        // Wait brief tick for qrcodejs to mount canvas or img
        await new Promise((r) => setTimeout(r, 20));

        const canvas = tempDiv.querySelector("canvas");
        if (canvas) {
          const resultCanvas = document.createElement("canvas");
          resultCanvas.width = size;
          resultCanvas.height = size;
          const ctx = resultCanvas.getContext("2d");
          ctx.drawImage(canvas, 0, 0);
          document.body.removeChild(tempDiv);
          return resultCanvas;
        }

        const img = tempDiv.querySelector("img");
        if (img && img.src) {
          const resultCanvas = document.createElement("canvas");
          resultCanvas.width = size;
          resultCanvas.height = size;
          const ctx = resultCanvas.getContext("2d");
          await new Promise((resolve) => {
            if (img.complete) resolve();
            else img.onload = resolve;
          });
          ctx.drawImage(img, 0, 0, size, size);
          document.body.removeChild(tempDiv);
          return resultCanvas;
        }

        document.body.removeChild(tempDiv);
      } catch (err) {
        console.warn("[QRManager] CDN QRCode generation fallback to StandaloneQRCode:", err);
      }
    }

    // 2. Pure standalone engine fallback
    return StandaloneQRCode.renderToCanvas(url, size, colorDark, colorLight);
  }

  /**
   * Invalidate cached QR so it regenerates on next render.
   */
  invalidateCache() {
    this.qrCanvasCache = null;
    this.lastRenderedUrl = "";
  }

  /**
   * Calculate QR bounding box in screen pixels relative to stage container.
   * @returns {{ x: number, y: number, width: number, height: number, padding: number } | null}
   */
  getQRBoundingBoxPx() {
    if (!this.stageContainer) return null;

    const rect = this.stageContainer.getBoundingClientRect();
    const state = this.project.getState();
    const qr = state.qr;
    const activeSide = state.settings.activeSide;

    if (!qr.enabled || qr.side !== activeSide) {
      return null;
    }

    const cardWidthMm = state.dimensions.widthMm;
    const cardHeightMm = state.dimensions.heightMm;

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

  /**
   * Hit test: check if pointer coords (clientX, clientY) fall inside QR bounds.
   */
  isPointerOverQR(clientX, clientY) {
    if (!this.stageContainer) return false;

    const rect = this.stageContainer.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const box = this.getQRBoundingBoxPx();
    if (!box) return false;

    // Hit-test on the quiet-zone bounding box (or QR box)
    return (
      localX >= box.boxX &&
      localX <= box.boxX + box.boxWidth &&
      localY >= box.boxY &&
      localY <= box.boxY + box.boxHeight
    );
  }

  /**
   * Initialize pointer events for dragging QR code across desktop and mobile.
   */
  _initPointerListeners() {
    if (!this.stageContainer) return;

    this.stageContainer.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    window.addEventListener("pointermove", (e) => this._onPointerMove(e));
    window.addEventListener("pointerup", (e) => this._onPointerUp(e));
    window.addEventListener("pointercancel", (e) => this._onPointerUp(e));
  }

  _onPointerDown(e) {
    const state = this.project.getState();
    if (!state.qr.enabled || state.qr.side !== state.settings.activeSide) {
      return;
    }

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
      } catch (err) {
        // Pointer capture unsupported or redundant
      }

      this.stageContainer.classList.add("cursor-grabbing");
      e.preventDefault();
    }
  }

  _onPointerMove(e) {
    if (!this.isDragging) {
      // Update cursor when hovering over QR
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
        xPercent: state.qr.xPercent,
        yPercent: state.qr.yPercent,
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
        if (e.pointerId) {
          this.stageContainer.releasePointerCapture(e.pointerId);
        }
      } catch (err) {
        // Ignore
      }
    }
  }

  /**
   * Return current coordinates formatted in mm and percentage.
   */
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
