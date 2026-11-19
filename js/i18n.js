/**
 * i18n.js
 * Comprehensive English / Arabic bilingual localization dictionary & controller.
 * Handles automatic RTL/LTR layout mirroring and localized text updates.
 */

export const translations = {
  en: {
    appTitle: "CardStudio 90x50",
    appSubtitle: "Print-Ready Double-Sided Business Card Designer",
    frontCardTab: "Front Card",
    backCardTab: "Back Card",
    qrBadge: "QR Active",
    
    // Left Panel Sections
    sectionImages: "1. Card Artwork",
    sectionImagesDesc: "Upload Front and Back designs. Images automatically auto-crop to 90×50mm (1.8:1 aspect ratio).",
    frontUploadLabel: "Front Side Image",
    backUploadLabel: "Back Side Image",
    uploadPlaceholder: "Click or drag & drop (PNG, JPG, WebP)",
    removeBtn: "Remove",
    fitModeLabel: "Smart Fit Mode",
    fitModeCover: "Auto-Crop Fill (Cover - Recommended)",
    fitModeContain: "Fit with Margin (Contain)",
    
    // QR Section
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

    // Guides & Print Options
    sectionGuides: "3. Print Guides & View",
    safeZoneLabel: "3mm Safe Cut Margin (Inner dashed line)",
    safeZoneHint: "Ensures text & logos aren't chopped off at the print shop (preview only)",
    centerGuidesLabel: "Center Alignment Crosshairs",
    
    // Actions & Export
    downloadPdfBtn: "Download Print-Ready PDF (90×50mm)",
    downloadPdfHint: "300 DPI press-ready 2-page PDF with exact millimeter bounds",
    exportPngFront: "Export Front PNG (300 DPI)",
    exportPngBack: "Export Back PNG (300 DPI)",
    loadDemoBtn: "Load Demo Template",
    resetBtn: "Reset Project",
    
    // Status & HUD
    liveCoordsLabel: "Live QR Position",
    coordSize: "Size",
    printSpecsBadge: "Spec: 90×50 mm • 300 DPI (1063×591 px) • Press-Ready",
    dragHint: "💡 Tip: Click & drag the QR code directly on the preview card!",
    
    // Messages
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
    
    // Left Panel Sections
    sectionImages: "1. صور وتصميم الكرت",
    sectionImagesDesc: "ارفع تصميم الوجه والظهر. يتم القص التلقائي الذكي بدقة ليتطابق مع مقاس 90×50 مم (نسبة 1.8:1).",
    frontUploadLabel: "صورة وجه الكرت",
    backUploadLabel: "صورة ظهر الكرت",
    uploadPlaceholder: "اضغط أو اسحب وأفلت هنا (PNG, JPG, WebP)",
    removeBtn: "حذف",
    fitModeLabel: "طريقة الملاءمة الذكية",
    fitModeCover: "ملء وقص تلقائي ذكي (مستحسن - Cover)",
    fitModeContain: "احتواء كامل مع هوامش (Contain)",
    
    // QR Section
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

    // Guides & Print Options
    sectionGuides: "3. خطوط الأمان والطباعة",
    safeZoneLabel: "منطقة الأمان للقص (3 مم - خط متقطع)",
    safeZoneHint: "توضح حدود القطع الآمنة لمنع قص النصوص في المطبعة (تظهر للمعاينة فقط ولا تطبع)",
    centerGuidesLabel: "خطوط منتصف الكرت",
    
    // Actions & Export
    downloadPdfBtn: "تحميل ملف PDF للطباعة (90×50 مم)",
    downloadPdfHint: "ملف PDF عالي الجودة 300 DPI صفحتين بدون هوامش زائدة، جاهز للمطبعة فوراً",
    exportPngFront: "تصدير الوجه كصورة (300 DPI)",
    exportPngBack: "تصدير الظهر كصورة (300 DPI)",
    loadDemoBtn: "تجربة نموذج جاهز",
    resetBtn: "إعادة ضبط",
    
    // Status & HUD
    liveCoordsLabel: "موقع الباركود الفعلي",
    coordSize: "المقاس",
    printSpecsBadge: "المقاس: 90×50 مم • الدقة: 300 نقطة (1063×591 بكسل) • جاهز للطباعة",
    dragHint: "💡 تلميح: يمكنك سحب كود الـ QR بالماوس أو اللمس وتغيير مكانه بحرية على الكرت!",
    
    // Messages
    pdfGenerating: "جاري إنشاء ملف الـ PDF بدقة 300 DPI...",
    pdfSuccess: "تم تنزيل ملف الـ PDF بنجاح!",
    demoLoaded: "تم تحميل النموذج التجريبي بنجاح!",
    resetConfirm: "هل أنت متأكد من رغبتك في إعادة ضبط التصميم ومسح التغييرات؟",
    imageLoaded: "تم تحميل الصورة"
  }
};

export class I18nManager {
  constructor(defaultLang = "en") {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("card_studio_lang") : null;
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
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("card_studio_lang", lang);
    }
    this.applyToDOM();
  }

  toggle() {
    this.setLanguage(this.currentLang === "en" ? "ar" : "en");
  }

  applyToDOM() {
    const isRtl = this.currentLang === "ar";
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = this.currentLang;

    // Apply translations to all data-i18n elements
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const text = this.t(key);
      if (text) {
        el.textContent = text;
      }
    });

    // Apply translations to placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const text = this.t(key);
      if (text) {
        el.placeholder = text;
      }
    });

    // Update language toggle button label
    const langBtn = document.getElementById("lang-toggle-btn");
    if (langBtn) {
      langBtn.innerHTML = isRtl
        ? `<span>English</span> <span class="text-xs opacity-75">🇺🇸</span>`
        : `<span>العربية</span> <span class="text-xs opacity-75">🇸🇦</span>`;
    }
  }
}
