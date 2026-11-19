# CardStudio 90x50 🪪

> **Print-Ready Double-Sided Business Card Designer (90mm × 50mm)**  
> High-DPI 300 DPI Canvas Rendering • Smart Aspect Ratio Auto-Crop • Interactive QR Drag & Drop • Zero-Build Cloudflare Pages Deployment.

---

## ✨ Features

- **Standard Print Dimensions ($90\text{mm} \times 50\text{mm}$):**
  - High-resolution **300 DPI** HTML5 Canvas rendering (`1063px × 591px`).
  - Strict $1.8:1$ ($9:5$) business card aspect ratio preservation.
- **Smart Center-Crop (`object-fit: cover` math):**
  - Upload arbitrary image aspect ratios (square, 16:9, portrait, etc.) and let CardStudio automatically scale and center-crop to fill the card completely without stretching, squishing, or distorting fonts, logos, or faces.
  - Optional **"Fit Mode"** toggle (`Auto-Crop Fill` vs `Fit with Margin`).
- **Interactive Drag & Drop QR Code Generator:**
  - Enter any destination URL with instant live preview.
  - Choose placement: **Front**, **Back**, or **None**.
  - Drag the QR code smoothly anywhere on the active card canvas using mouse or touch (Pointer Events API).
  - Scalable size slider ($10\text{mm}$ to $35\text{mm}$) preserving strict 1:1 square ratio.
  - Normalized percentage coordinates (`xPercent`, `yPercent`, `sizeMm`) guarantee pixel-perfect parity between screen preview and the exported 300 DPI PDF.
  - Toggleable **White Quiet-Zone Padding Box** ensuring scannability even over dark or busy card designs.
  - Quick-snap alignment presets (*Bottom-Right*, *Bottom-Left*, *Top-Right*, *Center*).
- **Print Shop Safe Zone Guide:**
  - Toggleable **3mm inner dashed cut margin** on the live preview canvas to ensure logos and text are never chopped off at the guillotine cutter.
  - *Guaranteed safe:* Never appears on exported PDFs or high-res images.
- **Direct 2-Page Print-Ready PDF Export:**
  - Single-click export via `jsPDF` (`orientation: 'landscape'`, `unit: 'mm'`, `format: [90, 50]`).
  - Outputs a zero-white-margin, 2-page PDF file ready for any commercial press or digital print shop.
  - Secondary export option for high-resolution 300 DPI PNG proofing images.
- **Bilingual Interface (English & العربية RTL):**
  - Seamless one-click language toggle with full `dir="rtl"` layout flipping and localized terminology.
- **Zero Build Step:**
  - Pure modular ES6 architecture (`type="module"`).
  - No bundlers, no npm installs, no compilation. Deploys directly to Cloudflare Pages, GitHub Pages, or Netlify.

---

## 📁 Project Structure

```text
ID creature/
├── index.html                   # Semantic HTML layout, bilingual UI, Tailwind via CDN
├── css/
│   └── styles.css               # Card mockups, print CSS, custom range/scrollbar styling
├── js/
│   ├── app.js                   # Application coordinator and DOM event orchestration
│   ├── i18n.js                  # English & Arabic bilingual dictionary and layout controller
│   └── modules/
│       ├── CardProject.js       # Centralized state management & JSON schema (V2/V3 extensible)
│       ├── CanvasRenderer.js    # 300 DPI canvas rendering & smart center-crop math
│       ├── QRManager.js         # QR generation, pointer drag-and-drop, normalized coords
│       ├── qr-engine.js         # Standalone Reed-Solomon QR matrix generator (100% offline fallback)
│       └── PDFExporter.js       # 90mm x 50mm 2-page PDF export via jsPDF
├── assets/
│   └── sample-cards.js          # Built-in dynamic high-res demo card generator (1-click test)
├── test/
│   └── test-card-studio.js      # Automated unit & integration verification suite
└── README.md                    # Project documentation & deployment guide
```

---

## 🚀 Cloudflare Pages Deployment (Zero Build Step)

Deploying to Cloudflare Pages takes under 1 minute with **zero build step**:

### Option A: Direct Git Deployment (Recommended)
1. Push this repository to GitHub or GitLab.
2. In your [Cloudflare Dashboard](https://dash.cloudflare.com/), navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select your repository.
4. Set the **Build settings**:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/` (or leave default root)
5. Click **Save and Deploy**. Your application will be live immediately on your `*.pages.dev` domain!

### Option B: Direct Folder Upload (Wrangler or Dashboard)
- **Via Cloudflare Dashboard:**
  Go to **Pages** > **Upload assets**, drag and drop the project folder directly.
- **Via Wrangler CLI:**
  ```bash
  npx wrangler pages deploy . --project-name=card-studio
  ```

---

## 📐 Technical Specifications & Math

| Parameter | Specification | Details |
| :--- | :--- | :--- |
| **Physical Card Size** | $90\text{ mm} \times 50\text{ mm}$ | ISO standard commercial business card format |
| **Aspect Ratio** | $1.8 : 1$ ($9 : 5$) | Width to height ratio |
| **Print Resolution** | $300\text{ DPI}$ | Standard commercial press resolution |
| **Pixel Dimensions** | $1063\text{ px} \times 591\text{ px}$ | $\text{Round}(90 / 25.4 \times 300) \times \text{Round}(50 / 25.4 \times 300)$ |
| **Safe Cut Zone** | $3\text{ mm}$ inner inset | Inset: $35.43\text{ px}$ horizontally & vertically at 300 DPI |
| **PDF Page Size** | $[90, 50]\text{ mm}$ Landscape | Exactly matched to physical dimensions with zero margin |
| **Coordinate Storage** | Normalized $0\% - 100\%$ | Independence from screen viewport or device DPI |

---

## 🔌 Extensibility & Roadmap (V2 / V3 Ready)

The application architecture was explicitly designed around `CardProject.js` state management and event-driven decoupled modules:

- **State Schema:**
  ```json
  {
    "version": "1.0",
    "metadata": { "title": "Card", "createdAt": "...", "updatedAt": "..." },
    "dimensions": { "widthMm": 90, "heightMm": 50, "dpi": 300, "safeZoneMarginMm": 3 },
    "front": { "dataUrl": "...", "fileName": "...", "fitMode": "cover" },
    "back": { "dataUrl": "...", "fileName": "...", "fitMode": "cover" },
    "qr": {
      "enabled": true,
      "side": "back",
      "url": "https://...",
      "sizeMm": 22,
      "xPercent": 70,
      "yPercent": 50,
      "quietZone": true
    },
    "layers": []
  }
  ```
- **Future Hooks:**
  1. **Custom Text & Vector Layers:** Extend `layers: []` in `CardProject.js` and render in `CanvasRenderer.js`.
  2. **Specialized QR Types:** Add vCard (contact card), Wi-Fi network, and WhatsApp quick-link formatters in `QRManager.js`.
  3. **LocalStorage & Template Library:** Utilize `project.toJSON()` and `project.fromJSON()` for local auto-saving and sharable design links.
  4. **Bulk CSV Data Merge:** Loop over rows of a CSV file, update state, and generate multi-card batch PDFs.

---

## 🧪 Local Testing & Verification

Run the automated test suite locally:

```bash
node test/test-card-studio.js
```

To run a lightweight local static server:

```bash
# Using Python
python -m http.server 8080

# Or using Node.js / npx
npx serve .
```

Open (https://543976a8.card-5pf.pages.dev/) in your web browser.

---

## 📄 License

MIT License. Designed and engineered for high-performance print workflows.
