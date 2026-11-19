/**
 * i18n.js
 * Comprehensive English / Arabic bilingual localization dictionary & controller.
 */

export const translations = {
  en: {
    appTitle: "CardStudio 90x50",
    appSubtitle: "Print-Ready Double-Sided Business Card Designer",
    frontCardTab: "Front Card",
    backCardTab: "Back Card",
    qrBadge: "QR Active",

    // Section 1: Images & Transform
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

    // Section 2: QR
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

    // Section 3: Print
    sectionGuides: "3. Print Guides & View",
    safeZoneLabel: "3mm Safe Cut Margin (Inner dashed line)",
    safeZoneHint: "Ensures text & logos aren't chopped off at the print shop (preview only)",
    centerGuidesLabel: "Center Alignment Crosshairs",

    // Actions
    downloadPdfBtn: "Download Print-Ready PDF (90×50mm)",
    downloadPdfHint: "300 DPI press-ready 2-page PDF with exact millimeter bounds",
    exportPngFront: "Export Front PNG (300 DPI)",
    exportPngBack: "Export Back PNG (300 DPI)",
    loadDemoBtn: "Load Demo Template",
    resetBtn: "Reset Project",

    // HUD
    liveCoordsLabel: "Live QR Position",
    printSpecsBadge: "Spec: 90×50 mm • 300 DPI (1063×591 px) • Press-Ready",
    dragHint: "💡 Tip: Click & drag the QR code directly on the preview card!",

    // Toast
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

    // Section 1: Images & Transform
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

    // Section 2: QR
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

    // Section 3: Print
    sectionGuides: "3. خطوط الأمان والطباعة",
    safeZoneLabel: "منطقة الأمان للقص (3 مم - خط متقطع)",
    safeZoneHint: "توضح حدود القطع الآمنة لمنع قص النصوص في المطبعة (تظهر للمعاينة فقط ولا تطبع)",
    centerGuidesLabel: "خطوط منتصف الكرت",

    // Actions
    downloadPdfBtn: "تحميل ملف PDF للطباعة (90×50 مم)",
    downloadPdfHint: "ملف PDF عالي الجودة 300 DPI صفحتين بدون هوامش زائدة، جاهز للمطبعة فوراً",
    exportPngFront: "تصدير الوجه كصورة (300 DPI)",
    exportPngBack: "تصدير الظهر كصورة (300 DPI)",
    loadDemoBtn: "تجربة نموذج جاهز",
    resetBtn: "إعادة ضبط",

    // HUD
    liveCoordsLabel: "موقع الباركود الفعلي",
    printSpecsBadge: "المقاس: 90×50 مم • الدقة: 300 نقطة (1063×591 بكسل) • جاهز للطباعة",
    dragHint: "💡 تلميح: يمكنك سحب كود الـ QR بالماوس أو اللمس وتغيير مكانه بحرية على الكرت!",

    // Toast
    pdfGenerating: "جاري إنشاء ملف الـ PDF بدقة 300 DPI...",
    pdfSuccess: "تم تنزيل ملف الـ PDF بنجاح!",
    demoLoaded: "تم تحميل النموذج التجريبي بنجاح!",
    resetConfirm: "هل أنت متأكد من رغبتك في إعادة ضبط التصميم ومسح التغييرات؟",
    imageLoaded: "تم تحميل الصورة"
  }
};

export class I18nManager {
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
