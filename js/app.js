/**
 * app.js
 * Main entry point & coordinator for CardStudio 90x50.
 * Orchestrates CardProject, CanvasRenderer, QRManager, PDFExporter, and I18nManager.
 */

import { CardProject } from "./modules/CardProject.js";
import { CanvasRenderer } from "./modules/CanvasRenderer.js";
import { QRManager } from "./modules/QRManager.js";
import { PDFExporter } from "./modules/PDFExporter.js";
import { I18nManager } from "./i18n.js";
import { SampleCardGenerator } from "../assets/sample-cards.js";

class App {
  constructor() {
    this.project = new CardProject();
    this.i18n = new I18nManager();

    // DOM Elements Cache
    this.dom = {
      // Navigation
      langToggleBtn: document.getElementById("lang-toggle-btn"),
      loadDemoBtn: document.getElementById("load-demo-btn"),
      resetProjectBtn: document.getElementById("reset-project-btn"),

      // Tabs
      tabFrontBtn: document.getElementById("tab-front-btn"),
      tabBackBtn: document.getElementById("tab-back-btn"),
      flipViewBtn: document.getElementById("flip-view-btn"),
      frontQrBadge: document.getElementById("front-qr-badge"),
      backQrBadge: document.getElementById("back-qr-badge"),

      // Stage & Canvas
      stageContainer: document.getElementById("card-stage-container"),
      canvas: document.getElementById("card-preview-canvas"),
      qrDragOverlay: document.getElementById("qr-drag-overlay"),
      liveCoordsText: document.getElementById("live-coords-text"),

      // Front & Back Dropzones
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

      // Fit Mode
      fitModeRadios: document.querySelectorAll('input[name="fit-mode"]'),

      // QR Controls
      qrUrlInput: document.getElementById("qr-url-input"),
      qrUpdateBtn: document.getElementById("qr-update-btn"),
      qrSideBtns: document.querySelectorAll(".qr-side-btn"),
      qrSizeSlider: document.getElementById("qr-size-slider"),
      qrSizeBadge: document.getElementById("qr-size-badge"),
      qrQuietZoneCheckbox: document.getElementById("qr-quiet-zone-checkbox"),
      qrPresetBtns: document.querySelectorAll("[data-qr-preset]"),

      // Guides
      safeZoneToggle: document.getElementById("safe-zone-toggle"),
      centerGuidesToggle: document.getElementById("center-guides-toggle"),

      // Export Actions
      downloadPdfBtn: document.getElementById("download-pdf-btn"),
      exportPngFrontBtn: document.getElementById("export-png-front-btn"),
      exportPngBackBtn: document.getElementById("export-png-back-btn"),

      // Toast
      toastModal: document.getElementById("toast-modal"),
      toastSpinner: document.getElementById("toast-spinner"),
      toastMessage: document.getElementById("toast-message")
    };

    // QR Manager
    this.qrManager = new QRManager(this.project, this.dom.stageContainer);

    this.init();
  }

  async init() {
    this.i18n.applyToDOM();
    this._setupCanvasDimensions();
    this._bindEvents();

    // Auto-load sample cards initially so the workspace starts populated and beautiful
    await this.loadDemoTemplate(false);

    // Initial render
    await this.render();
    this.updateUI();
  }

  /**
   * Set canvas internal buffer resolution for crisp rendering (Retina/High-DPI).
   */
  _setupCanvasDimensions() {
    // We use the 300 DPI pixel dimensions (1063 x 591) for crisp pixel rendering
    this.dom.canvas.width = CanvasRenderer.PRINT_WIDTH_PX;
    this.dom.canvas.height = CanvasRenderer.PRINT_HEIGHT_PX;
  }

  /**
   * Attach all DOM and state listeners.
   */
  _bindEvents() {
    // 1. Language Toggle
    this.dom.langToggleBtn?.addEventListener("click", () => {
      this.i18n.toggle();
      this.updateUI();
    });

    // 2. Demo & Reset
    this.dom.loadDemoBtn?.addEventListener("click", () => this.loadDemoTemplate(true));
    this.dom.resetProjectBtn?.addEventListener("click", () => this.resetProject());

    // 3. Tab Navigation & Flip
    this.dom.tabFrontBtn?.addEventListener("click", () => this.setActiveSide("front"));
    this.dom.tabBackBtn?.addEventListener("click", () => this.setActiveSide("back"));
    this.dom.flipViewBtn?.addEventListener("click", () => {
      const current = this.project.getState().settings.activeSide;
      this.setActiveSide(current === "front" ? "back" : "front");
    });

    // Keyboard shortcut: Spacebar to flip sides (when not typing in an input)
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        const current = this.project.getState().settings.activeSide;
        this.setActiveSide(current === "front" ? "back" : "front");
      }
    });

    // 4. File Dropzones & Uploads
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

    // 5. Fit Mode Radios
    this.dom.fitModeRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const mode = e.target.value;
        this.project.setFitMode("front", mode);
        this.project.setFitMode("back", mode);
      });
    });

    // 6. QR Controls
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

    // QR Side selector buttons
    this.dom.qrSideBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const side = btn.getAttribute("data-qr-side");
        this.project.setQRConfig({ side, enabled: side !== "none" });
      });
    });

    // QR Size Slider
    this.dom.qrSizeSlider?.addEventListener("input", (e) => {
      const sizeMm = Number(e.target.value);
      this.dom.qrSizeBadge.textContent = `${sizeMm} mm`;
      this.project.setQRConfig({ sizeMm });
    });

    // QR Quiet Zone Checkbox
    this.dom.qrQuietZoneCheckbox?.addEventListener("change", (e) => {
      this.project.setQRConfig({ quietZone: e.target.checked });
    });

    // QR Quick Alignment Presets
    this.dom.qrPresetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = btn.getAttribute("data-qr-preset");
        this.project.setQRPresetPosition(preset);
      });
    });

    // 7. Guides Toggles
    this.dom.safeZoneToggle?.addEventListener("change", (e) => {
      this.project.setSetting("showSafeZone", e.target.checked);
    });

    this.dom.centerGuidesToggle?.addEventListener("change", (e) => {
      this.project.setSetting("showCenterGuides", e.target.checked);
    });

    // 8. Live Pointer & Drag coordinates callback
    this.qrManager.onPositionChange = (coords) => {
      this.dom.liveCoordsText.textContent = `X: ${coords.xMm} mm (${coords.xPercent}%) | Y: ${coords.yMm} mm (${coords.yPercent}%) | Size: ${coords.sizeMm} mm`;
      this._updateQROverlayBox();
    };

    // 9. Window Resize
    window.addEventListener("resize", () => {
      this._updateQROverlayBox();
    });

    // 10. State Change Listener
    this.project.onStateChange(async () => {
      await this.render();
      this.updateUI();
    });

    // 11. PDF & PNG Export
    this.dom.downloadPdfBtn?.addEventListener("click", () => this.exportPrintPDF());
    this.dom.exportPngFrontBtn?.addEventListener("click", () => PDFExporter.exportPNG(this.project, this.qrManager, "front"));
    this.dom.exportPngBackBtn?.addEventListener("click", () => PDFExporter.exportPNG(this.project, this.qrManager, "back"));
  }

  /**
   * Set up drag and drop and file input handling for card upload dropzones.
   */
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

  /**
   * Read and parse uploaded image file.
   */
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

  /**
   * Render the active card view onto the main preview canvas.
   */
  async render() {
    const state = this.project.getState();
    const activeSide = state.settings.activeSide;

    // Get pre-rendered QR code canvas
    const qrCanvas = await this.qrManager.getQRCanvas();

    // Render using CanvasRenderer
    CanvasRenderer.render(this.dom.canvas, state, activeSide, {
      forExport: false,
      includeSafeZone: state.settings.showSafeZone,
      includeCenterGuides: state.settings.showCenterGuides,
      qrCanvas
    });

    this._updateQROverlayBox();
  }

  /**
   * Position and scale the interactive QR overlay box over the preview canvas.
   */
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

    // Live coordinates label
    const coords = this.qrManager.getFormattedCoordinates();
    this.dom.liveCoordsText.textContent = `X: ${coords.xMm} mm (${coords.xPercent}%) | Y: ${coords.yMm} mm (${coords.yPercent}%) | Size: ${coords.sizeMm} mm`;
  }

  /**
   * Update UI controls to match current state.
   */
  updateUI() {
    const state = this.project.getState();
    const activeSide = state.settings.activeSide;

    // Tab active styles
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

    // QR Badges on tabs
    const qrSide = state.qr.side;
    const qrEnabled = state.qr.enabled && qrSide !== "none";
    this.dom.frontQrBadge?.classList.toggle("hidden", !(qrEnabled && qrSide === "front"));
    this.dom.backQrBadge?.classList.toggle("hidden", !(qrEnabled && qrSide === "back"));

    // Front image status
    const hasFront = !!state.front.dataUrl;
    this.dom.frontDropzonePrompt?.classList.toggle("hidden", hasFront);
    this.dom.frontLoadedInfo?.classList.toggle("hidden", !hasFront);
    this.dom.removeFrontBtn?.classList.toggle("hidden", !hasFront);
    if (hasFront) {
      this.dom.frontFileName.textContent = state.front.fileName || "front-card.png";
    }

    // Back image status
    const hasBack = !!state.back.dataUrl;
    this.dom.backDropzonePrompt?.classList.toggle("hidden", hasBack);
    this.dom.backLoadedInfo?.classList.toggle("hidden", !hasBack);
    this.dom.removeBackBtn?.classList.toggle("hidden", !hasBack);
    if (hasBack) {
      this.dom.backFileName.textContent = state.back.fileName || "back-card.png";
    }

    // QR Side buttons
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

    // QR Size Slider
    if (this.dom.qrSizeSlider) {
      this.dom.qrSizeSlider.value = state.qr.sizeMm;
      this.dom.qrSizeBadge.textContent = `${state.qr.sizeMm} mm`;
    }

    // QR Quiet Zone
    if (this.dom.qrQuietZoneCheckbox) {
      this.dom.qrQuietZoneCheckbox.checked = state.qr.quietZone;
    }

    // Safe Zone Toggle
    if (this.dom.safeZoneToggle) {
      this.dom.safeZoneToggle.checked = state.settings.showSafeZone;
    }

    // Center Guides Toggle
    if (this.dom.centerGuidesToggle) {
      this.dom.centerGuidesToggle.checked = state.settings.showCenterGuides;
    }
  }

  /**
   * Switch the active preview card side.
   */
  setActiveSide(side) {
    this.project.setActiveSide(side);
  }

  /**
   * Load sleek demo templates for testing.
   */
  async loadDemoTemplate(notify = true) {
    const demo = SampleCardGenerator.generateDemoCards();
    const frontImg = await demo.loadFrontImage();
    const backImg = await demo.loadBackImage();

    this.project.setImage("front", frontImg, demo.frontDataUrl, "demo-front-card.png", 145000);
    this.project.setImage("back", backImg, demo.backDataUrl, "demo-back-card.png", 132000);

    // Set QR on back card at bottom-right
    this.project.setQRConfig({
      enabled: true,
      side: "back",
      url: "https://nexusai-systems.io",
      sizeMm: 22,
      quietZone: true
    });
    this.project.setQRPresetPosition("bottom-right");
    this.project.setActiveSide("back");

    if (notify) {
      this.showToast(this.i18n.t("demoLoaded"), 2500);
    }
  }

  /**
   * Reset the current card project.
   */
  resetProject() {
    if (confirm(this.i18n.t("resetConfirm"))) {
      this.project.resetToDefaults();
      this.qrManager.invalidateCache();
      this.showToast("Project reset to defaults", 2000);
    }
  }

  /**
   * Export print-ready 90mm x 50mm PDF.
   */
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

  /**
   * Show notification toast modal.
   */
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

// Bootstrap on DOM load
window.addEventListener("DOMContentLoaded", () => {
  window.cardStudioApp = new App();
});
