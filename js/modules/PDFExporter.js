/**
 * PDFExporter.js
 * Generates print-ready, millimeter-accurate 90mm x 50mm PDFs using jsPDF.
 * Renders Front & Back onto 300 DPI off-screen canvases (1063 x 591 px).
 * Produces zero-margin, press-ready output for print shops.
 */

import { CanvasRenderer } from "./CanvasRenderer.js";

export class PDFExporter {
  /**
   * Export double-sided business card as a 90mm x 50mm PDF.
   *
   * @param {import("./CardProject.js").CardProject} cardProject
   * @param {import("./QRManager.js").QRManager} qrManager
   * @param {object} [options]
   * @param {string} [options.fileName="business-card-90x50mm.pdf"]
   * @param {(status: string, percent: number) => void} [options.onProgress]
   * @returns {Promise<Blob>}
   */
  static async exportPDF(cardProject, qrManager, options = {}) {
    const onProgress = options.onProgress || (() => {});
    const state = cardProject.getState();
    const fileName = options.fileName || `business-card-${Date.now()}.pdf`;

    onProgress("Initializing PDF engine...", 10);

    // 1. Verify jsPDF availability
    const jsPDFConstructor = (typeof window !== "undefined" && (window.jspdf?.jsPDF || window.jsPDF));
    if (!jsPDFConstructor) {
      throw new Error(
        "PDF generation library (jsPDF) is not loaded. Please check your internet connection or reload the page."
      );
    }

    // 2. Generate QR code canvas if needed
    onProgress("Rendering high-res elements...", 25);
    const qrCanvas = await qrManager.getQRCanvas();

    // 3. Render 300 DPI offscreen canvases
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

    // 4. Build 90mm x 50mm PDF document
    onProgress("Compiling print-ready PDF...", 85);
    const doc = new jsPDFConstructor({
      orientation: "landscape",
      unit: "mm",
      format: [90, 50],
      compress: true
    });

    // Page 1: Front
    const frontDataUrl = frontCanvas.toDataURL("image/jpeg", 0.98);
    doc.addImage(frontDataUrl, "JPEG", 0, 0, 90, 50, undefined, "FAST");

    // Page 2: Back (if provided)
    if (shouldIncludeBack && backCanvas) {
      const backDataUrl = backCanvas.toDataURL("image/jpeg", 0.98);
      doc.addPage([90, 50], "landscape");
      doc.addImage(backDataUrl, "JPEG", 0, 0, 90, 50, undefined, "FAST");
    }

    // PDF metadata
    doc.setProperties({
      title: state.metadata.title || "Business Card 90x50mm",
      subject: "Print-ready double-sided business card",
      author: "Antigravity Card Studio",
      keywords: "business card, 90x50mm, 300dpi, print ready",
      creator: "Antigravity Business Card Designer"
    });

    onProgress("Finalizing download...", 95);

    // Save/Download
    doc.save(fileName);
    onProgress("Complete!", 100);

    return doc.output("blob");
  }

  /**
   * Export high-resolution 300 DPI PNG image for digital proofing.
   *
   * @param {import("./CardProject.js").CardProject} cardProject
   * @param {import("./QRManager.js").QRManager} qrManager
   * @param {"front" | "back"} side
   * @returns {Promise<void>}
   */
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
