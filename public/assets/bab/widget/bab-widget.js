/**
 * B.A.B — Beauty Assistant Bot
 * Standalone Web Component for DANDY beauty store
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

// Search Engine implementation
export function searchKnowledgeBase(query, knowledge) {
  if (!query || !query.trim() || !knowledge || !Array.isArray(knowledge.articles)) {
    return [];
  }

  const rawNormQuery = normalizeArabic(query);
  const queryTokens = rawNormQuery.split(' ').filter(t => t.length > 0);
  if (queryTokens.length === 0) return [];

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
    if (normTitle === rawNormQuery) score += 150;
    else if (normQuestion === rawNormQuery) score += 140;

    // 2. Full phrase inclusion in title or question
    if (normTitle.includes(rawNormQuery)) score += 80;
    if (normQuestion.includes(rawNormQuery)) score += 70;

    // 3. Alternative Questions matches
    for (const alt of altQuestions) {
      if (alt === rawNormQuery) {
        score += 120;
        break;
      } else if (alt.includes(rawNormQuery)) {
        score += 60;
        break;
      }
    }

    // 4. Keywords and Synonyms exact / partial matches
    for (const kw of keywords) {
      if (kw === rawNormQuery) {
        score += 100;
      } else if (kw.includes(rawNormQuery) || rawNormQuery.includes(kw)) {
        score += 55;
      }
    }

    for (const syn of synonyms) {
      if (syn === rawNormQuery) {
        score += 90;
      } else if (syn.includes(rawNormQuery) || rawNormQuery.includes(syn)) {
        score += 50;
      }
    }

    // 5. Token-by-token scoring
    let tokenMatches = 0;
    for (const token of queryTokens) {
      let matchedToken = false;

      // Check title & question
      if (normTitle.includes(token)) {
        score += 35;
        matchedToken = true;
      }
      if (normQuestion.includes(token)) {
        score += 30;
        matchedToken = true;
      }

      // Check keywords/synonyms
      for (const kw of keywords) {
        if (kw.includes(token)) {
          score += 25;
          matchedToken = true;
        }
      }
      for (const syn of synonyms) {
        if (syn.includes(token)) {
          score += 20;
          matchedToken = true;
        }
      }

      // Check answer text
      if (normAnswer.includes(token)) {
        score += 12;
        matchedToken = true;
      }

      // Typo tolerance check for tokens with length >= 4
      if (!matchedToken && token.length >= 4) {
        const titleWords = normTitle.split(' ');
        for (const tw of titleWords) {
          if (tw.length >= 4 && levenshteinDistance(token, tw) <= 1) {
            score += 20;
            matchedToken = true;
            break;
          }
        }
      }

      if (matchedToken) tokenMatches++;
    }

    // Bonus for matching all tokens
    if (tokenMatches === queryTokens.length && queryTokens.length > 1) {
      score += 40;
    }

    if (score > 10) {
      scored.push({ article, score });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map(s => s.article);
}

// Icons Map (SVG strings safe for innerHTML inside isolated Shadow DOM)
const ICONS = {
  sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18.5" r="2.5"/><circle cx="7" cy="18.5" r="2.5"/></svg>`,
  'rotate-ccw': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  'credit-card': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`,
  'message-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  minimize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M5 12h14"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="m15 18-6-6 6-6"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="m9 18 6-6-6-6"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
  bot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><rect width="18" height="12" x="3" y="6" rx="2"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><path d="M12 2v4"/><path d="M2 12h1"/><path d="M21 12h1"/></svg>`
};

const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

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
    this.knowledge = null;
    this.isLoading = true;
    this.loadError = null;

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
      this.loadKnowledge(newValue);
    } else if (name === 'open') {
      this.isOpen = newValue !== null;
      this.render();
    }
  }

  connectedCallback() {
    const src = this.getAttribute('knowledge-src') || '/assets/bab/data/knowledge.json';
    if (!this.knowledge) {
      this.loadKnowledge(src);
    }
    window.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.handleKeyDown);
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
    this.knowledge = JSON.parse(JSON.stringify(data));
    this.isLoading = false;
    this.loadError = null;
    this.applyThemeColors();
    this.render();
  }

  async loadKnowledge(src) {
    this.isLoading = true;
    this.loadError = null;
    this.render();

    try {
      const res = await fetch(src, { cache: 'no-cache' });
      if (!res.ok) {
        // Fallback check to /data/knowledge.json if root differs
        if (src.includes('/assets/bab/data/knowledge.json')) {
          const fallbackRes = await fetch('/data/knowledge.json');
          if (fallbackRes.ok) {
            this.knowledge = await fallbackRes.json();
            this.isLoading = false;
            this.applyThemeColors();
            this.render();
            return;
          }
        }
        throw new Error(`Failed to load knowledge file: ${res.status}`);
      }
      this.knowledge = await res.json();
      this.isLoading = false;
      this.applyThemeColors();
      this.render();
    } catch (err) {
      console.warn('B.A.B Widget: Error loading knowledge base', err);
      this.isLoading = false;
      this.loadError = 'تعذر تحميل قاعدة المعرفة حالياً.';
      this.render();
    }
  }

  applyThemeColors() {
    if (!this.knowledge?.settings?.theme) return;
    const theme = this.knowledge.settings.theme;
    if (theme.primary) this.style.setProperty('--bab-primary', theme.primary);
    if (theme.secondary) this.style.setProperty('--bab-secondary', theme.secondary);
    if (theme.dark) this.style.setProperty('--bab-dark', theme.dark);
    if (theme.background) this.style.setProperty('--bab-bg', theme.background);
  }

  toggleWidget(forceState) {
    this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;
    if (this.isOpen) {
      this.setAttribute('open', '');
      // Focus search on open
      setTimeout(() => {
        const input = this.shadowRoot.querySelector('.bab-search-input');
        if (input) input.focus();
      }, 150);
    } else {
      this.removeAttribute('open');
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
  }

  navigateHome() {
    this.historyStack = [];
    this.currentView = 'home';
    this.activeCategoryId = null;
    this.activeArticleId = null;
    this.searchQuery = '';
    this.render();
  }

  restartChat() {
    this.historyStack = [];
    this.currentView = 'home';
    this.activeCategoryId = null;
    this.activeArticleId = null;
    this.searchQuery = '';
    this.articleFeedback = {};
    this.render();
  }

  getWhatsAppUrl(customText) {
    const settings = this.knowledge?.settings || {};
    const phone = settings.supportWhatsapp || '201038941005';
    const msg = customText || settings.supportWhatsappText || 'مرحبًا، أحتاج إلى مساعدة بخصوص متجر DANDY.';
    return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
  }

  openWhatsApp(customText) {
    const url = this.getWhatsAppUrl(customText);
    window.open(url, '_blank', 'noopener,noreferrer');
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
          <span style="color: var(--bab-secondary); width: 14px; height: 14px; display: inline-block;">${ICONS.search}</span>
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
    const settings = this.knowledge?.settings || {
      assistantName: 'B.A.B',
      assistantSubtitle: 'مساعد DANDY الذكي',
      brandName: 'DANDY',
      welcomeMessage: 'أهلاً بكِ في DANDY! كيف يمكنني مساعدتكِ اليوم؟',
      searchPlaceholder: 'ابحثي عن سؤالك...',
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

    // Determine subnav title
    let subnavTitle = '';
    if (this.currentView === 'category' && activeCategory) {
      subnavTitle = activeCategory.title;
    } else if (this.currentView === 'article' && activeArticle) {
      subnavTitle = activeArticle.title;
    } else if (this.currentView === 'search') {
      subnavTitle = `نتائج البحث: "${this.searchQuery}"`;
    }

    this.shadowRoot.innerHTML = `
      <style>
        @import "/assets/bab/widget/bab-widget.css";
      </style>

      <!-- Floating Launcher (Bottom-Left) -->
      <div class="bab-launcher-container" style="${this.isOpen ? 'display: none;' : ''}">
        <button class="bab-launcher-btn" id="launcher-btn" aria-label="فتح المساعد الذكي B.A.B">
          <div class="bab-launcher-icon">${ICONS.sparkles}</div>
          <span class="bab-launcher-label">مساعد DANDY</span>
          <span class="bab-launcher-badge">B.A.B</span>
        </button>
      </div>

      <!-- Support Panel -->
      <div class="bab-panel ${this.isOpen ? '' : 'bab-hidden'}" role="dialog" aria-modal="true" aria-label="لوحة مساعدة DANDY">
        
        <!-- Header -->
        <header class="bab-header">
          <div class="bab-brand">
            <div class="bab-avatar">${ICONS.bot}</div>
            <div class="bab-brand-text">
              <div class="bab-brand-title">
                ${this.escapeHtml(settings.assistantName || 'B.A.B')}
                <span class="bab-brand-badge">${this.escapeHtml(settings.brandName || 'DANDY')}</span>
              </div>
              <div class="bab-brand-subtitle">
                <span class="bab-online-dot"></span>
                <span>${this.escapeHtml(settings.assistantSubtitle || 'متاح الآن')}</span>
              </div>
            </div>
          </div>
          <div class="bab-header-actions">
            <button class="bab-icon-btn" id="restart-btn" title="بدء محادثة جديدة" aria-label="بدء محادثة جديدة">${ICONS.refresh}</button>
            <button class="bab-icon-btn" id="minimize-btn" title="تصغير" aria-label="تصغير النافذة">${ICONS.minimize}</button>
            <button class="bab-icon-btn" id="close-btn" title="إغلاق" aria-label="إغلاق">${ICONS.close}</button>
          </div>
        </header>

        <!-- Subnav bar if not in home view -->
        ${this.currentView !== 'home' ? `
          <div class="bab-subnav">
            <button class="bab-nav-btn" id="nav-back-btn" aria-label="الرجوع للخطوة السابقة">
              <span style="width: 14px; height: 14px; display: inline-block;">${ICONS.arrowRight}</span>
              <span>رجوع</span>
            </button>
            <span class="bab-nav-title">${this.escapeHtml(subnavTitle)}</span>
            <button class="bab-nav-btn" id="nav-home-btn" aria-label="العودة للرئيسية">
              <span style="width: 14px; height: 14px; display: inline-block;">${ICONS.home}</span>
              <span>الرئيسية</span>
            </button>
          </div>
        ` : ''}

        <!-- Search Bar -->
        <div class="bab-search-bar">
          <div class="bab-search-input-wrap">
            <span class="bab-search-icon">${ICONS.search}</span>
            <input 
              type="text" 
              class="bab-search-input" 
              placeholder="${this.escapeHtml(settings.searchPlaceholder || 'ابحثي عن سؤالك...')}" 
              value="${this.escapeHtml(this.searchQuery)}"
              aria-label="البحث في الأسئلة الشائعة"
            />
            ${this.searchQuery ? `
              <button class="bab-search-clear" id="search-clear-btn" aria-label="مسح البحث">
                <span style="width: 14px; height: 14px; display: inline-block;">${ICONS.close}</span>
              </button>
            ` : ''}
          </div>
          <div class="bab-suggestions-box"></div>
        </div>

        <!-- Main Content Area -->
        <main class="bab-content">
          ${this.renderViewContent(settings, categories, articles, activeCategory, activeArticle)}
        </main>

        <!-- Footer -->
        <footer class="bab-footer-note">
          <span>✨ مساعد DANDY الذكي للإجابات المعتمدة</span>
        </footer>

      </div>
    `;

    this.attachEventListeners();
  }

  renderViewContent(settings, categories, articles, activeCategory, activeArticle) {
    if (this.isLoading) {
      return `
        <div style="text-align: center; padding: 40px 10px; color: var(--bab-muted);">
          <div style="width: 32px; height: 32px; margin: 0 auto 12px; border: 3px solid var(--bab-border); border-top-color: var(--bab-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <p style="font-size: 13px;">جارٍ تحميل قاعدة المعرفة...</p>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      `;
    }

    if (this.loadError) {
      return `
        <div class="bab-no-results-box">
          <div class="bab-no-results-icon" style="color: #ef4444;">⚠️</div>
          <div class="bab-no-results-title">${this.escapeHtml(this.loadError)}</div>
          <div class="bab-no-results-desc">يمكنكِ التواصل المباشر مع موظف خدمة العملاء عبر واتساب للمساعدة الفورية.</div>
          <button class="bab-chip-btn" id="fallback-whatsapp-btn" style="background: #25d366; color: #ffffff; border: none;">
            ${ICONS.whatsapp} تواصل واتساب الآن
          </button>
        </div>
      `;
    }

    // VIEW: HOME
    if (this.currentView === 'home') {
      const quickReplies = this.knowledge?.quickReplies || [];

      return `
        <!-- Welcome Card -->
        <div class="bab-welcome-card">
          <div class="bab-welcome-badge">${ICONS.sparkles} مرحبًا بكِ في DANDY</div>
          <p class="bab-welcome-text">${this.escapeHtml(settings.welcomeMessage)}</p>
        </div>

        <!-- Quick Replies -->
        ${quickReplies.length > 0 ? `
          <div class="bab-quick-replies-section">
            <span class="bab-section-title">إجابات سريعة شائعة:</span>
            <div class="bab-quick-replies-list">
              ${quickReplies.map(qr => `
                <button class="bab-chip-btn qr-btn" data-article-id="${this.escapeHtml(qr.articleId || '')}" data-action="${this.escapeHtml(qr.action || '')}">
                  ${this.escapeHtml(qr.label)}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Categories Section -->
        <div class="bab-quick-replies-section">
          <span class="bab-section-title">تصفح أقسام المساعدة:</span>
          <div class="bab-categories-grid">
            ${categories.map(cat => `
              <button class="bab-category-card" data-category-id="${this.escapeHtml(cat.id)}" aria-label="قسم ${this.escapeHtml(cat.title)}">
                <div class="bab-category-main">
                  <div class="bab-category-icon-wrap">
                    ${ICONS[cat.icon] || ICONS.sparkles}
                  </div>
                  <div class="bab-category-info">
                    <div class="bab-category-title">${this.escapeHtml(cat.title)}</div>
                    <div class="bab-category-desc">${this.escapeHtml(cat.description)}</div>
                  </div>
                </div>
                <div class="bab-category-chevron">${ICONS.chevronLeft}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- WhatsApp Escalation Card -->
        <div class="bab-whatsapp-card" id="home-whatsapp-card">
          <div class="bab-whatsapp-info">
            <div class="bab-whatsapp-title">
              <span style="width: 18px; height: 18px; display: inline-block;">${ICONS.whatsapp}</span>
              <span>خدمة العملاء عبر واتساب</span>
            </div>
            <div class="bab-whatsapp-subtitle">هل تحتاجين مساعدة إضافية أو لديكِ استفسار خاص؟</div>
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
        <div style="padding: 2px 4px 6px;">
          <h2 style="font-size: 15px; font-weight: 800; color: var(--bab-dark); margin-bottom: 4px;">
            ${this.escapeHtml(activeCategory.title)}
          </h2>
          <p style="font-size: 12.5px; color: var(--bab-muted);">
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
              <div class="bab-category-chevron">${ICONS.chevronLeft}</div>
            </button>
          `).join('') : `
            <div class="bab-no-results-box">
              <p style="font-size: 13px; color: var(--bab-muted);">لا توجد مواضيع مضافة في هذا القسم حالياً.</p>
            </div>
          `}
        </div>

        <!-- WhatsApp Escalation in Category -->
        <div class="bab-whatsapp-card" id="category-whatsapp-card" style="margin-top: 10px;">
          <div class="bab-whatsapp-info">
            <div class="bab-whatsapp-title">تحدثي مع موظف خدمة العملاء</div>
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
              <span class="bab-article-category-badge">${this.escapeHtml(activeCategory.title)}</span>
            ` : ''}
            <h1 class="bab-article-main-title">${this.escapeHtml(activeArticle.title)}</h1>
            <p class="bab-article-main-question">${this.escapeHtml(activeArticle.question)}</p>

            ${activeArticle.alternativeQuestions && activeArticle.alternativeQuestions.length > 0 ? `
              <div class="bab-alt-questions-wrap">
                ${activeArticle.alternativeQuestions.map(alt => `
                  <span class="bab-alt-pill">${this.escapeHtml(alt)}</span>
                `).join('')}
              </div>
            ` : ''}
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
                  <a href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="bab-action-link">
                    <span>${this.escapeHtml(link.title)}</span>
                    <span class="bab-action-link-icon">${ICONS.externalLink}</span>
                  </a>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Helpfulness Feedback -->
          <div class="bab-feedback-box">
            <span>هل كانت هذه الإجابة مفيدة لكِ؟</span>
            <div class="bab-feedback-buttons">
              <button class="bab-feedback-btn ${feedback === 'yes' ? 'bab-highlighted' : ''}" id="feedback-yes-btn">
                ${feedback === 'yes' ? '🌸 شكرًا لكِ!' : '👍 نعم'}
              </button>
              <button class="bab-feedback-btn ${feedback === 'no' ? 'bab-highlighted' : ''}" id="feedback-no-btn">
                ${feedback === 'no' ? 'تم تسجيل رأيكِ' : '👎 لا'}
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
          <div class="bab-whatsapp-card" id="article-whatsapp-card">
            <div class="bab-whatsapp-info">
              <div class="bab-whatsapp-title">هل لديكِ استفسار آخر؟</div>
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
          <div class="bab-search-result-count">
            تم العثور على ${results.length} نتيجة لبحثكِ عن "${this.escapeHtml(this.searchQuery)}":
          </div>

          <div class="bab-search-results-list">
            ${results.map(art => `
              <button class="bab-article-item" data-article-id="${this.escapeHtml(art.id)}">
                <div>
                  <div class="bab-article-item-title">${this.escapeHtml(art.title)}</div>
                  <div class="bab-article-item-question">${this.escapeHtml(art.question)}</div>
                </div>
                <div class="bab-category-chevron">${ICONS.chevronLeft}</div>
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
              ${this.escapeHtml(settings.noResultsMessage || 'عذرًا، لم نتمكن من العثور على إجابة تطابق بحثكِ. يمكنكِ العودة للرئيسية أو التواصل مع خدمة العملاء.')}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 6px;">
              <button class="bab-chip-btn" id="search-go-home-btn">
                <span>${ICONS.home} العودة للرئيسية</span>
              </button>
              <button class="bab-chip-btn" id="search-whatsapp-btn" style="background: #25d366; color: #ffffff; border: none;">
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

    // Launcher click
    const launcher = root.querySelector('#launcher-btn');
    if (launcher) launcher.addEventListener('click', () => this.toggleWidget(true));

    // Header actions
    const closeBtn = root.querySelector('#close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.toggleWidget(false));

    const minBtn = root.querySelector('#minimize-btn');
    if (minBtn) minBtn.addEventListener('click', () => this.toggleWidget(false));

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

    const searchHome = root.querySelector('#search-go-home-btn');
    if (searchHome) searchHome.addEventListener('click', () => this.navigateHome());
  }
}

// Register custom element if not already defined
if (typeof customElements !== 'undefined' && !customElements.get('dandy-bab-widget')) {
  customElements.define('dandy-bab-widget', DandyBabWidget);
}
