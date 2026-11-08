/**
 * B.A.B — Beauty Assistant Bot
 * Standalone Native Web Component for DANDY beauty store
 *
 * Architecture:
 * - 100% Deterministic Rule-Based Customer Support
 * - Zero AI / LLM / External API Dependencies
 * - Native Web Component (<dandy-bab-widget>) with Encapsulated Shadow DOM
 * - In-browser Arabic Search Engine with Egyptian Dialect Coverage
 *
 * Usage:
 * <dandy-bab-widget knowledge-src="/assets/bab/data/knowledge.json"></dandy-bab-widget>
 * <script type="module" src="/assets/bab/widget/bab-widget.js"></script>
 */

// Arabic Normalization Utilities
export function normalizeArabic(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    // Remove diacritics / Tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Remove Tatweel / Kashida
    .replace(/\u0640/g, '')
    // Normalize Alefs
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Yaa / Alef Maqsura
    .replace(/[ىي]/g, 'ي')
    // Normalize Taa Marbuta and Haa for search tolerance
    .replace(/ة/g, 'ه')
    // Remove special punctuation
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟?،!]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Lightweight Levenshtein Distance for typo tolerance
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = [];
  for (let i = 0; i <= b.length; i++) row[i] = i;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

// Strict URL validation and sanitization for security
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous schemes and payloads
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('blob:') ||
    trimmed.includes('javascript%3a') ||
    trimmed.includes('vbscript%3a') ||
    trimmed.includes('data%3a')
  ) {
    return false;
  }

  // Allow relative internal routes
  if (url.startsWith('/')) {
    // Disallow protocol-relative URLs (e.g. //attacker.com)
    return !url.startsWith('//');
  }

  // Allow HTTPS / HTTP URLs
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizeUrl(url, baseUrl = 'https://dandy-ebon.vercel.app') {
  if (!isValidUrl(url)) return '#';
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) {
    const base = (baseUrl || 'https://dandy-ebon.vercel.app').replace(/\/+$/, '');
    return `${base}${trimmed}`;
  }
  return trimmed;
}

export function validateKnowledgeData(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['البيانات غير صالحة أو غير موجودة.'], warnings: [] };
  }

  if (typeof data.schemaVersion !== 'number' || data.schemaVersion <= 0) {
    errors.push('رقم إصدار المخطط (schemaVersion) مفقود أو غير صحيح.');
  }

  if (!data.settings || typeof data.settings !== 'object') {
    errors.push('كائن الإعدادات العامة (settings) مفقود.');
  } else {
    if (!data.settings.assistantName) warnings.push('اسم المساعد (assistantName) فارغ.');
    if (!data.settings.brandName) warnings.push('اسم المتجر (brandName) فارغ.');
    if (!data.settings.supportWhatsapp) warnings.push('رقم واتساب للدعم (supportWhatsapp) فارغ.');
  }

  if (!Array.isArray(data.categories)) {
    errors.push('مصفوفة الأقسام (categories) مفقودة أو غير صالحة.');
  } else if (data.categories.length === 0) {
    errors.push('يجب وجود قسم واحد على الأقل في قاعدة المعرفة.');
  }

  const categoryIds = new Set();
  if (Array.isArray(data.categories)) {
    for (let i = 0; i < data.categories.length; i++) {
      const cat = data.categories[i];
      if (!cat || typeof cat !== 'object') {
        errors.push(`القسم رقم ${i + 1} غير صالح.`);
        continue;
      }
      if (!cat.id || typeof cat.id !== 'string' || !cat.id.trim()) {
        errors.push(`القسم رقم ${i + 1} لا يحتوي على معرّف ID صالح.`);
      } else if (categoryIds.has(cat.id)) {
        errors.push(`معرّف القسم (${cat.id}) مكرر.`);
      } else {
        categoryIds.add(cat.id);
      }
      if (!cat.title || typeof cat.title !== 'string' || !cat.title.trim()) {
        errors.push(`القسم (${cat.id || i + 1}) لا يحتوي على عنوان.`);
      }
    }
  }

  if (!Array.isArray(data.articles)) {
    errors.push('مصفوفة المقالات (articles) مفقودة أو غير صالحة.');
  }

  const articleIds = new Set();
  if (Array.isArray(data.articles)) {
    for (let i = 0; i < data.articles.length; i++) {
      const art = data.articles[i];
      if (!art || typeof art !== 'object') {
        errors.push(`المقال رقم ${i + 1} غير صالح.`);
        continue;
      }
      if (!art.id || typeof art.id !== 'string' || !art.id.trim()) {
        errors.push(`المقال رقم ${i + 1} لا يحتوي على معرّف ID صالح.`);
      } else if (articleIds.has(art.id)) {
        errors.push(`معرّف المقال (${art.id}) مكرر.`);
      } else {
        articleIds.add(art.id);
      }

      if (!art.categoryId || !categoryIds.has(art.categoryId)) {
        errors.push(`المقال "${art.title || art.id}" يشير لقسم غير موجود (${art.categoryId || 'فارغ'}).`);
      }

      if (!art.title || typeof art.title !== 'string' || !art.title.trim()) {
        errors.push(`المقال (${art.id}) لا يحتوي على عنوان.`);
      }

      if (!art.question || typeof art.question !== 'string' || !art.question.trim()) {
        errors.push(`المقال (${art.id}) لا يحتوي على سؤال.`);
      }

      if (!art.answer || typeof art.answer !== 'object' || !art.answer.text || !art.answer.text.trim()) {
        errors.push(`المقال "${art.title || art.id}" لا يحتوي على نص إجابة معتمد.`);
      }

      if (art.answer?.links && Array.isArray(art.answer.links)) {
        for (const link of art.answer.links) {
          if (!isValidUrl(link.url)) {
            errors.push(`المقال "${art.title || art.id}" يحتوي على رابط غير آمن أو غير صالح (${link.url || 'فارغ'}).`);
          }
        }
      }

      if (!art.keywords || !Array.isArray(art.keywords) || art.keywords.length === 0) {
        warnings.push(`المقال "${art.title || art.id}" لا يحتوي على كلمات مفتاحية.`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Common Egyptian conversational filler words & stop words
const ARABIC_STOP_WORDS = new Set([
  'في', 'من', 'على', 'علي', 'عن', 'الى', 'الي', 'مع', 'هل', 'هو', 'هي', 'لو',
  'سمحت', 'منك', 'عايز', 'عايزه', 'عاوز', 'عاوزه', 'محتاج', 'محتاجه', 'ممكن',
  'بدي', 'اريد', 'ابغى', 'ازاي', 'ازاى', 'كيف', 'طريقة', 'طريقه', 'فين', 'كام', 'بكام'
]);

// Helper to match token using Arabic word boundaries rather than loose character substrings
export function matchTokenInText(token, text) {
  if (!token || !text) return false;
  if (token === text) return true;
  const words = text.split(' ');
  return words.some(w => {
    if (w === token) return true;
    if (token.length <= 3) {
      return w === 'ال' + token || ('ال' + w) === token;
    }
    return w.includes(token);
  });
}

// Search Engine implementation
export function searchKnowledgeBase(query, knowledge) {
  if (!query || !query.trim() || !knowledge || !Array.isArray(knowledge.articles)) {
    return [];
  }

  const rawNormQuery = normalizeArabic(query);
  const queryTokens = rawNormQuery.split(' ').filter(t => t.length > 0);
  if (queryTokens.length === 0) return [];

  // Identify meaningful content tokens vs stop words
  const contentTokens = queryTokens.filter(t => !ARABIC_STOP_WORDS.has(t));

  const enabledArticles = knowledge.articles.filter(a => a.enabled !== false);
  const scored = [];

  for (const article of enabledArticles) {
    let score = 0;
    const normTitle = normalizeArabic(article.title || '');
    const normQuestion = normalizeArabic(article.question || '');
    const normAnswer = normalizeArabic(article.answer?.text || '');
    const altQuestions = (article.alternativeQuestions || []).map(q => normalizeArabic(q));
    const keywords = (article.keywords || []).map(k => normalizeArabic(k));
    const synonyms = (article.synonyms || []).map(s => normalizeArabic(s));

    // 1. Exact match on title or main question (Highest priority)
    if (normTitle === rawNormQuery) score += 160;
    else if (normQuestion === rawNormQuery) score += 150;

    // 2. Full phrase inclusion in title or question
    if (normTitle.includes(rawNormQuery)) score += 85;
    if (normQuestion.includes(rawNormQuery)) score += 75;

    // 3. Alternative Questions matches
    for (const alt of altQuestions) {
      if (alt === rawNormQuery) {
        score += 130;
        break;
      } else if (alt.includes(rawNormQuery) || rawNormQuery.includes(alt)) {
        score += 70;
        break;
      }
    }

    // 4. Keywords and Synonyms exact / partial matches
    for (const kw of keywords) {
      if (kw === rawNormQuery) {
        score += 110;
      } else if (kw.includes(rawNormQuery) || (rawNormQuery.length > 3 && rawNormQuery.includes(kw))) {
        score += 55;
      }
    }

    for (const syn of synonyms) {
      if (syn === rawNormQuery) {
        score += 95;
      } else if (syn.includes(rawNormQuery) || (rawNormQuery.length > 3 && rawNormQuery.includes(syn))) {
        score += 50;
      }
    }

    // 5. Token-by-token scoring with content-weighting and word boundaries
    let matchedTokenCount = 0;
    let matchedContentTokenCount = 0;

    for (const token of queryTokens) {
      const isStop = ARABIC_STOP_WORDS.has(token);
      let matchedToken = false;

      // Check title & question
      if (matchTokenInText(token, normTitle)) {
        score += isStop ? 10 : 35;
        matchedToken = true;
      }
      if (matchTokenInText(token, normQuestion)) {
        score += isStop ? 8 : 30;
        matchedToken = true;
      }

      // Check alternative questions
      for (const alt of altQuestions) {
        if (matchTokenInText(token, alt)) {
          score += isStop ? 10 : 30;
          matchedToken = true;
          break;
        }
      }

      // Check keywords/synonyms
      for (const kw of keywords) {
        if (matchTokenInText(token, kw)) {
          score += isStop ? 8 : 25;
          matchedToken = true;
          break;
        }
      }
      for (const syn of synonyms) {
        if (matchTokenInText(token, syn)) {
          score += isStop ? 6 : 20;
          matchedToken = true;
          break;
        }
      }

      // Check answer text
      if (!isStop && matchTokenInText(token, normAnswer)) {
        score += 12;
        matchedToken = true;
      }

      // Typo tolerance check for meaningful tokens of length >= 4
      if (!matchedToken && !isStop && token.length >= 4) {
        const maxDist = token.length >= 6 ? 2 : 1;
        const titleWords = normTitle.split(' ');
        for (const tw of titleWords) {
          if (tw.length >= 4 && levenshteinDistance(token, tw) <= maxDist) {
            score += 20;
            matchedToken = true;
            break;
          }
        }

        if (!matchedToken) {
          for (const kw of keywords) {
            if (kw.length >= 4 && levenshteinDistance(token, kw) <= maxDist) {
              score += 18;
              matchedToken = true;
              break;
            }
          }
        }
      }

      if (matchedToken) {
        matchedTokenCount++;
        if (!isStop) matchedContentTokenCount++;
      }
    }

    // Bonus for matching all meaningful tokens
    if (contentTokens.length > 0 && matchedContentTokenCount === contentTokens.length) {
      score += 45;
    } else if (matchedTokenCount === queryTokens.length && queryTokens.length > 1) {
      score += 35;
    }

    // Avoid returning unrelated answers merely because they share one common word
    const hasPhraseMatch = (
      normTitle.includes(rawNormQuery) ||
      normQuestion.includes(rawNormQuery) ||
      altQuestions.some(alt => alt.includes(rawNormQuery) || rawNormQuery.includes(alt)) ||
      keywords.some(kw => kw.includes(rawNormQuery) || rawNormQuery.includes(kw)) ||
      synonyms.some(syn => syn.includes(rawNormQuery) || rawNormQuery.includes(syn))
    );

    // If query contains 2 or more content tokens, discard single-token accidental hits
    if (contentTokens.length >= 2 && matchedContentTokenCount < 2 && !hasPhraseMatch) {
      score = 0;
    }

    // Strict threshold: score must be at least 20 to avoid noisy unrelated matches
    if (score >= 20) {
      scored.push({ article, score });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map(s => s.article);
}

// Clean, Crisp SVG Icons (Safe strings for innerHTML inside isolated Shadow DOM)
const ICONS = {
  sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18.5" r="2.5"/><circle cx="7" cy="18.5" r="2.5"/></svg>`,
  'rotate-ccw': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  'credit-card': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`,
  'message-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  minimize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>`,
  thumbsUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3Z"/></svg>`,
  thumbsDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3Z"/></svg>`,
  helpCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  floral: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16c-3-2.5-4-6.5-1-9 3.5 2 3.5 6.5 1 9Z"/><path d="M12 16c3-2.5 4-6.5 1-9-3.5 2-3.5 6.5-1 9Z"/></svg>`
};

const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

// --- BUNDLED_KNOWLEDGE_START ---
export const BUNDLED_KNOWLEDGE = {"schemaVersion":1,"settings":{"assistantName":"B.A.B","assistantSubtitle":"مساعد DANDY الذكي","brandName":"DANDY","welcomeMessage":"أهلاً بكِ في DANDY! ✨ أنا B.A.B مساعدكِ الذكي لمساعدتكِ في تصفح المنتجات، معرفة تفاصيل الشحن والتوصيل، أو سياسات المتجر. كيف أقدر أساعدكِ اليوم؟","searchPlaceholder":"ابحث عن سؤال أو موضوع...","supportPhone":"01038941005","supportWhatsapp":"201038941005","supportWhatsappText":"مرحبًا، أحتاج إلى مساعدة بخصوص متجر DANDY.","supportHours":"يوميًا من 10:00 صباحًا حتى 10:00 مساءً (بتوقيت القاهرة)","officialBaseUrl":"https://dandy-ebon.vercel.app","brandLogo":"/assets/bab/images/dandy-logo.png","brandLogoWhite":"/assets/bab/images/dandy-logo-white.png","theme":{"primary":"#fe5d9f","secondary":"#db2777","dark":"#38121d","background":"#fdf2f8","surface":"#ffffff"},"fallbackMessage":"عذرًا، لم أتمكن من العثور على إجابة دقيقة لسؤالك في قاعدة المعرفة الحالية.","noResultsMessage":"لم نجد نتائج مطابقة لبحثكِ. يمكنكِ تجربة كلمات بحث أخرى أو التحدث مباشرة مع خدمة عملاء DANDY عبر واتساب."},"quickReplies":[{"id":"qr-shipping-time","label":"مدة التوصيل","articleId":"shipping-delivery-time","action":"article"},{"id":"qr-shipping-free","label":"الشحن المجاني","articleId":"shipping-free","action":"article"},{"id":"qr-track-order","label":"تتبع طلبي","articleId":"track-how-to","action":"article"},{"id":"qr-browse-products","label":"تصفح المنتجات","articleId":"prod-find-product","action":"article"},{"id":"qr-special-offers","label":"العروض الحالية","articleId":"prod-offers","action":"article"},{"id":"qr-whatsapp","label":"محادثة واتساب","action":"whatsapp"}],"categories":[{"id":"orders-purchasing","title":"الطلبات والشراء","description":"خطوات الطلب، إضافة المنتجات للسلة، إتمام الشراء، تعديل وإلغاء الأوردر","icon":"tag","order":1,"enabled":true},{"id":"shipping-delivery","title":"الشحن والتوصيل","description":"مدة التوصيل (2-5 أيام عمل)، الشحن المجاني فوق 2000 ج.م، ومصاريف المحافظات","icon":"truck","order":2,"enabled":true},{"id":"order-tracking","title":"تتبع الطلبات","description":"متابعة حالة الشحنة عبر رابط التتبع الرسمي، وتحديثات وصول الأوردر","icon":"search","order":3,"enabled":true},{"id":"products-care","title":"المنتجات والعناية الشخصية","description":"أقسام العناية بالشعر، العناية بالبشرة، العناية بالجسم، والعطور الأصلية","icon":"sparkles","order":4,"enabled":true},{"id":"payments-returns","title":"الدفع والاسترجاع والاستبدال","description":"طرق الدفع، سياسة فحص الشحنات، وإجراءات مراجعة الحالات مع الدعم","icon":"rotate-ccw","order":5,"enabled":true},{"id":"account-user","title":"الحساب والمستخدم","description":"تسجيل الدخول، إنشاء حساب جديد، وتعديل بيانات الملف الشخصي","icon":"user","order":6,"enabled":true},{"id":"website-tech-help","title":"الموقع والمساعدة التقنية","description":"حلول مشكلات السلة، عدم اكتمال الطلب، والمساعدة التقنية الفورية","icon":"credit-card","order":7,"enabled":true},{"id":"store-info","title":"معلومات المتجر","description":"عن DANDY، مواعيد العمل (10 ص - 10 م)، الشروط والأحكام وخدمة العملاء","icon":"message-circle","order":8,"enabled":true}],"articles":[{"id":"order-how-to-place","categoryId":"orders-purchasing","title":"كيف أقوم بعمل طلب جديد؟","question":"كيف أقوم بعمل طلب في متجر DANDY؟","alternativeQuestions":["ازاي اعمل اوردر؟","طريقة الطلب من الموقع","خطوات الشراء من DANDY","كيف اطلب منتجات؟","عايز اشتري منتجات"],"keywords":["طلب","اوردر","شراء","خطوات الطلب","عمل طلب","order"],"synonyms":["طلبيه","شروه","ازاي اشتري"],"answer":{"text":"يمكنكِ إتمام طلبكِ بسهولة عبر موقع DANDY باتباع الخطوات التالية:","steps":["تصفحي المنتجات واختاري المنتجات المناسبة لاحتياجاتكِ.","اضغطي على زر 'أضيفي للسلة' لكل منتج ترغبين بشرائه.","توجهي إلى سلة المشتريات بالضغط على أيقونة السلة أعلى الصفحة.","راجعي محتويات السلة ثم اضغطي على زر 'إتمام الطلب'.","أدخلي بيانات الشحن والعنوان بالتفصيل، ثم أكدي الطلب."],"links":[{"title":"تصفح جميع المنتجات","url":"https://dandy-ebon.vercel.app/all-products","isExternal":false},{"title":"عرض سلة الشراء","url":"https://dandy-ebon.vercel.app/cart","isExternal":false}]},"relatedIds":["order-add-to-cart","order-checkout-process","order-what-happens-next"],"enabled":true,"order":1},{"id":"order-add-to-cart","categoryId":"orders-purchasing","title":"إضافة المنتجات إلى السلة","question":"كيف أضيف المنتجات إلى سلة المشتريات؟","alternativeQuestions":["ازاي احط المنتج في السلة؟","طريقة اضافة المنتجات لعربة التسوق","زر أضيفي للسلة مش شغال","كيف اضيف منتج للسلة؟"],"keywords":["سلة","اضافة للسلة","عربة التسوق","cart","add to cart"],"synonyms":["عرباية","الباسكت"],"answer":{"text":"في كل صفحة منتج أو قائمة، ستجدين زر 'أضيفي للسلة'. بمجرد الضغط عليه، ستتم إضافة المنتج مباشرة مع إمكانية تعديل الكميات من داخل صفحة السلة في أي وقت.","steps":["اختاري المنتج وافتحي صفحته للاطلاع على التفاصيل.","حددي الكمية المطلوبة إن وُجد خيار التحديد.","اضغطي 'أضيفي للسلة' وستظهر لكِ معاينة السلة فوراً."],"links":[{"title":"الانتقال لسلة المشتريات","url":"https://dandy-ebon.vercel.app/cart","isExternal":false}]},"relatedIds":["order-how-to-place","tech-cart-issue"],"enabled":true,"order":2},{"id":"order-checkout-process","categoryId":"orders-purchasing","title":"إتمام عملية الشراء والدفع","question":"كيف أتمم مرحلة الدفع وتأكيد الطلب؟","alternativeQuestions":["ازاي اكمل الاوردر؟","طريقة انهاء الشراء","خطوات الدفع والتأكيد","checkout","كيف اتمم الدفع؟"],"keywords":["اتمام الطلب","انهاء الشراء","الدفع","checkout","الدفع والشحن"],"synonyms":["تشيك اوت","انهاء الاوردر"],"answer":{"text":"بعد مراجعة سلة مشترياتكِ، اضغطي على زر 'إتمام الشراء' أو 'المتابعة للدفع'. ستقومين بإدخال اسمكِ الكامل، رقم الهاتف، والمحافظة والعنوان بالتفصيل لحساب تكلفة الشحن بدقة واعتماد الطلب.","steps":["افتحي صفحة السلة واضغطي 'إتمام الطلب'.","أدخلي اسم المستلم ورقم الهاتف والعنوان والمحافظة.","اختاري طريقة الدفع المتاحة لطلبكِ.","اضغطي 'تأكيد الطلب' وسيظهر لكِ رقم الطلب مباشرة."],"links":[{"title":"سلة المشتريات","url":"https://dandy-ebon.vercel.app/cart","isExternal":false}]},"relatedIds":["order-how-to-place","pay-methods-available"],"enabled":true,"order":3},{"id":"order-modify-request","categoryId":"orders-purchasing","title":"تعديل الطلب بعد تأكيده","question":"هل يمكنني تعديل الطلب أو تغيير المنتجات بعد إتمامه؟","alternativeQuestions":["عايز اغير في الاوردر","ممكن اعدل العنوان؟","عايز اضيف منتج على الطلب","تغيير رقم الموبايل او العنوان في الاوردر","هل ينفع اعدل الطلب؟"],"keywords":["تعديل الطلب","تغيير العنوان","تعديل الاوردر","اضافة منتج","تغيير الطلب"],"synonyms":["تعديل","تغيير","ابدل منتج في الطلب"],"answer":{"text":"لا يمكن تعديل الطلب تلقائياً من خلال الموقع بعد تأكيده إذا بدأت عملية التجهيز والشحن. في حال رغبتِ في تعديل العنوان أو إضافة منتج، يُرجى التواصل الفوري مع فريق خدمة عملاء DANDY عبر واتساب ليرى الموظف إمكانية التعديل قبل تسليم الشحنة للمندوب.","steps":["تجهيز رقم الطلب المرجعي الخاص بكِ.","التواصل مباشرة مع دعم واتساب 01038941005.","إبلاغ الموظف بالتعديل المطلوب قبل خروج الشحنة مع شركة الشحن."],"links":[{"title":"محادثة الدعم عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["order-cancel-request","store-contact-support"],"enabled":true,"order":4},{"id":"order-cancel-request","categoryId":"orders-purchasing","title":"إلغاء الطلب","question":"كيف يمكنني إلغاء الطلب بعد عمله؟","alternativeQuestions":["عايز الغي الاوردر","طريقة الغاء الطلب","كنسلة الاوردر","هل ينفع الغي طلبي؟","الغاء الشحنة"],"keywords":["الغاء الطلب","كنسلة","الغاء الاوردر","cancel order","تراجع عن الشراء"],"synonyms":["كنسل","مش عايز الاوردر"],"answer":{"text":"يمكنكِ إلغاء طلبكِ طالما لم يتم شحنه أو تسليمه لشركة التوصيل بعد. يُرجى التواصل الفوري مع خدمة العملاء عبر واتساب مع ذكر رقم الطلب حتى يتمكن الفريق من إيقاف تجهيزه فوراً.","steps":["تواصلي مع خدمة عملاء DANDY عبر واتساب 01038941005.","أرسلي رقم الطلب واطلبي الإلغاء.","سيقوم فريق الدعم بمراجعة حالة الطلب وتأكيد الإلغاء معكِ."],"links":[{"title":"تواصل عبر واتساب للإلغاء","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["order-modify-request","shipping-delivery-time"],"enabled":true,"order":5},{"id":"order-no-confirmation","categoryId":"orders-purchasing","title":"لم يصلني تأكيد للطلب","question":"عملت طلب ولكن لم يصلني تأكيد، ماذا أفعل؟","alternativeQuestions":["معملتش تأكيد للطلب","موصليش رسالة تأكيد","ازاي اتأكد ان الاوردر اتعمل؟","الطلب متأكدش","ما وصلني ايميل او رسالة"],"keywords":["تأكيد الطلب","رسالة تأكيد","لم يصلني تأكيد","مراجعة الطلب","confirmation"],"synonyms":["مفيش رسالة","الاوردر اتسجل ولا لأ"],"answer":{"text":"عادةً يظهر رقم الطلب على الشاشة فور إتمامه بنجاح. إذا لم تكوني متأكدة من تسجيل الطلب أو لم تصلكِ رسالة تأكيد، يُرجى التواصل مع خدمة العملاء عبر واتساب وسيقوم فريق الدعم بفحص سجل الطلبات فوراً.","links":[{"title":"تأكيد الطلب مع خدمة العملاء","url":"https://wa.me/201038941005","isExternal":true},{"title":"صفحة الحساب والطلبات","url":"https://dandy-ebon.vercel.app/account","isExternal":false}]},"relatedIds":["order-how-to-place","account-view-orders"],"enabled":true,"order":6},{"id":"order-review-details","categoryId":"orders-purchasing","title":"كيف أراجع تفاصيل ومحتويات طلبي؟","question":"كيف يمكنني مراجعة تفاصيل طلبي ومحتوياته؟","alternativeQuestions":["عايز اشوف محتويات الاوردر","ازاي اراجع المنتجات اللي طلبتها؟","تفاصيل طلبي","مراجعة الاوردر"],"keywords":["مراجعة الطلب","تفاصيل الاوردر","محتويات الطلب","سجل الطلبات"],"synonyms":["الاوردر بتاعي","حاجات الاوردر"],"answer":{"text":"يمكنكِ مراجعة تفاصيل طلباتكِ السابقة والحالية عن طريق تسجيل الدخول إلى حسابكِ على موقع DANDY والدخول إلى صفحة الحساب الشخصي، أو الاستعلام برقم الطلب عبر صفحة تتبع الطلبات.","links":[{"title":"صفحة حسابي","url":"https://dandy-ebon.vercel.app/account","isExternal":false},{"title":"صفحة تتبع الطلب","url":"https://dandy-ebon.vercel.app/track-order","isExternal":false}]},"relatedIds":["account-view-orders","track-how-to"],"enabled":true,"order":7},{"id":"order-what-happens-next","categoryId":"orders-purchasing","title":"ماذا يحدث بعد إتمام الطلب؟","question":"ما هي الخطوات التي تتم بعد تأكيد طلبي في المتجر؟","alternativeQuestions":["ايه اللي بيحصل بعد الاوردر؟","خطوات ما بعد الشراء","مراحل تجهيز الطلب","امتى بيتجهز الاوردر؟"],"keywords":["بعد الطلب","تجهيز الطلب","مراحل الشحن","خطوات الشحن"],"synonyms":["بعد الشراء","تجهيز الشحنة"],"answer":{"text":"بمجرد تأكيد طلبكِ، يبدأ فريق مستودع DANDY في فحص المنتجات وتغليفها بعناية فائقة، ثم تسليمها لشركة الشحن المعتمدة للتوصيل في غضون 2 إلى 5 أيام عمل، مع إمكانية متابعة الشحنة عبر رابط التتبع.","steps":["مراجعة الطلب وتأكيد البيانات.","تجهيز المنتجات وتغليفها الآمن داخل مستودع DANDY.","تسليم الشحنة لشركة الشحن للتوصيل إلى عنوانكِ."],"links":[{"title":"متابعة تتبع الطلب","url":"https://dandy-ebon.vercel.app/track-order","isExternal":false}]},"relatedIds":["shipping-delivery-time","track-how-to"],"enabled":true,"order":8},{"id":"shipping-delivery-time","categoryId":"shipping-delivery","title":"مدة التوصيل المتوقعة","question":"ما هي مدة التوصيل المتوقعة لوصول الطلب؟","alternativeQuestions":["الشحنة هتوصل امتى؟","التوصيل بياخد كام يوم؟","ما هي مدة الشحن؟","وقت وصول الأوردر","متى استلم طلبي؟","كم يوم يستغرق الشحن؟"],"keywords":["الشحن","التوصيل","مدة الشحن","مدة التوصيل","ايام عمل","موعد الوصول","delivery time"],"synonyms":["ميعاد وصول الشحنة","هيوصل امتى","كام يوم"],"answer":{"text":"مدة التوصيل المتوقعة لجميع محافظات جمهورية مصر العربية هي من يومين إلى خمسة (2 - 5) أيام عمل ابتداءً من تاريخ تأكيد وتجهيز الطلب.","steps":["يوم عمل واحد لتجهيز وتغليف المنتجات بعناية في المستودع.","من يوم إلى 4 أيام عمل للتوصيل عبر شركة الشحن حسب محافظتكِ."],"links":[{"title":"تتبع مسار شحنتكِ","url":"https://dandy-ebon.vercel.app/track-order","isExternal":false}]},"relatedIds":["shipping-governorates","shipping-fees","shipping-free"],"enabled":true,"order":1},{"id":"shipping-governorates","categoryId":"shipping-delivery","title":"التوصيل لجميع محافظات مصر","question":"هل يتم التوصيل لجميع المحافظات في مصر؟","alternativeQuestions":["بتوصلوا للصعيد؟","هل في شحن لاسكندرية؟","التوصيل بيشمل كل المحافظات؟","بتوصلوا للأقاليم؟","هل يوجد شحن لمحافظتي؟"],"keywords":["المحافظات","القاهرة","الجيزة","الاسكندرية","الصعيد","الدلتا","القناة","شحن لكل مصر"],"synonyms":["محافظتي","بتوصلوا فين","مناطق الشحن"],"answer":{"text":"نعم، متجر DANDY يغطي جميع محافظات جمهورية مصر العربية (القاهرة، الجيزة، الإسكندرية، محافظات الدلتا، القناة، والصعيد) بالتعاون مع كبرى شركات الشحن والتوصيل.","links":[{"title":"تصفح المنتجات وبدء الطلب","url":"https://dandy-ebon.vercel.app/all-products","isExternal":false}]},"relatedIds":["shipping-delivery-time","shipping-fees"],"enabled":true,"order":2},{"id":"shipping-fees","categoryId":"shipping-delivery","title":"مصاريف ورسوم الشحن","question":"كم تبلغ تكلفة ومصاريف الشحن؟","alternativeQuestions":["الشحن بكام؟","مصاريف التوصيل كام؟","سعر الشحن؟","عايز أعرف تكلفة الشحن","كم مصاريف الشحن لمحافظتي؟","shipping fee"],"keywords":["مصاريف الشحن","سعر الشحن","تكلفة الشحن","رسوم التوصيل","الشحن بكام","سعر التوصيل"],"synonyms":["كام الشحن","فلوس التوصيل","اجرة الشحن"],"answer":{"text":"رسوم ومصاريف الشحن في DANDY ليست ثابتة، بل تختلف بدقة حسب المحافظة والمنطقة المحددة لعنوانكِ. سيظهر لكِ السعر الدقيق للشحن مباشرة في صفحة السلة والدفع بعد تحديد محافظتكِ وقبل إتمام الطلب.","steps":["أضيفي المنتجات المرغوبة إلى سلة المشتريات.","انتقلي إلى صفحة إتمام الطلب واختاري محافظتكِ.","ستحسب المنظومة رسوم الشحن المحددة لعنوانكِ وتظهر في إجمالي الفاتورة."],"links":[{"title":"الذهاب إلى سلة الشراء","url":"https://dandy-ebon.vercel.app/cart","isExternal":false}]},"relatedIds":["shipping-free","shipping-governorates"],"enabled":true,"order":3},{"id":"shipping-free","categoryId":"shipping-delivery","title":"سياسة الشحن المجاني","question":"هل يتوفر شحن مجاني، وما هو الحد الأدنى؟","alternativeQuestions":["ازاي اخد شحن مجاني؟","هل التوصيل مجاني؟","شحن مجانا","الحد الأدنى للشحن المجاني","امتى بيكون الشحن مجاني؟","free shipping"],"keywords":["شحن مجاني","شحن مجانا","توصيل مجاني","2000","2000 ج.م","عرض الشحن المجاني"],"synonyms":["من غير مصاريف شحن","ببلاش"],"answer":{"text":"نعم! يمنح متجر DANDY شحنًا مجانيًا بالكامل لجميع محافظات مصر عندما تتجاوز القيمة الإجمالية للمنتجات في سلتكِ 2,000 جنيه مصري. يُطبق الخصم تلقائياً عند الدفع بدون الحاجة لكوبون.","links":[{"title":"تصفح العروض الخاصة للتوفير","url":"https://dandy-ebon.vercel.app/special-offers","isExternal":false},{"title":"جميع المنتجات","url":"https://dandy-ebon.vercel.app/all-products","isExternal":false}]},"relatedIds":["shipping-fees","shipping-delivery-time"],"enabled":true,"order":4},{"id":"shipping-when-arrives","categoryId":"shipping-delivery","title":"متى يصل الأوردر الخاص بي؟","question":"متى سيصل الأوردر بالتحديد بعد الشحن؟","alternativeQuestions":["طلبي هيوصل امتى؟","ميعاد استلام الشحنة","الوقت المتوقع لوصول المندوب","متى يصل المندوب؟"],"keywords":["موعد الوصول","استلام الطلب","المندوب","توقيت التوصيل"],"synonyms":["هيوصل امتى","ميعاد الاستلام"],"answer":{"text":"يقوم مندوب شركة الشحن بالاتصال بكِ هاتفياً في يوم التوصيل لتنسيق الموعد المناسب قبل الوصول إلى عنوانكِ. مدة التوصيل تتراوح بين يومين إلى 5 أيام عمل، ويمكنكِ دائماً متابعة الشحنة برقم التتبع.","links":[{"title":"رابط تتبع الطلب","url":"https://dandy-ebon.vercel.app/track-order","isExternal":false}]},"relatedIds":["shipping-delivery-time","shipping-delayed"],"enabled":true,"order":5},{"id":"shipping-delayed","categoryId":"shipping-delivery","title":"التعامل مع تأخر وصول الشحنة","question":"طلبي تأخر عن موعده المحدد، ماذا أفعل؟","alternativeQuestions":["الاوردر اتأخر","الشحنة متأخرة بقالها كتير","فات 5 ايام والطلب موصلش","الشحنة معلقة","ليه الطلب اتأخر؟"],"keywords":["تأخر الطلب","الشحنة متأخرة","تأخير الشحن","تأخر التوصيل","شكوى تأخير"],"synonyms":["اتأخر","مجاش في الميعاد","مستني من بدري"],"answer":{"text":"إذا تجاوز طلبكِ مدة 5 أيام عمل المعتمدة، نعتذر عن أي تأخير خارج عن إرادتنا. يُرجى مراجعة صفحة التتبع أولاً، أو إرسال رقم الطلب فوراً لفريق دعم العملاء عبر واتساب 01038941005 للتدخل مع شركة الشحن وتسريع التسليم.","steps":["افحصي حالة الشحنة عبر صفحة التتبع.","تجهيز رقم الطلب المرجعي.","تواصلي مع موظف DANDY عبر واتساب لمتابعة خط سير المندوب."],"links":[{"title":"تتبع حالة الشحنة","url":"https://dandy-ebon.vercel.app/track-order","isExternal":false},{"title":"التواصل الفوري مع الدعم عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["track-how-to","store-contact-support"],"enabled":true,"order":6},{"id":"shipping-courier-tracking","categoryId":"shipping-delivery","title":"كيف أتابع الشحنة مع شركة الشحن؟","question":"كيف يمكنني متابعة الشحنة مع شركة التوصيل والمندوب؟","alternativeQuestions":["رقم المندوب","ازاي اتواصل مع شركة الشحن؟","متابعة المندوب","معرفة شركة الشحن"],"keywords":["شركة الشحن","المندوب","توصيل الشحنة","متابعة المندوب"],"synonyms":["رقم الدليفري","مين بيوصل"],"answer":{"text":"تتعامل DANDY مع شركات شحن احترافية تقوم بإرسال رسالة نصية (SMS) أو رسالة واتساب تحتوي على رقم بوليصة الشحن، كما يتصل بكِ المندوب مباشرة قبل التوجه لعنوانكِ. يمكنكِ أيضاً متابعة الخطوات عبر صفحة التتبع الرسمية.","links":[{"title":"صفحة تتبع الطلبات","url":"https://dandy-ebon.vercel.app/track-order","isExternal":false}]},"relatedIds":["track-how-to","shipping-delivery-time"],"enabled":true,"order":7},{"id":"shipping-damaged-arrival","categoryId":"shipping-delivery","title":"وصول الشحنة تالفة أو مفتوحة","question":"ماذا أفعل إذا وصلت شحنتي تالفة أو العبوة مفتوحة؟","alternativeQuestions":["المنتج وصل مكسور","الكرتونة مفتوحة وتالفة","الشحنة متبهدلة","استلمت منتج تالف او مسرب","المنتج متضرر من الشحن"],"keywords":["تالف","مكسور","شحنة تالفة","تسريب","ضرر الشحن","علبة مفتوحة"],"synonyms":["باظت في الشحن","الكرتونة مقطوعة","متكسر"],"answer":{"text":"سلامة منتجاتكِ هي أولويتنا القصوى! إذا لاحظتِ أي تلف خارجي أو كسر أو فتح للعبوة أثناء الاستلام، يُرجى تصوير الشحنة والتواصل فوراً مع خدمة عملاء DANDY عبر واتساب لمراجعة الحالة واتخاذ الإجراء اللازم بعد تدقيق التفاصيل.","steps":["التقاط صور أو فيديو واضح للمنتج والتغليف المتضرر.","الاحتفاظ بكافة العبوات والملصقات الأصلية.","إرسال الصور مع رقم الطلب إلى واتساب 01038941005 لمراجعة الشكوى."],"links":[{"title":"إرسال صور الشحنة للدعم عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["returns-damaged-policy","returns-contact-support"],"enabled":true,"order":8},{"id":"track-how-to","categoryId":"order-tracking","title":"كيف أتتبع طلبي عبر الموقع؟","question":"كيف يمكنني تتبع طلبي ومعرفة أين وصل؟","alternativeQuestions":["عايز اتابع الأوردر","طلبي وصل لفين؟","فين الشحنة بتاعتي؟","ازاي اتتبع الطلب؟","Track my order","متابعة الشحنة"],"keywords":["تتبع","تتبع الطلب","متابعة الشحنة","track order","track-order","اين طلبي"],"synonyms":["الاوردر فين","وصل فين","مكان الشحنة"],"answer":{"text":"يمكنكِ تتبع خط سير شحنتكِ ومعرفة حالتها لحظة بلحظة عبر صفحة التتبع الرسمية في موقع DANDY. لن تحتاجي لمشاركة أي بيانات حساسة هنا داخل المساعد؛ فقط افتحي رابط التتبع وأدخلي رقم طلبكِ.","steps":["افتحي صفحة تتبع الطلبات الرسمية في متجر DANDY.","أدخلي رقم الطلب الخاص بكِ واضغطي زر 'تتبع'.","ستظهر لكِ كافة تفاصيل خط السير الحالي للشحنة."],"links":[{"title":"الانتقال لصفحة تتبع الطلب الرسمية","url":"https://dandy-ebon.vercel.app/track-order","isExternal":false}]},"relatedIds":["track-find-info","track-status-not-changing"],"enabled":true,"order":1},{"id":"track-find-info","categoryId":"order-tracking","title":"أين أجد رقم التتبع وبيانات الشحنة؟","question":"أين يمكنني العثور على رقم الطلب أو رقم التتبع؟","alternativeQuestions":["فين رقم الاوردر؟","رقم التتبع اجيبه منين؟","كود الشحنة فين؟","مش لاقي رقم الطلب","اين اجد كود التتبع؟"],"keywords":["رقم الطلب","رقم التتبع","كود الشحنة","order number","tracking number"],"synonyms":["رقم الاوردر","كود الاوردر"],"answer":{"text":"يتم عرض رقم الطلب مباشرة على شاشة الموقع فور إتمام الشراء، كما يظهر أيضاً في صفحة حسابكِ الشخصي ضمن قائمة طلباتي، وفي رسالة تأكيد الطلب المرسلة إليكِ.","links":[{"title":"صفحة حسابي وقائمة الطلبات","url":"https://dandy-ebon.vercel.app/account","isExternal":false},{"title":"صفحة تتبع الطلب","url":"https://dandy-ebon.vercel.app/track-order","isExternal":false}]},"relatedIds":["track-how-to","account-view-orders"],"enabled":true,"order":2},{"id":"track-page-issue","categoryId":"order-tracking","title":"صفحة التتبع لا تعمل أو لا تفتح","question":"ماذا أفعل إذا كانت صفحة تتبع الطلب لا تفتح أو لا تستجيب؟","alternativeQuestions":["صفحة التتبع مش شغالة","مش عارف اتتبع الطلب","رابط التتبع فيه مشكلة","صفحة تتبع الاوردر بتعلق","عطل في صفحة التتبع"],"keywords":["مشكلة التتبع","صفحة التتبع لا تعمل","عطل التتبع","تتبع لا يعمل"],"synonyms":["اللينك مش شغال","مش راضي يفتح"],"answer":{"text":"إذا واجهتِ أي صعوبة في فتح صفحة التتبع أو لم تظهر النتائج، يُرجى التأكد من كتابة رقم الطلب بالأرقام الإنجليزية بدون مسافات، أو تجربة تحديث الصفحة. إذا استمرت المشكلة، يُرجى إرسال رقم الطلب لموظف خدمة العملاء عبر واتساب للاستعلام لكِ فوراً.","links":[{"title":"مساعدة من خدمة العملاء عبر واتساب","url":"https://wa.me/201038941005","isExternal":true},{"title":"إعادة فتح صفحة التتبع","url":"https://dandy-ebon.vercel.app/track-order","isExternal":false}]},"relatedIds":["track-how-to","store-contact-support"],"enabled":true,"order":3},{"id":"track-status-not-changing","categoryId":"order-tracking","title":"حالة الطلب لم تتغير منذ فترة","question":"حالة طلبي في صفحة التتبع ثابتة ولم تتغير، ما السبب؟","alternativeQuestions":["حالة الاوردر مش بتتغير","الطلب لسه قيد التجهيز من زمان","حالة الشحنة ثابتة","ليه حالة الطلب واقفة؟","الاوردر معلق في التجهيز"],"keywords":["حالة الطلب","قيد التجهيز","لم تتغير","حالة الشحنة","معلق"],"synonyms":["واقف مكانه","متغيرش"],"answer":{"text":"أحياناً يستغرق تحديث النظام بين شركة الشحن والمستودع بضع ساعات خاصة في أوقات الذروة أو العطلات الأسبوعية. طالما أن الطلب داخل فترة 2 إلى 5 أيام عمل، فالشحنة في طريقها إليكِ. للمزيد من الاطمئنان، تواصلي مع خدمة العملاء.","links":[{"title":"الاستفسار عن حالة الطلب عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["shipping-delivery-time","shipping-delayed"],"enabled":true,"order":4},{"id":"track-shipment-not-arrived","categoryId":"order-tracking","title":"شحنتي لم تصل بعد انتهاء المدة المحددة","question":"انتهت مدة التوصيل المتوقعة ولم تصلني الشحنة، ماذا أفعل؟","alternativeQuestions":["الشحنة لسه موصلتش","عدت المدة والاوردر مجاش","الاوردر ضاع ولا ايه؟","مستلمتش الشحنة ومحدش اتصل بيا","الطلب لم يصل"],"keywords":["لم تصل","الشحنة لم تصل","تأخر الاستلام","محدش اتصل","شكوى عدم استلام"],"synonyms":["مجاش","الطلب مجاليش","فين حاجتي"],"answer":{"text":"نأسف جداً لأي قلق. يُرجى التواصل الفوري مع فريق خدمة عملاء DANDY عبر واتساب مع تزويدهم برقم الطلب. سيقوم ممثل الخدمة بفتح تذكرة متابعة عاجلة مع مندوب التوصيل لمعرفة مكان الشحنة وتسليمها لكِ في أسرع وقت.","links":[{"title":"تواصل فوري مع الدعم عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["shipping-delayed","store-contact-support"],"enabled":true,"order":5},{"id":"prod-find-product","categoryId":"products-care","title":"البحث عن منتج معين في المتجر","question":"كيف أبحث عن منتج معين داخل متجر DANDY؟","alternativeQuestions":["ازاي الاقي منتج معين؟","طريقة البحث عن المنتجات","عايز ادور على منتج","البحث في الموقع","كيف اجد منتج؟"],"keywords":["بحث عن منتج","تصفح المنتجات","المنتجات","all products","ايجاد منتج"],"synonyms":["ادور على","عايز اشتري منتج معين"],"answer":{"text":"يمكنكِ استخدام شريط البحث الموجود أعلى متجر DANDY لكتابة اسم المنتج أو الماركة، أو تصفح قائمة 'جميع المنتجات' وتصفيتها حسب القسم المناسب.","links":[{"title":"تصفح جميع منتجات DANDY","url":"https://dandy-ebon.vercel.app/all-products","isExternal":false}]},"relatedIds":["prod-categories-available","prod-hair-care"],"enabled":true,"order":1},{"id":"prod-categories-available","categoryId":"products-care","title":"الأقسام المتاحة في DANDY","question":"ما هي الأقسام وفئات المنتجات المتوفرة في المتجر؟","alternativeQuestions":["ايه الاقسام اللي عندكم؟","بتبيعوا ايه في DANDY؟","فئات المنتجات","اقسام المتجر","ما هي تصنيفات المنتجات؟"],"keywords":["اقسام","تصنيفات","فئات","منتجات dandy","عناية وجمال"],"synonyms":["بتبيعوا ايه","منتجاتكم ايه"],"answer":{"text":"يضم متجر DANDY أربعة أقسام رئيسية للعناية والجمال:","steps":["قسم العناية بالشعر (Hair Care).","قسم العناية بالبشرة (Skin Care).","قسم العناية بالجسم (Body Care).","قسم العطور الفاخرة (Fragrance)."],"links":[{"title":"تصفح جميع المنتجات","url":"https://dandy-ebon.vercel.app/all-products","isExternal":false}]},"relatedIds":["prod-hair-care","prod-skin-care","prod-body-care","prod-fragrance"],"enabled":true,"order":2},{"id":"prod-hair-care","categoryId":"products-care","title":"منتجات العناية بالشعر","question":"أين أجد منتجات العناية بالشعر في DANDY؟","alternativeQuestions":["منتجات الشعر فين؟","عايز حاجات للشعر","شامبو وبلسم وسيروم","قسم العناية بالشعر","hair care"],"keywords":["شعر","عناية بالشعر","شامبو","بلسم","سيروم","ماسك شعر","hair care"],"synonyms":["منتجات الشعر","شعر صحي"],"answer":{"text":"يحتوي قسم العناية بالشعر في DANDY على تشكيلة متميزة من الشامبوهات، البلسم، السيرومات، والزيوت المعالجة لجميع أنواع الشعر (الجاف، الدهني، المصبوغ، والمجعد).","links":[{"title":"تصفح قسم العناية بالشعر","url":"https://dandy-ebon.vercel.app/category/hair-care","isExternal":false}]},"relatedIds":["prod-skin-care","prod-body-care"],"enabled":true,"order":3},{"id":"prod-skin-care","categoryId":"products-care","title":"منتجات العناية بالبشرة","question":"أين أجد منتجات العناية بالبشرة في المتجر؟","alternativeQuestions":["منتجات البشرة فين؟","عايز غسول ومرطب","قسم العناية بالبشرة","كريمات وسيرومات الوجه","skin care"],"keywords":["بشرة","عناية بالبشرة","غسول","مرطب","سيروم وجه","واقي شمس","skin care"],"synonyms":["كريمات وجه","منتجات الوجه"],"answer":{"text":"يقدم قسم العناية بالبشرة حلولاً متكاملة لنضارة وترطيب البشرة، بما في ذلك الغسولات اللطيفة، المرطبات اليومية، سيرومات الهيالورونيك وفيتامين سي، ومستحضرات الحماية.","links":[{"title":"تصفح قسم العناية بالبشرة","url":"https://dandy-ebon.vercel.app/category/skin-care","isExternal":false}]},"relatedIds":["prod-hair-care","prod-body-care"],"enabled":true,"order":4},{"id":"prod-body-care","categoryId":"products-care","title":"منتجات العناية بالجسم","question":"أين أجد منتجات العناية بالجسم والترطيب؟","alternativeQuestions":["منتجات الجسم فين؟","لوشن وشاور جيل","قسم العناية بالجسم","مرطبات الجسم وسكراب","body care"],"keywords":["جسم","عناية بالجسم","لوشن","شاور جل","سكراب","ترطيب الجسم","body care"],"synonyms":["منتجات الجسم","كريمات الجسم"],"answer":{"text":"يتضمن قسم العناية بالجسم مستحضرات الاستحمام، غسول الجسم (Body Wash)، اللوشن المرطب، والمقشرات الطبيعية لتمنحكِ ملمساً ناعماً وعطراً يدوم طويلاً.","links":[{"title":"تصفح قسم العناية بالجسم","url":"https://dandy-ebon.vercel.app/category/body-care","isExternal":false}]},"relatedIds":["prod-skin-care","prod-fragrance"],"enabled":true,"order":5},{"id":"prod-fragrance","categoryId":"products-care","title":"قسم العطور الفاخرة","question":"كيف أتصفح قسم العطور ومجموعات الروائح؟","alternativeQuestions":["قسم العطور فين؟","عايز برفان او عطر","عطور DANDY","عطور نسائية ورجالية","fragrance","perfume"],"keywords":["عطور","عطر","برفان","روائح","معطر","fragrance","perfume"],"synonyms":["برفانات","ريحة حلوة"],"answer":{"text":"يحتوي قسم العطور في DANDY على باقة من أرقى الروائح والعطور المختارة بعناية وثبات عالٍ لتناسب مختلف الأذواق والمناسبات.","links":[{"title":"تصفح قسم العطور","url":"https://dandy-ebon.vercel.app/category/fragrance","isExternal":false}]},"relatedIds":["prod-body-care","prod-offers"],"enabled":true,"order":6},{"id":"prod-offers","categoryId":"products-care","title":"العروض الحالية والتخفيضات","question":"كيف أصل إلى العروض الحالية والخصومات في DANDY؟","alternativeQuestions":["في عروض دلوقتي؟","فين صفحة الخصومات؟","عايز اعرف احدث التخفيضات","عروض التوفير","special offers","discounts"],"keywords":["عروض","خصومات","تخفيضات","عروض خاصة","special-offers","توفير"],"synonyms":["اوفرات","تخفيض","سيل","sale"],"answer":{"text":"يمكنكِ الاستفادة من أقوى العروض والخصومات المتاحة حالياً عبر زيارة صفحة 'العروض الخاصة' الرسمية على موقع DANDY المتجددة دورياً.","links":[{"title":"صفحة العروض الخاصة","url":"https://dandy-ebon.vercel.app/special-offers","isExternal":false}]},"relatedIds":["shipping-free","prod-find-product"],"enabled":true,"order":7},{"id":"prod-details-info","categoryId":"products-care","title":"كيف أعرف تفاصيل ومكونات المنتج؟","question":"كيف أعرف حجم ومكونات وطريقة استخدام المنتج؟","alternativeQuestions":["ازاي اعرف مكونات المنتج؟","حجم العبوة كام مل؟","طريقة استخدام المنتج","تفاصيل المنتج"],"keywords":["مكونات","حجم المنتج","طريقة الاستخدام","تفاصيل المنتج","ingredients"],"synonyms":["المكونات","حجم العلبة"],"answer":{"text":"عند الضغط على أي منتج لفتح صفحته المخصصة، ستجدين وصفاً شاملاً يوضح الحجم بالمليلتر، المكونات الأساسية، وطريقة الاستخدام الصحيحة الموصى بها.","links":[{"title":"تصفح المنتجات للاطلاع على التفاصيل","url":"https://dandy-ebon.vercel.app/all-products","isExternal":false}]},"relatedIds":["prod-find-product","prod-choose-help"],"enabled":true,"order":8},{"id":"prod-choose-help","categoryId":"products-care","title":"كيف أختار المنتج المناسب لاحتياجاتي؟","question":"كيف يمكنني اختيار المنتج الأنسب لنوع بشرتي أو شعري؟","alternativeQuestions":["مش عارف اختار ايه","ازاي اختار المنتج المناسب؟","ترشيحات منتجات","نصيحة لاختيار المنتج"],"keywords":["اختيار المنتج","نوع البشرة","نوع الشعر","ترشيح","استشارة"],"synonyms":["تنصحوني بايه","ايه المناسب ليا"],"answer":{"text":"تعتمد المنتجات المناسبة على نوع بشرتكِ (جافة، دهنية، مختلطة، أو حساسة) أو طبيعة شعركِ. يمكنكِ قراءة الوصف الدقيق في صفحة كل منتج، أو استشارة فريق خدمة العملاء عبر واتساب لمساعدتكِ في الاختيار.","links":[{"title":"استشارة خدمة العملاء عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["prod-details-info","store-contact-support"],"enabled":true,"order":9},{"id":"prod-original-guarantee","categoryId":"products-care","title":"أصل وجودة منتجات DANDY","question":"هل جميع المنتجات المعروضة في المتجر أصلية 100%؟","alternativeQuestions":["هل المنتجات أصلية؟","جودة المنتجات","ضمان الأصالة","المنتجات تقليد ولا اوريجينال؟","original products"],"keywords":["منتجات أصلية","أصلية 100%","جودة المنتجات","ضمان الجودة","اوريجينال"],"synonyms":["اصلية","مش تقليد","مضمونة"],"answer":{"text":"نعم، يلتزم متجر DANDY بتقديم منتجات ومستحضرات تجميل وعناية أصلية وعالية الجودة من مصادر معتمدة وموثوقة لضمان أفضل تجربة لعملائنا.","links":[{"title":"تصفح جميع المنتجات المعتمدة","url":"https://dandy-ebon.vercel.app/all-products","isExternal":false}]},"relatedIds":["prod-find-product","store-about-dandy"],"enabled":true,"order":10},{"id":"pay-methods-available","categoryId":"payments-returns","title":"طرق الدفع المتاحة في المتجر","question":"ما هي طرق الدفع المتاحة لإتمام الطلب؟","alternativeQuestions":["ازاي ادفع؟","طرق السداد المتاحة","هل في دفع عند الاستلام؟","الدفع بالفيزا ولا كاش؟","payment methods","طرق الدفع"],"keywords":["طرق الدفع","الدفع","كاش","فيزا","الدفع عند الاستلام","سداد","payment"],"synonyms":["طريقة الدفع","ادفع ازاي","فلوس"],"answer":{"text":"تظهر لكِ طرق الدفع المتاحة والمفعلة لطلبكِ وعنوانكِ مباشرة أثناء خطوة الدفع (Checkout) في المتجر قبل تأكيد الشراء. في حال كان لديكِ استفسار محدد بخصوص وسيلة دفع معينة، يمكنكِ التواصل مع خدمة العملاء للتأكيد.","steps":["أضيفي منتجاتكِ للسلة واضغطي إتمام الطلب.","أدخلي عنوان التوصيل بالتفصيل.","اختاري وسيلة الدفع من الخيارات الظاهرة أمامكِ في الشاشة."],"links":[{"title":"سلة المشتريات والدفع","url":"https://dandy-ebon.vercel.app/cart","isExternal":false},{"title":"الاستفسار عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["order-checkout-process","store-contact-support"],"enabled":true,"order":1},{"id":"returns-can-i-return","categoryId":"payments-returns","title":"إمكانية استرجاع المنتجات","question":"هل يمكنني إرجاع منتج بعد استلامه؟","alternativeQuestions":["عايز ارجع منتج","هل ينفع استرجع الطلب؟","سياسة الاسترجاع","طريقة ترجيع المنتج","return product"],"keywords":["استرجاع","ارجاع","ترجيع منتج","سياسة الاسترجاع","returns"],"synonyms":["ارجع الطلب","ارجاع الشحنة"],"answer":{"text":"تخضع منتجات العناية الشخصية والتجميل لضوابط صحية دقيقة لحماية جميع العملاء. يُشترط عموماً أن يكون المنتج بحالته الأصلية غير مفتوح ومغلفاً بالكامل. نظراً لأن كل حالة تتطلب فحصاً ومراجعة من فريق الجودة، يُرجى التواصل الفوري مع خدمة عملاء DANDY عبر واتساب لفحص طلبكِ وتوجيهكِ بالإجراء المعتمد.","steps":["تجهيز رقم الطلب المرجعي وصورة المنتج.","التواصل مع خدمة العملاء عبر واتساب 01038941005.","مراجعة الحالة من قبل فريق الدعم وفق شروط الفحص المعتمدة."],"links":[{"title":"التواصل مع الدعم بخصوص الاسترجاع","url":"https://wa.me/201038941005","isExternal":true},{"title":"الشروط والأحكام","url":"https://dandy-ebon.vercel.app/terms","isExternal":false}]},"relatedIds":["returns-can-i-exchange","returns-contact-support"],"enabled":true,"order":2},{"id":"returns-can-i-exchange","categoryId":"payments-returns","title":"إمكانية استبدال المنتجات","question":"هل يمكنني استبدال منتج بمنتج آخر؟","alternativeQuestions":["عايز ابدل منتج","هل في استبدال؟","طريقة استبدال المنتج","تغيير المنتج بعد الاستلام","exchange product"],"keywords":["استبدال","تبديل منتج","تغيير المنتج","exchange"],"synonyms":["ابدل","تغيير"],"answer":{"text":"إمكانية الاستبدال تتطلب مراجعة من فريق خدمة العملاء للتأكد من حالة المنتج وتوفر البديل المناسب. يُرجى عدم فتح المنتج أو استخدام غلافه والتواصل مع الدعم عبر واتساب لشرح رغبتكِ ومراجعة الترتيبات المتاحة.","links":[{"title":"محادثة الدعم عبر واتساب بخصوص الاستبدال","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["returns-can-i-return","returns-contact-support"],"enabled":true,"order":3},{"id":"returns-wrong-product","categoryId":"payments-returns","title":"استلام منتج خاطئ أو غير مطابق","question":"ماذا أفعل إذا استلمت منتجاً مختلفاً عن طلبي؟","alternativeQuestions":["الاوردر جالي غلط","استلمت حاجة تانية غير اللي طلبتها","المنتج غير مطابق","اوردر مش بتاعي","wrong item"],"keywords":["منتج خاطئ","غير مطابق","اوردر غلط","منتج مختلف","خطأ في الطلب"],"synonyms":["جالي غلط","مش طلبي"],"answer":{"text":"نعتذر بشدة عن هذا الخطأ النادر! يُرجى تصوير المنتج المستلم مع ملصق الشحنة والتواصل الفوري مع خدمة عملاء DANDY عبر واتساب 01038941005، وسيتولى الفريق مراجعة الأمر وتصحيح الخطأ بأسرع وقت ممكن.","steps":["تصوير المنتج المستلم بجانب بوليصة الشحن.","إبقاء المنتج في عبوته الأصلية دون فتح أو استخدام.","إرسال الصور مع رقم الطلب لواتساب الدعم للمراجعة والتصحيح."],"links":[{"title":"إرسال صورة الخطأ عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["returns-damaged-policy","returns-contact-support"],"enabled":true,"order":4},{"id":"returns-damaged-policy","categoryId":"payments-returns","title":"وصول منتج متضرر أو به عيب مصنعي","question":"ماذا لو وصلني منتج تالف أو مكسور أو به تسريب؟","alternativeQuestions":["المنتج فيه عيب","العلبة مكسورة او مسربة","وصلني منتج متضرر","تلف بالمنتج","damaged item"],"keywords":["منتج تالف","تسريب","كسر","عيب مصنعي","متضرر"],"synonyms":["باظ","مكسور"],"answer":{"text":"نحرص على أعلى معايير الجودة والتغليف. في حال وصول أي منتج متضرر، يُرجى تصوير الضرر بوضوح والتواصل فوراً مع خدمة العملاء عبر واتساب حتى يقوم الفريق بمراجعة الحالة واتخاذ الإجراء المناسب وفق سياسة فحص المتجر.","links":[{"title":"إرسال صور المنتج المتضرر للدعم","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["shipping-damaged-arrival","returns-contact-support"],"enabled":true,"order":5},{"id":"returns-contact-support","categoryId":"payments-returns","title":"كيف أتواصل مع الدعم لطلب استرجاع أو استبدال؟","question":"ما هي خطوات التواصل مع خدمة العملاء بخصوص الاسترجاع؟","alternativeQuestions":["ازاي اكلم الدعم عشان ارجع؟","طريقة تقديم طلب استرجاع","تواصل مع خدمة العملاء للمرتجعات","خطوات تقديم شكوى او استرجاع"],"keywords":["طلب استرجاع","خدمة العملاء للمرتجعات","شكوى استرجاع","تواصل استرجاع"],"synonyms":["اكلم مين عشان ارجع","رقم المرتجعات"],"answer":{"text":"التواصل متاح ومباشر عبر رقم واتساب الرسمي 01038941005 يومياً من 10:00 صباحاً حتى 10:00 مساءً بتوقيت القاهرة. ما عليكِ سوى إرسال رقم الطلب وصورة المنتج وشرح سبب الاستفسار.","links":[{"title":"فتح محادثة واتساب الرسمية","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["returns-can-i-return","store-contact-support"],"enabled":true,"order":6},{"id":"returns-refund-query","categoryId":"payments-returns","title":"الاستفسار عن استرداد المبلغ (Refund)","question":"كيف أستفسر عن استرداد المبالغ المدفوعة؟","alternativeQuestions":["الفلوس هترجع امتى؟","طريقة استرداد الفلوس","استرجاع المبلغ المدفوع","استرداد الفاتورة","refund"],"keywords":["استرداد المبلغ","استرجاع الفلوس","refund","استرداد مالي","تحويل الفلوس"],"synonyms":["فلوسي هترجع امتى","ترجيع الفلوس"],"answer":{"text":"في الحالات التي توافق فيها إدارة خدمة العملاء على استرداد المبلغ بعد مراجعة وفحص المرتجع، يتم التنسيق معكِ مباشرة بشأن آلية ووقت رد المبلغ وفقاً لوسيلة الدفع المتبعة. يُرجى متابعة حالتكِ مع فريق الدعم عبر واتساب.","links":[{"title":"متابعة حالة الاسترداد عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["returns-can-i-return","returns-contact-support"],"enabled":true,"order":7},{"id":"account-create-new","categoryId":"account-user","title":"كيف أنشئ حساباً جديداً على DANDY؟","question":"كيف أقوم بإنشاء حساب جديد في متجر DANDY؟","alternativeQuestions":["ازاي اعمل اكونت جديد؟","طريقة التسجيل في الموقع","انشاء حساب","تسجيل مستخدم جديد","sign up","create account"],"keywords":["انشاء حساب","تسجيل جديد","حساب جديد","sign up","تسجيل"],"synonyms":["اعمل حساب","تسجيل عضوية"],"answer":{"text":"يمكنكِ إنشاء حسابكِ الشخصي بخطوات بسيطة عبر صفحة التسجيل الرسمية في DANDY للاستمتاع بحفظ عناوينكِ وتتبع طلباتكِ بسرعة وسهولة.","steps":["افتحي صفحة التسجيل عبر الرابط أدناه.","أدخلي اسمكِ، البريد الإلكتروني، وكلمة المرور المطلوبة.","اضغطي 'إنشاء حساب' للبدء فوراً."],"links":[{"title":"صفحة إنشاء حساب جديد","url":"https://dandy-ebon.vercel.app/account-signup","isExternal":false}]},"relatedIds":["account-login-how","account-benefits"],"enabled":true,"order":1},{"id":"account-login-how","categoryId":"account-user","title":"كيف أسجل الدخول إلى حسابي؟","question":"كيف أقوم بتسجيل الدخول إلى حسابي في الموقع؟","alternativeQuestions":["ازاي ادخل على حسابي؟","تسجيل الدخول","دخول الموقع","login","sign in"],"keywords":["تسجيل الدخول","دخول","login","sign in","حسابي"],"synonyms":["ادخل الاكونت","افتح حسابي"],"answer":{"text":"لتسجيل الدخول، اضغطي على أيقونة الحساب أعلى الصفحة أو افتحي صفحة تسجيل الدخول، وأدخلي بريدكِ الإلكتروني وكلمة المرور.","links":[{"title":"صفحة تسجيل الدخول","url":"https://dandy-ebon.vercel.app/account-login","isExternal":false}]},"relatedIds":["account-forgot-password","account-create-new"],"enabled":true,"order":2},{"id":"account-forgot-password","categoryId":"account-user","title":"نسيت كلمة المرور الخاصة بحسابي","question":"نسيت كلمة المرور، كيف يمكنني استعادتها أو تعيينها؟","alternativeQuestions":["مش فاكر الباسورد","استعادة كلمة المرور","تغيير الباسورد","نسيان كلمة السر","forgot password"],"keywords":["نسيت كلمة المرور","استعادة كلمة المرور","الباسورد","كلمة السر","forgot password"],"synonyms":["مش فاكر الباسورد","تغيير الباسورد"],"answer":{"text":"في صفحة تسجيل الدخول، اضغطي على رابط 'نسيت كلمة المرور؟'. سيُطلب منكِ إدخال بريدكِ الإلكتروني المسجل لإرسال رابط إعادة تعيين كلمة المرور فوراً.","links":[{"title":"صفحة تسجيل الدخول واستعادة المرور","url":"https://dandy-ebon.vercel.app/account-login","isExternal":false}]},"relatedIds":["account-login-how","account-trouble-signing-in"],"enabled":true,"order":3},{"id":"account-view-orders","categoryId":"account-user","title":"كيف أصل إلى صفحة حسابي الشخصي؟","question":"كيف أصل إلى لوحة التحكم الخاصة بحسابي ومشترياتي؟","alternativeQuestions":["صفحة حسابي الشخصي","بيانات حسابي","تعديل بيانات الحساب","my account"],"keywords":["حسابي","بياناتي","الملف الشخصي","my account"],"synonyms":["الاكونت بتاعي","صفحتي"],"answer":{"text":"يمكنكِ الوصول إلى صفحة حسابكِ في أي وقت عبر الرابط الرسمي لحساب DANDY لمراجعة سجل طلباتكِ وعناوينكِ المسجلة.","links":[{"title":"الانتقال لصفحة حسابي","url":"https://dandy-ebon.vercel.app/account","isExternal":false}]},"relatedIds":["account-update-info","order-review-details"],"enabled":true,"order":4},{"id":"account-update-info","categoryId":"account-user","title":"تعديل البيانات وعنوان التوصيل","question":"كيف أعدل بياناتي الشخصية أو عنوان التوصيل المحفوظ؟","alternativeQuestions":["ازاي اغير العنوان المحفوظ؟","تعديل رقم التليفون في الحساب","تحديث بيانات الملف الشخصي","تغيير اسم المستخدم"],"keywords":["تعديل البيانات","تغيير العنوان","تحديث العنوان","الملف الشخصي"],"synonyms":["اغير عنواني","تحديث التليفون"],"answer":{"text":"من داخل صفحة 'حسابي'، يمكنكِ تعديل اسمكِ، رقم هاتفكِ، وعناوين التوصيل المسجلة لتسهيل عمليات الشراء القادمة تلقائياً.","links":[{"title":"تعديل بيانات الحساب","url":"https://dandy-ebon.vercel.app/account","isExternal":false}]},"relatedIds":["account-view-orders","order-modify-request"],"enabled":true,"order":5},{"id":"account-trouble-signing-in","categoryId":"account-user","title":"مشكلات تسجيل الدخول","question":"أواجه مشكلة ولا أستطيع تسجيل الدخول إلى حسابي؟","alternativeQuestions":["مش عارف اسجل دخول","مشكلة في تسجيل الدخول","الاكونت مش راضي يفتح","خطأ في كلمة المرور او الايميل","login error"],"keywords":["مشكلة دخول","خطأ تسجيل الدخول","تعذر الدخول","login issue"],"synonyms":["مش راضي يدخل","الايميل غلط"],"answer":{"text":"تأكدي من صحة كتابة البريد الإلكتروني دون فراغات إضافية ومطابقة حالة الحروف لكلمة المرور. إذا استمرت المشكلة، استخدمي خيار استعادة كلمة المرور أو تواصلي مع خدمة العملاء لمساعدتكِ فوراً.","links":[{"title":"استعادة كلمة المرور","url":"https://dandy-ebon.vercel.app/account-login","isExternal":false},{"title":"مساعدة من خدمة العملاء عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["account-forgot-password","store-contact-support"],"enabled":true,"order":6},{"id":"tech-website-not-loading","categoryId":"website-tech-help","title":"الموقع بطيء أو لا يفتح بشكل صحيح","question":"الموقع لا يفتح أو يعرض صفحة بيضاء، ماذا أفعل؟","alternativeQuestions":["الموقع مش شغال","الموقع معلق وبطيء","صفحة بيضاء في الموقع","الموقع مش راضي يحمل","website not loading"],"keywords":["الموقع لا يفتح","مشكلة في الموقع","بطء الموقع","الموقع معلق","خطأ في الصفحة"],"synonyms":["واقف","مش شغال","مش بيفتح"],"answer":{"text":"يُرجى تجربة مسح ذاكرة التخزين المؤقت للمتصفح (Cache) أو فتح الموقع من نافذة تصفح خفي (Incognito) أو التأكد من اتصال الإنترنت لديكِ. إذا استمرت الصعوبة، يمكنكِ التواصل مباشرة عبر واتساب لخدمتكِ.","links":[{"title":"إعادة تحميل متجر DANDY","url":"https://dandy-ebon.vercel.app","isExternal":false},{"title":"الدعم عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["tech-cart-issue","tech-product-page-issue"],"enabled":true,"order":1},{"id":"tech-cart-issue","categoryId":"website-tech-help","title":"مشكلات سلة المشتريات","question":"السلة لا تضيف المنتجات أو تظهر فارغة، كيف أحل المشكلة؟","alternativeQuestions":["السلة مش شغالة","المنتجات مش بتضاف في السلة","السلة بتفضى لوحدها","مشكلة في سلة الشراء","cart not working"],"keywords":["مشكلة السلة","السلة فارغة","لا يمكن الإضافة للسلة","cart error"],"synonyms":["الباسكت مش شغالة","مش راضي يضيف"],"answer":{"text":"تأكدي من تفعيل ملفات تعريف الارتباط (Cookies) وتحديث الصفحة. يمكنكِ أيضاً إفراغ السلة وإضافة المنتج مرة أخرى، أو التأكد من توفر المنتج. إذا استمر العطل، يسعدنا استقبال طلبكِ يدوياً عبر واتساب.","links":[{"title":"صفحة سلة المشتريات","url":"https://dandy-ebon.vercel.app/cart","isExternal":false},{"title":"إتمام الطلب عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["order-add-to-cart","tech-cannot-checkout"],"enabled":true,"order":2},{"id":"tech-product-page-issue","categoryId":"website-tech-help","title":"صفحة المنتج لا تفتح","question":"أضغط على المنتج وصفحته لا تفتح أو تعطي خطأ؟","alternativeQuestions":["صفحة المنتج مش بتفتح","خطأ في صفحة المنتج","مش عارف اشوف المنتج","اللينك بتاع المنتج مش شغال"],"keywords":["صفحة المنتج","عطل صفحة المنتج","خطأ في المنتج","المنتج لا يفتح"],"synonyms":["مش راضي يفتح","الصفحة بايظة"],"answer":{"text":"يمكنكِ العودة لقائمة المنتجات الرئيسية وإعادة فتح المنتج، أو البحث عنه باسمه في شريط البحث. إذا كان المنتج غير متوفر حالياً فقد يكون قيد التحديث في النظام.","links":[{"title":"تصفح قائمة المنتجات","url":"https://dandy-ebon.vercel.app/all-products","isExternal":false}]},"relatedIds":["prod-find-product","tech-website-not-loading"],"enabled":true,"order":3},{"id":"tech-cannot-checkout","categoryId":"website-tech-help","title":"لا أستطيع إتمام عملية الشراء والدفع","question":"أواجه مشكلة في زر إتمام الطلب أو صفحة الدفع لا تكتمل؟","alternativeQuestions":["مش عارف اتمم الشراء","زر اتمام الطلب مش شغال","الدفع مش راضي يكمل","مشكلة في صفحة الشراء","checkout error"],"keywords":["مشكلة اتمام الطلب","فشل الدفع","زر الدفع معلق","checkout fail"],"synonyms":["مش راضي يطلب","الطلب مش بيكمل"],"answer":{"text":"يُرجى التأكد من ملء جميع الحقول الإلزامية (الاسم، رقم الهاتف، المحافظة، والعنوان التفصيلي). في حال تعذر التأكيد، يمكنكِ إرسال المنتجات التي ترغبين بشرائها مباشرة إلى خدمة العملاء عبر واتساب وسنتمم الطلب لكِ فوراً.","links":[{"title":"مساعدة فورية لإتمام الطلب عبر واتساب","url":"https://wa.me/201038941005","isExternal":true},{"title":"مراجعة صفحة السلة","url":"https://dandy-ebon.vercel.app/cart","isExternal":false}]},"relatedIds":["order-checkout-process","tech-cart-issue"],"enabled":true,"order":4},{"id":"tech-general-problem","categoryId":"website-tech-help","title":"مشكلة تقنية عامة في الموقع","question":"أواجه عطلاً تقنياً غير معتاد أثناء استخدام الموقع؟","alternativeQuestions":["في مشكلة في الموقع","عطل تقني","الموقع فيه ايرور","تبليغ عن خطأ في الموقع","technical issue"],"keywords":["مشكلة تقنية","عطل فني","ايرور","خطأ في الموقع","دعم فني"],"synonyms":["الموقع بايظ","فيه مشكلة فنية"],"answer":{"text":"نحرص دائماً على كفاءة الموقع. يُرجى التقاط لقطة شاشة للخطأ وتزويد فريق الدعم الفني بها عبر واتساب أو صفحة التواصل للتعامل معها وتصحيحها فوراً.","links":[{"title":"إبلاغ الدعم الفني عبر واتساب","url":"https://wa.me/201038941005","isExternal":true},{"title":"صفحة اتصل بنا","url":"https://dandy-ebon.vercel.app/contact-us","isExternal":false}]},"relatedIds":["tech-website-not-loading","store-contact-support"],"enabled":true,"order":5},{"id":"tech-contact-support-team","categoryId":"website-tech-help","title":"كيف أتواصل مع الدعم الفني للموقع؟","question":"كيف أتواصل مع الفريق التقني لمتجر DANDY؟","alternativeQuestions":["رقم الدعم الفني","ازاي اكلم قسم الـ IT؟","مساعدة تقنية فورية","تواصل مع ادارة الموقع"],"keywords":["الدعم الفني","تواصل تقني","فريق المساعدة","خدمة تقنية"],"synonyms":["الدعم التقني","فريق البرمجة"],"answer":{"text":"يمكنكِ التواصل مباشرة مع فريق الدعم الفني لـ DANDY عبر واتساب الرسمي 01038941005 أو من خلال صفحة التواصل، وسيقوم الممثل الفني بحل مشكلتكِ في أقرب وقت.","links":[{"title":"تواصل عبر واتساب","url":"https://wa.me/201038941005","isExternal":true},{"title":"مركز المساعدة والدعم","url":"https://dandy-ebon.vercel.app/help","isExternal":false}]},"relatedIds":["store-contact-support","store-hours-info"],"enabled":true,"order":6},{"id":"store-about-dandy","categoryId":"store-info","title":"ما هو متجر DANDY؟","question":"ما هو متجر DANDY وماذا يقدم لعملائه؟","alternativeQuestions":["مين DANDY؟","معلومات عن المتجر","عن متجر DANDY","ما هي خدمات DANDY؟","about dandy"],"keywords":["عن المتجر","من نحن","DANDY","متجر داندي","مستحضرات تجميل","عناية"],"synonyms":["مين انتم","قصة المتجر"],"answer":{"text":"DANDY هو متجر إلكتروني مصري رائد متخصص في تقديم أرقى منتجات العناية بالبشرة، العناية بالشعر، العناية بالجسم، والعطور الفاخرة، ملتزماً بأعلى معايير الجودة والأصالة مع التوصيل لجميع محافظات مصر.","links":[{"title":"تصفح متجر DANDY","url":"https://dandy-ebon.vercel.app","isExternal":false},{"title":"جميع المنتجات","url":"https://dandy-ebon.vercel.app/all-products","isExternal":false}]},"relatedIds":["store-hours-info","store-contact-support"],"enabled":true,"order":1},{"id":"store-hours-info","categoryId":"store-info","title":"مواعيد وساعات عمل خدمة العملاء","question":"ما هي ساعات ومواعيد العمل الرسمية لفريق خدمة العملاء؟","alternativeQuestions":["شغالين امتى؟","مواعيد العمل","خدمة العملاء شغالة لحد الساعة كام؟","ساعات العمل الرسمية","working hours"],"keywords":["مواعيد العمل","ساعات العمل","خدمة العملاء","توقيت العمل","ايام العمل","10:00"],"synonyms":["فاتحين امتى","شغالين لغاية كام"],"answer":{"text":"فريق خدمة عملاء متجر DANDY متواجد ومتاح لخدمتكِ ومساعدتكِ طوال أيام الأسبوع من الساعة 10:00 صباحًا حتى 10:00 مساءً (بتوقيت القاهرة المحلي).","links":[{"title":"التواصل الفوري عبر واتساب","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["store-contact-support","store-whatsapp-direct"],"enabled":true,"order":2},{"id":"store-contact-support","categoryId":"store-info","title":"كيف أتواصل مع خدمة عملاء DANDY؟","question":"ما هي قنوات وأرقام التواصل الرسمية مع فريق الدعم؟","alternativeQuestions":["رقم خدمة العملاء","ازاي اكلم خدمة العملاء؟","ارقام التليفون","تواصل مع الدعم","contact customer support"],"keywords":["تواصل","خدمة العملاء","رقم التليفون","الدعم","هاتف","contact us"],"synonyms":["اكلم مين","نمرة التليفون"],"answer":{"text":"يسعدنا دائماً الرد على جميع استفساراتكِ عبر:\n- الهاتف المباشر: 01038941005\n- خدمة عملاء واتساب المباشرة: 01038941005 (رابط مباشر)\n- مواعيد العمل: يومياً من 10:00 ص حتى 10:00 م بتوقيت القاهرة.","links":[{"title":"محادثة فورية عبر واتساب","url":"https://wa.me/201038941005","isExternal":true},{"title":"صفحة اتصل بنا الرسمية","url":"https://dandy-ebon.vercel.app/contact-us","isExternal":false}]},"relatedIds":["store-whatsapp-direct","store-hours-info"],"enabled":true,"order":3},{"id":"store-whatsapp-direct","categoryId":"store-info","title":"رابط واتساب خدمة العملاء المباشر","question":"هل لديكم رقم واتساب مباشر للتحدث الفوري؟","alternativeQuestions":["رقم الواتساب كام؟","عايز شات واتساب","واتس اب داندي","رابط محادثة واتساب","whatsapp link"],"keywords":["واتساب","رقم واتساب","whatsapp","شات واتساب","201038941005","01038941005"],"synonyms":["الواتس","واتس"],"answer":{"text":"نعم! يمكنكِ بدء محادثة فورية مباشرة مع فريق خدمة عملاء DANDY عبر الرقم: 01038941005 أو بالضغط على زر المحادثة أدناه.","links":[{"title":"بدء محادثة واتساب الآن","url":"https://wa.me/201038941005","isExternal":true}]},"relatedIds":["store-contact-support","store-hours-info"],"enabled":true,"order":4},{"id":"store-help-center-terms","categoryId":"store-info","title":"مركز المساعدة والشروط والأحكام","question":"أين أجد مركز المساعدة والشروط والأحكام وسياسة الخصوصية؟","alternativeQuestions":["فين صفحة الشروط والأحكام؟","مركز المساعدة","سياسة الخصوصية","help center","terms and conditions"],"keywords":["شروط","أحكام","سياسة الخصوصية","مركز المساعدة","help","terms"],"synonyms":["الشروط","صفحة المساعدة"],"answer":{"text":"يمكنكِ الاطلاع على كافة سياسات المتجر، الشروط والأحكام، وضمانات الاستخدام عبر الروابط الرسمية المعتمدة لـ DANDY:","links":[{"title":"صفحة مركز المساعدة (Help Center)","url":"https://dandy-ebon.vercel.app/help","isExternal":false},{"title":"صفحة الشروط والأحكام (Terms)","url":"https://dandy-ebon.vercel.app/terms","isExternal":false}]},"relatedIds":["store-about-dandy","returns-can-i-return"],"enabled":true,"order":5},{"id":"store-privacy-and-trust","categoryId":"store-info","title":"سياسة الخصوصية وأمان بيانات العملاء","question":"كيف يحافظ متجر DANDY على خصوصية وسرية بياناتي؟","alternativeQuestions":["هل بياناتي آمنة؟","سياسة أمان البيانات","خصوصية العميل في DANDY","حماية البيانات الشخصية"],"keywords":["خصوصية","أمان البيانات","حماية البيانات","سرية المعلومات","privacy"],"synonyms":["الامان","سرية"],"answer":{"text":"يلتزم DANDY بأقصى درجات السرية والأمان لبيانات العملاء. لا يقوم المساعد الآلي B.A.B بطلب أو تخزين أرقام بطاقات أو كلمات مرور، وتستخدم بيانات الشحن فقط لغرض توصيل طلبكِ بأمان.","links":[{"title":"قراءة الشروط والأحكام كاملة","url":"https://dandy-ebon.vercel.app/terms","isExternal":false}]},"relatedIds":["store-help-center-terms","store-about-dandy"],"enabled":true,"order":6}]};
// --- BUNDLED_KNOWLEDGE_END ---

export class DandyBabWidget extends BaseElement {
  constructor() {
    super();
    if (typeof this.attachShadow === 'function') {
      this.attachShadow({ mode: 'open' });
    }

    // Internal State
    this.isOpen = false;
    this.currentView = 'home'; // 'home' | 'category' | 'article' | 'search'
    this.activeCategoryId = null;
    this.activeArticleId = null;
    this.searchQuery = '';
    this.historyStack = [];
    // Initialize with preloaded bundled knowledge for instant, zero-delay render
    this.knowledge = (typeof BUNDLED_KNOWLEDGE === 'object' && BUNDLED_KNOWLEDGE)
      ? JSON.parse(JSON.stringify(BUNDLED_KNOWLEDGE))
      : null;
    this.isLoading = !this.knowledge;
    this.loadError = null;

    // Concurrency and abort guards
    this._isFetching = false;
    this._abortController = null;
    this._fetchPromise = null;

    // Feedback state
    this.articleFeedback = {}; // { [articleId]: 'yes' | 'no' }

    // Bind methods
    this.toggleWidget = this.toggleWidget.bind(this);
    this.handleSearchInput = this.handleSearchInput.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  static get observedAttributes() {
    return ['knowledge-src', 'open'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'knowledge-src') {
      if (this.isConnected && newValue) {
        this.loadKnowledge(newValue);
      }
    } else if (name === 'open') {
      this.isOpen = newValue !== null;
      this.render();
    }
  }

  connectedCallback() {
    this.initShadowDom();
    if (this.hasAttribute('open') || this.hasAttribute('embedded')) {
      this.isOpen = true;
    }
    this.applyThemeColors();
    this.render(); // Immediate instant render on mount!

    const src = this.getAttribute('knowledge-src') || '/assets/bab/data/knowledge.json';
    if (!this._isFetching) {
      this.loadKnowledge(src);
    }
    window.addEventListener('keydown', this.handleKeyDown);
  }

  initShadowDom() {
    if (!this.shadowRoot.querySelector('#bab-styles')) {
      const link = document.createElement('link');
      link.id = 'bab-styles';
      link.rel = 'stylesheet';
      link.href = '/assets/bab/widget/bab-widget.css';
      this.shadowRoot.appendChild(link);

      const wrapper = document.createElement('div');
      wrapper.id = 'bab-root';
      this.shadowRoot.appendChild(wrapper);
    }
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this._abortController) {
      try { this._abortController.abort(); } catch (_) {}
      this._abortController = null;
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Escape' && this.isOpen) {
      this.toggleWidget(false);
    }
  }

  /**
   * Public API: Used by the local dashboard for reactive instant live preview!
   */
  setKnowledgeData(data) {
    if (!data) return;
    if (this._abortController) {
      try { this._abortController.abort(); } catch (_) {}
      this._abortController = null;
    }
    this._isFetching = false;
    this.knowledge = JSON.parse(JSON.stringify(data));
    this.isLoading = false;
    this.loadError = null;
    if (this.hasAttribute('embedded') || this.hasAttribute('open')) {
      this.isOpen = true;
    }
    this.applyThemeColors();
    this.render();
  }

  /**
   * Traceable, bulletproof Knowledge Base loader
   * - Concurrency guard: prevents multiple parallel network fetches
   * - Strict 10-second timeout via AbortController
   * - Fallback URL cascade: primary path, root data path, relative paths
   * - Validates JSON structure and rejects HTML rewrites
   */
  async loadKnowledge(preferredSrc) {
    if (this._isFetching) {
      return this._fetchPromise;
    }

    this._isFetching = true;
    // Only display loading UI if we do NOT already have preloaded knowledge!
    if (!this.knowledge) {
      this.isLoading = true;
      this.loadError = null;
      this.render();
    }

    if (this._abortController) {
      try { this._abortController.abort(); } catch (_) {}
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const timeoutId = setTimeout(() => {
      if (this._abortController) {
        this._abortController.abort(new Error('Network timeout loading knowledge base'));
      }
    }, 10000);

    const candidateUrls = [];
    if (preferredSrc && typeof preferredSrc === 'string') {
      candidateUrls.push(preferredSrc);
    }
    const defaults = [
      '/assets/bab/data/knowledge.json',
      '/data/knowledge.json',
      './assets/bab/data/knowledge.json',
      './data/knowledge.json'
    ];
    for (const d of defaults) {
      if (!candidateUrls.includes(d)) candidateUrls.push(d);
    }

    this._fetchPromise = (async () => {
      let loadedData = null;
      let lastError = null;

      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, { signal });
          if (!res.ok) continue;

          // Crucial check: verify content-type is not an HTML fallback
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            continue;
          }

          const json = await res.json();
          if (json && Array.isArray(json.categories) && Array.isArray(json.articles)) {
            loadedData = json;
            break;
          }
        } catch (err) {
          lastError = err;
          if (signal.aborted) break;
        }
      }

      clearTimeout(timeoutId);

      if (loadedData) {
        this.knowledge = loadedData;
        this.isLoading = false;
        this.loadError = null;
        this.applyThemeColors();
        this.render();
      } else {
        this.isLoading = false;
        // If we already have knowledge (from bundled data or previous save), keep it smoothly
        if (!this.knowledge) {
          console.error('B.A.B Widget: Unable to load knowledge base from URLs', candidateUrls, lastError);
          this.loadError = 'تعذر تحميل قاعدة المعرفة.';
        }
        this.render();
      }

      this._isFetching = false;
      this._abortController = null;
    })();

    return this._fetchPromise;
  }

  getBrandLogo(variant = 'default') {
    const settings = this.knowledge?.settings || {};
    if (variant === 'white') {
      return settings.brandLogoWhite || '/assets/bab/images/dandy-logo-white.png';
    }
    return settings.brandLogo || '/assets/bab/images/dandy-logo.png';
  }

  applyThemeColors() {
    if (!this.knowledge?.settings?.theme) return;
    const theme = this.knowledge.settings.theme;
    if (theme.primary) this.style.setProperty('--bab-primary', theme.primary);
    if (theme.secondary) this.style.setProperty('--bab-secondary', theme.secondary);
    if (theme.dark) this.style.setProperty('--bab-wine', theme.dark);
    if (theme.background) this.style.setProperty('--bab-bg', theme.background);
  }

  toggleWidget(forceState) {
    const prevState = this.isOpen;
    this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;

    // Body scroll lock on mobile
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
      if (this.isOpen && window.innerWidth <= 640 && !this.hasAttribute('embedded')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }

    if (this.isOpen) {
      this.setAttribute('open', '');
      // Auto-focus search input with smooth delay
      setTimeout(() => {
        const input = this.shadowRoot.querySelector('.bab-search-input');
        if (input) input.focus();
      }, 180);
    } else {
      this.removeAttribute('open');
      // Restore focus to launcher button
      if (prevState) {
        setTimeout(() => {
          const launcher = this.shadowRoot.querySelector('#launcher-btn');
          if (launcher) launcher.focus();
        }, 50);
      }
    }
    this.render();
  }

  navigateTo(view, categoryId = null, articleId = null) {
    this.historyStack.push({
      view: this.currentView,
      categoryId: this.activeCategoryId,
      articleId: this.activeArticleId
    });
    this.currentView = view;
    this.activeCategoryId = categoryId;
    this.activeArticleId = articleId;
    this.render();

    // Scroll content to top
    const content = this.shadowRoot.querySelector('.bab-content');
    if (content) content.scrollTop = 0;
  }

  navigateBack() {
    if (this.historyStack.length > 0) {
      const prev = this.historyStack.pop();
      this.currentView = prev.view;
      this.activeCategoryId = prev.categoryId;
      this.activeArticleId = prev.articleId;
    } else {
      this.currentView = 'home';
      this.activeCategoryId = null;
      this.activeArticleId = null;
    }
    this.render();

    const content = this.shadowRoot.querySelector('.bab-content');
    if (content) content.scrollTop = 0;
  }

  navigateHome() {
    this.historyStack = [];
    this.currentView = 'home';
    this.activeCategoryId = null;
    this.activeArticleId = null;
    this.searchQuery = '';
    this.render();

    const content = this.shadowRoot.querySelector('.bab-content');
    if (content) content.scrollTop = 0;
  }

  restartChat() {
    this.historyStack = [];
    this.currentView = 'home';
    this.activeCategoryId = null;
    this.activeArticleId = null;
    this.searchQuery = '';
    this.articleFeedback = {};
    this.render();

    const content = this.shadowRoot.querySelector('.bab-content');
    if (content) content.scrollTop = 0;
  }

  getWhatsAppUrl(customText) {
    const settings = this.knowledge?.settings || {};
    const phone = settings.supportWhatsapp || '201038941005';
    const msg = customText || settings.supportWhatsappText || 'مرحبًا، أحتاج إلى مساعدة بخصوص متجر DANDY.';
    return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
  }

  openWhatsApp(customText) {
    const url = this.getWhatsAppUrl(customText);
    const safe = sanitizeUrl(url);
    if (safe && safe !== '#') {
      window.open(safe, '_blank', 'noopener,noreferrer');
    }
  }

  handleSearchInput(e) {
    this.searchQuery = e.target.value;
    const suggestionsBox = this.shadowRoot.querySelector('.bab-suggestions-box');

    if (!this.searchQuery.trim()) {
      if (suggestionsBox) {
        suggestionsBox.classList.remove('bab-active');
        suggestionsBox.innerHTML = '';
      }
      if (this.currentView === 'search') {
        this.navigateHome();
      }
      return;
    }

    const results = searchKnowledgeBase(this.searchQuery, this.knowledge);

    if (results.length > 0 && suggestionsBox) {
      suggestionsBox.innerHTML = results.slice(0, 4).map(art => `
        <div class="bab-suggestion-item" data-article-id="${this.escapeHtml(art.id)}">
          <span>${ICONS.search}</span>
          <span>${this.escapeHtml(art.title)}</span>
        </div>
      `).join('');
      suggestionsBox.classList.add('bab-active');

      suggestionsBox.querySelectorAll('.bab-suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-article-id');
          suggestionsBox.classList.remove('bab-active');
          this.navigateTo('article', null, id);
        });
      });
    } else if (suggestionsBox) {
      suggestionsBox.classList.remove('bab-active');
      suggestionsBox.innerHTML = '';
    }
  }

  executeSearch() {
    const suggestionsBox = this.shadowRoot.querySelector('.bab-suggestions-box');
    if (suggestionsBox) suggestionsBox.classList.remove('bab-active');
    if (!this.searchQuery.trim()) return;
    this.navigateTo('search');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  render() {
    this.initShadowDom();
    const rootWrapper = this.shadowRoot.querySelector('#bab-root');
    if (!rootWrapper) return;

    const settings = this.knowledge?.settings || {
      assistantName: 'B.A.B',
      assistantSubtitle: 'مساعد DANDY الذكي',
      brandName: 'DANDY',
      welcomeMessage: 'أهلاً بكِ في DANDY! كيف يمكنني مساعدتكِ اليوم؟',
      searchPlaceholder: 'ابحثي عن سؤالك (شحن، تتبع، استرجاع...)',
      supportHours: 'يوميًا 10:00 ص - 10:00 م'
    };

    const categories = (this.knowledge?.categories || []).filter(c => c.enabled !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
    const articles = (this.knowledge?.articles || []).filter(a => a.enabled !== false);

    let activeCategory = null;
    if (this.activeCategoryId) {
      activeCategory = categories.find(c => c.id === this.activeCategoryId);
    }

    let activeArticle = null;
    if (this.activeArticleId) {
      activeArticle = articles.find(a => a.id === this.activeArticleId);
      if (activeArticle && !activeCategory) {
        activeCategory = categories.find(c => c.id === activeArticle.categoryId);
      }
    }

    // Determine subnav title with robust fallback
    let subnavTitle = '';
    if (this.currentView === 'category' && activeCategory) {
      subnavTitle = activeCategory.title;
    } else if (this.currentView === 'article' && activeArticle) {
      subnavTitle = activeArticle.title;
    } else if (this.currentView === 'search') {
      subnavTitle = `نتائج البحث: "${this.searchQuery}"`;
    }

    rootWrapper.innerHTML = `

      <!-- Mobile Backdrop Overlay -->
      <div class="bab-backdrop ${this.isOpen ? 'bab-active' : ''}" id="backdrop" aria-hidden="true"></div>

      <!-- Floating Launcher (Bottom-Left) -->
      <div class="bab-launcher-container" style="${this.isOpen ? 'display: none;' : ''}">
        <button 
          class="bab-launcher-btn" 
          id="launcher-btn" 
          aria-label="فتح مساعد DANDY الذكي B.A.B" 
          aria-expanded="${this.isOpen}" 
          aria-haspopup="dialog"
        >
          <div class="bab-launcher-logo-badge" title="متجر DANDY الرسمي">
            <img 
              src="${this.getBrandLogo('white')}" 
              alt="${this.escapeHtml(settings.brandName || 'DANDY')}" 
              class="bab-launcher-logo-img"
              loading="eager"
            />
          </div>
          <div class="bab-launcher-divider" aria-hidden="true"></div>
          <div class="bab-launcher-text-wrap">
            <div class="bab-launcher-brand">
              <span>مساعد DANDY</span>
              <span class="bab-launcher-pulse" aria-hidden="true"></span>
            </div>
            <span class="bab-launcher-subtitle">استفسارات الشحن والطلبات</span>
          </div>
        </button>
      </div>

      <!-- Support Panel Window -->
      <div 
        class="bab-panel ${this.isOpen ? '' : 'bab-hidden'}" 
        role="dialog" 
        aria-modal="true" 
        aria-label="لوحة مساعدة DANDY الذكية"
      >
        
        <!-- Header: Official DANDY Logo + «نهتم بك» only -->
        <header class="bab-header">
          <div class="bab-brand">
            <div class="bab-header-brand-wrap" title="DANDY">
              <img 
                src="${this.getBrandLogo('white')}" 
                alt="DANDY" 
                class="bab-header-logo-img"
                loading="eager"
              />
              <div class="bab-header-tagline">نهتم بك</div>
            </div>
          </div>
          <div class="bab-header-actions">
            <button class="bab-icon-btn" id="close-btn" title="إغلاق" aria-label="إغلاق النافذة">${ICONS.close}</button>
            <button class="bab-icon-btn" id="minimize-btn" title="تصغير" aria-label="تصغير النافذة">${ICONS.minimize}</button>
            <button class="bab-icon-btn" id="restart-btn" title="بدء محادثة جديدة" aria-label="بدء محادثة جديدة">${ICONS.refresh}</button>
          </div>
        </header>

        <!-- Subnav bar if not in home view -->
        ${this.currentView !== 'home' ? `
          <div class="bab-subnav" role="navigation" aria-label="شريط التنقل الداخلي">
            <button class="bab-nav-btn" id="nav-back-btn" aria-label="الرجوع للخطوة السابقة">
              <span aria-hidden="true">${ICONS.arrowRight}</span>
              <span>رجوع</span>
            </button>
            <span class="bab-nav-title" title="${this.escapeHtml(subnavTitle)}">${this.escapeHtml(subnavTitle)}</span>
            <button class="bab-nav-btn" id="nav-home-btn" aria-label="العودة للرئيسية">
              <span aria-hidden="true">${ICONS.home}</span>
              <span>الرئيسية</span>
            </button>
          </div>
        ` : ''}

        <!-- Search Bar Area -->
        <div class="bab-search-bar" role="search">
          <div class="bab-search-input-wrap">
            <span class="bab-search-icon" aria-hidden="true">${ICONS.search}</span>
            <input 
              type="text" 
              class="bab-search-input" 
              placeholder="${this.escapeHtml(settings.searchPlaceholder || 'ابحث عن سؤال أو موضوع...')}" 
              value="${this.escapeHtml(this.searchQuery)}"
              aria-label="البحث في الأسئلة الشائعة وقاعدة المعرفة"
            />
            ${this.searchQuery ? `
              <button class="bab-search-clear" id="search-clear-btn" aria-label="مسح نص البحث">
                ${ICONS.close}
              </button>
            ` : ''}
          </div>
          <div class="bab-suggestions-box" role="listbox" aria-label="اقتراحات البحث المباشرة"></div>
        </div>

        <!-- Main Content Area -->
        <main class="bab-content">
          ${this.renderViewContent(settings, categories, articles, activeCategory, activeArticle)}
        </main>

        <!-- Footer -->
        <footer class="bab-footer-note">
          <img src="${this.getBrandLogo('default')}" alt="DANDY" class="bab-footer-logo-img" />
          <span>• المساعد المعتمد لمتجر داندي</span>
        </footer>

      </div>
    `;

    this.attachEventListeners();
  }

  renderViewContent(settings, categories, articles, activeCategory, activeArticle) {
    if (this.isLoading) {
      return `
        <div class="bab-loading-container">
          <div class="bab-loading-spinner" aria-hidden="true"></div>
          <div class="bab-loading-text">جار التحميل</div>
          <div class="bab-loading-divider" aria-hidden="true">
            <span class="bab-divider-line"></span>
            <span class="bab-divider-icon">${ICONS.floral}</span>
            <span class="bab-divider-line"></span>
          </div>
        </div>
      `;
    }

    if (this.loadError) {
      return `
        <div class="bab-no-results-box bab-error-state">
          <div class="bab-no-results-icon" style="color: var(--bab-secondary);">${ICONS.helpCircle}</div>
          <div class="bab-no-results-title">تعذر إتمام التحميل</div>
          <div class="bab-no-results-desc">حدث خطأ أثناء تحميل قاعدة المعرفة. يمكنكِ إعادة المحاولة أو التواصل مباشرة عبر واتساب للمساعدة الفورية.</div>
          <div style="display: flex; gap: 10px; justify-content: center; margin-top: 14px; flex-wrap: wrap;">
            <button class="bab-chip-btn" id="bab-retry-load-btn" style="background: var(--bab-wine); color: #ffffff; border: none; padding: 10px 18px; font-weight: 700;">
              <span>${ICONS.refresh}</span>
              <span>إعادة المحاولة</span>
            </button>
            <button class="bab-chip-btn" id="fallback-whatsapp-btn" style="background: #094738; color: #ffffff; border: none; padding: 10px 18px; font-weight: 700;">
              <span>${ICONS.whatsapp}</span>
              <span>تواصل واتساب الآن</span>
            </button>
          </div>
        </div>
      `;
    }

    // VIEW: HOME
    if (this.currentView === 'home') {
      return `
        <!-- Categories Grid (Direct Access) -->
        <div class="bab-categories-container">
          <div class="bab-categories-grid">
            ${categories.map(cat => `
              <button class="bab-category-card" data-category-id="${this.escapeHtml(cat.id)}" aria-label="قسم ${this.escapeHtml(cat.title)}">
                <div class="bab-category-main">
                  <div class="bab-category-icon-wrap" aria-hidden="true">
                    ${ICONS[cat.icon] || ICONS.sparkles}
                  </div>
                  <div class="bab-category-info">
                    <div class="bab-category-title">${this.escapeHtml(cat.title)}</div>
                    <div class="bab-category-desc">${this.escapeHtml(cat.description)}</div>
                  </div>
                </div>
                <div class="bab-category-chevron" aria-hidden="true">${ICONS.chevronLeft}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- WhatsApp Escalation Card -->
        <div class="bab-whatsapp-card" id="home-whatsapp-card" role="button" aria-label="التواصل مع خدمة العملاء عبر واتساب">
          <div class="bab-whatsapp-info">
            <div class="bab-whatsapp-title">
              <span aria-hidden="true">${ICONS.whatsapp}</span>
              <span>خدمة العملاء عبر واتساب</span>
            </div>
            <div class="bab-whatsapp-subtitle">فريق DANDY متاح للإجابة والمساعدة الفورية</div>
            <div class="bab-whatsapp-hours">متاح: ${this.escapeHtml(settings.supportHours || '10:00 ص - 10:00 م')}</div>
          </div>
          <div class="bab-whatsapp-btn">محادثة فورية</div>
        </div>
      `;
    }

    // VIEW: CATEGORY (Topics List)
    if (this.currentView === 'category' && activeCategory) {
      const categoryArticles = articles
        .filter(a => a.categoryId === activeCategory.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      return `
        <div style="padding: 4px 4px 6px;">
          <h2 style="font-size: 15.5px; font-weight: 800; color: var(--bab-wine); margin-bottom: 4px;">
            ${this.escapeHtml(activeCategory.title)}
          </h2>
          <p style="font-size: 12.5px; color: var(--bab-text-muted); line-height: 1.5;">
            ${this.escapeHtml(activeCategory.description)}
          </p>
        </div>

        <div class="bab-search-results-list">
          ${categoryArticles.length > 0 ? categoryArticles.map(art => `
            <button class="bab-article-item" data-article-id="${this.escapeHtml(art.id)}">
              <div>
                <div class="bab-article-item-title">${this.escapeHtml(art.title)}</div>
                <div class="bab-article-item-question">${this.escapeHtml(art.question)}</div>
              </div>
              <div class="bab-category-chevron" aria-hidden="true">${ICONS.chevronLeft}</div>
            </button>
          `).join('') : `
            <div class="bab-no-results-box">
              <p style="font-size: 13px; color: var(--bab-text-muted);">لا توجد مواضيع مضافة في هذا القسم حالياً.</p>
            </div>
          `}
        </div>

        <!-- WhatsApp Escalation in Category -->
        <div class="bab-whatsapp-card" id="category-whatsapp-card" style="margin-top: 8px;" role="button">
          <div class="bab-whatsapp-info">
            <div class="bab-whatsapp-title">
              <span aria-hidden="true">${ICONS.whatsapp}</span>
              <span>تحدثي مع موظف خدمة العملاء</span>
            </div>
            <div class="bab-whatsapp-subtitle">فريق DANDY متاح للإجابة على استفساراتكِ فوراً</div>
          </div>
          <div class="bab-whatsapp-btn">تواصل الآن</div>
        </div>
      `;
    }

    // VIEW: ARTICLE (Detailed Answer)
    if (this.currentView === 'article' && activeArticle) {
      const feedback = this.articleFeedback[activeArticle.id];
      const relatedArticles = (activeArticle.relatedIds || [])
        .map(rid => articles.find(a => a.id === rid))
        .filter(Boolean);

      return `
        <div class="bab-article-detail">
          
          <!-- Header box -->
          <div class="bab-article-header-box">
            ${activeCategory ? `
              <div class="bab-article-kicker">
                <span>${this.escapeHtml(activeCategory.title)}</span>
              </div>
            ` : ''}
            <h1 class="bab-article-main-title">${this.escapeHtml(activeArticle.title)}</h1>
          </div>

          <!-- Answer Text -->
          <div class="bab-answer-card">
            <div class="bab-answer-text">${this.escapeHtml(activeArticle.answer?.text || '')}</div>

            <!-- Steps if present -->
            ${activeArticle.answer?.steps && activeArticle.answer.steps.length > 0 ? `
              <div class="bab-steps-list">
                ${activeArticle.answer.steps.map((step, idx) => `
                  <div class="bab-step-item">
                    <span class="bab-step-number">${idx + 1}</span>
                    <span>${this.escapeHtml(step)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <!-- Safe Action Links -->
            ${activeArticle.answer?.links && activeArticle.answer.links.length > 0 ? `
              <div class="bab-links-wrap">
                ${activeArticle.answer.links.map(link => `
                  <a href="${this.escapeHtml(sanitizeUrl(link.url, settings.officialBaseUrl))}" target="_blank" rel="noopener noreferrer" class="bab-action-link">
                    <span>${this.escapeHtml(link.title)}</span>
                    <span class="bab-action-link-icon" aria-hidden="true">${ICONS.externalLink}</span>
                  </a>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Helpfulness Feedback (Zero Emojis) -->
          <div class="bab-feedback-box">
            <span>هل ساعدتكِ هذه الإجابة؟</span>
            <div class="bab-feedback-buttons">
              <button class="bab-feedback-btn ${feedback === 'yes' ? 'bab-highlighted' : ''}" id="feedback-yes-btn">
                <span class="bab-feedback-icon" aria-hidden="true">${ICONS.thumbsUp}</span>
                <span>${feedback === 'yes' ? 'تم تسجيل رأيكِ' : 'نعم'}</span>
              </button>
              <button class="bab-feedback-btn ${feedback === 'no' ? 'bab-highlighted' : ''}" id="feedback-no-btn">
                <span class="bab-feedback-icon" aria-hidden="true">${ICONS.thumbsDown}</span>
                <span>${feedback === 'no' ? 'تم تسجيل رأيكِ' : 'لا'}</span>
              </button>
            </div>
          </div>

          <!-- Related Questions -->
          ${relatedArticles.length > 0 ? `
            <div class="bab-related-section">
              <span class="bab-section-title">مواضيع ذات صلة:</span>
              <div class="bab-related-list">
                ${relatedArticles.map(rel => `
                  <button class="bab-related-btn" data-article-id="${this.escapeHtml(rel.id)}">
                    <span>${this.escapeHtml(rel.title)}</span>
                    <span style="width: 14px; height: 14px; display: inline-block; color: var(--bab-secondary);">${ICONS.chevronLeft}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Direct WhatsApp Escalation -->
          <div class="bab-whatsapp-card" id="article-whatsapp-card" role="button">
            <div class="bab-whatsapp-info">
              <div class="bab-whatsapp-title">
                <span aria-hidden="true">${ICONS.whatsapp}</span>
                <span>هل لديكِ استفسار آخر؟</span>
              </div>
              <div class="bab-whatsapp-subtitle">تحدثي مباشرة مع خدمة عملاء DANDY عبر واتساب</div>
            </div>
            <div class="bab-whatsapp-btn">تواصل الآن</div>
          </div>

        </div>
      `;
    }

    // VIEW: SEARCH RESULTS
    if (this.currentView === 'search') {
      const results = searchKnowledgeBase(this.searchQuery, this.knowledge);

      if (results.length > 0) {
        return `
          <div style="font-size: 12.5px; font-weight: 700; color: var(--bab-text-muted); margin-bottom: 2px;">
            تم العثور على ${results.length} إجابة لبحثكِ عن "${this.escapeHtml(this.searchQuery)}":
          </div>

          <div class="bab-search-results-list">
            ${results.map(art => `
              <button class="bab-article-item" data-article-id="${this.escapeHtml(art.id)}">
                <div>
                  <div class="bab-article-item-title">${this.escapeHtml(art.title)}</div>
                  <div class="bab-article-item-question">${this.escapeHtml(art.question)}</div>
                </div>
                <div class="bab-category-chevron" aria-hidden="true">${ICONS.chevronLeft}</div>
              </button>
            `).join('')}
          </div>
        `;
      } else {
        return `
          <div class="bab-no-results-box">
            <div class="bab-no-results-icon">${ICONS.search}</div>
            <div class="bab-no-results-title">لم نجد نتائج مطابقة</div>
            <div class="bab-no-results-desc">
              ${this.escapeHtml(settings.noResultsMessage || 'عذرًا، لم نتمكن من العثور على إجابة مسجلة تطابق بحثكِ. يمكنكِ العودة للرئيسية أو التواصل المباشر مع خدمة عملاء DANDY.')}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 6px;">
              <button class="bab-chip-btn" id="search-go-home-btn">
                <span>${ICONS.home} العودة للرئيسية</span>
              </button>
              <button class="bab-chip-btn" id="search-whatsapp-btn" style="background: #094738; color: #ffffff; border: none; box-shadow: 0 4px 12px rgba(9, 71, 56, 0.25);">
                <span>${ICONS.whatsapp} التحدث عبر واتساب</span>
              </button>
            </div>
          </div>
        `;
      }
    }

    return '';
  }

  attachEventListeners() {
    const root = this.shadowRoot;

    // Backdrop click (closes widget on mobile)
    const backdrop = root.querySelector('#backdrop');
    if (backdrop) backdrop.addEventListener('click', () => this.toggleWidget(false));

    // Launcher click
    const launcher = root.querySelector('#launcher-btn');
    if (launcher) launcher.addEventListener('click', () => this.toggleWidget(true));

    // Header actions
    const closeBtn = root.querySelector('#close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.hasAttribute('embedded')) {
          this.navigateHome();
        } else {
          this.toggleWidget(false);
        }
      });
    }

    const minBtn = root.querySelector('#minimize-btn');
    if (minBtn) {
      minBtn.addEventListener('click', () => {
        if (this.hasAttribute('embedded')) {
          this.navigateHome();
        } else {
          this.toggleWidget(false);
        }
      });
    }

    const restartBtn = root.querySelector('#restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', () => this.restartChat());

    // Navigation buttons
    const backBtn = root.querySelector('#nav-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.navigateBack());

    const homeBtn = root.querySelector('#nav-home-btn');
    if (homeBtn) homeBtn.addEventListener('click', () => this.navigateHome());

    // Search input
    const searchInput = root.querySelector('.bab-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', this.handleSearchInput);
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.executeSearch();
        }
      });
    }

    const clearBtn = root.querySelector('#search-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchQuery = '';
        this.navigateHome();
      });
    }

    // Category clicks
    root.querySelectorAll('.bab-category-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-category-id');
        this.navigateTo('category', catId);
      });
    });

    // Article clicks
    root.querySelectorAll('.bab-article-item, .bab-related-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const artId = btn.getAttribute('data-article-id');
        this.navigateTo('article', null, artId);
      });
    });

    // Quick reply clicks
    root.querySelectorAll('.qr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const artId = btn.getAttribute('data-article-id');
        if (action === 'whatsapp') {
          this.openWhatsApp();
        } else if (artId) {
          this.navigateTo('article', null, artId);
        }
      });
    });

    // Feedback buttons
    const yesBtn = root.querySelector('#feedback-yes-btn');
    if (yesBtn && this.activeArticleId) {
      yesBtn.addEventListener('click', () => {
        this.articleFeedback[this.activeArticleId] = 'yes';
        this.render();
      });
    }

    const noBtn = root.querySelector('#feedback-no-btn');
    if (noBtn && this.activeArticleId) {
      noBtn.addEventListener('click', () => {
        this.articleFeedback[this.activeArticleId] = 'no';
        this.render();
      });
    }

    // WhatsApp escalation cards
    const homeWa = root.querySelector('#home-whatsapp-card');
    if (homeWa) homeWa.addEventListener('click', () => this.openWhatsApp());

    const catWa = root.querySelector('#category-whatsapp-card');
    if (catWa) catWa.addEventListener('click', () => this.openWhatsApp());

    const artWa = root.querySelector('#article-whatsapp-card');
    if (artWa) artWa.addEventListener('click', () => this.openWhatsApp());

    const searchWa = root.querySelector('#search-whatsapp-btn');
    if (searchWa) searchWa.addEventListener('click', () => this.openWhatsApp());

    const fallbackWa = root.querySelector('#fallback-whatsapp-btn');
    if (fallbackWa) fallbackWa.addEventListener('click', () => this.openWhatsApp());

    const retryBtn = root.querySelector('#bab-retry-load-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        const src = this.getAttribute('knowledge-src') || '/assets/bab/data/knowledge.json';
        this.loadKnowledge(src);
      });
    }

    const searchHome = root.querySelector('#search-go-home-btn');
    if (searchHome) searchHome.addEventListener('click', () => this.navigateHome());
  }
}

// Register custom element if not already defined
if (typeof customElements !== 'undefined' && !customElements.get('dandy-bab-widget')) {
  customElements.define('dandy-bab-widget', DandyBabWidget);
}
