/**
 * B.A.B — Beauty Assistant Bot
 * Local Administration Dashboard
 * Independent vanilla JS module for DANDY store managers
 */

import { normalizeArabic } from '../widget/bab-widget.js';

const STORAGE_KEY = 'dandy_bab_knowledge_data';
const LAST_SAVED_KEY = 'dandy_bab_last_saved';

class BabDashboard {
  constructor() {
    this.currentTab = 'overview';
    this.knowledge = null;
    this.originalKnowledge = null;
    this.searchQuery = '';
    this.categoryFilter = 'all';
    this.statusFilter = 'all';

    // Editing state
    this.editingCategory = null;
    this.editingArticle = null;

    // Elements
    this.contentEl = document.getElementById('dash-tab-content');
    this.topbarTitleEl = document.getElementById('dash-current-tab-title');
    this.saveIndicatorEl = document.getElementById('dash-save-status');

    this.init();
  }

  async init() {
    this.setupNavigation();
    await this.loadInitialData();
    this.setupGlobalModals();
    this.render();
  }

  async loadInitialData() {
    // 1. Try to load from localStorage first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.knowledge = JSON.parse(saved);
        this.updateSaveIndicator();
      } catch (e) {
        console.warn('Invalid JSON in localStorage, resetting to default', e);
      }
    }

    // 2. Load original from /data/knowledge.json
    try {
      const res = await fetch('/data/knowledge.json');
      if (res.ok) {
        this.originalKnowledge = await res.json();
        if (!this.knowledge) {
          this.knowledge = JSON.parse(JSON.stringify(this.originalKnowledge));
          this.saveWorkingData(false);
        }
      }
    } catch (err) {
      console.warn('Could not fetch /data/knowledge.json', err);
    }

    // Fallback if both failed
    if (!this.knowledge) {
      this.knowledge = {
        schemaVersion: 1,
        settings: {
          assistantName: "B.A.B",
          brandName: "DANDY",
          welcomeMessage: "أهلاً بكِ في DANDY!",
          supportWhatsapp: "201038941005"
        },
        categories: [],
        articles: [],
        quickReplies: [],
        fallback: {}
      };
    }
  }

  saveWorkingData(triggerPreview = true) {
    if (!this.knowledge) return;
    const now = new Date();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.knowledge, null, 2));
    localStorage.setItem(LAST_SAVED_KEY, now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    this.updateSaveIndicator();

    if (triggerPreview) {
      this.syncPreviewWidget();
    }
  }

  updateSaveIndicator() {
    const time = localStorage.getItem(LAST_SAVED_KEY);
    if (this.saveIndicatorEl) {
      this.saveIndicatorEl.innerHTML = `
        <span class="dash-save-dot"></span>
        <span>محفوظ محلياً ${time ? `(${time})` : ''}</span>
      `;
    }
  }

  syncPreviewWidget() {
    const previewWidget = document.querySelector('dandy-bab-widget#dash-preview-widget');
    if (previewWidget && typeof previewWidget.setKnowledgeData === 'function') {
      previewWidget.setKnowledgeData(this.knowledge);
    }
  }

  validateData() {
    const errors = [];
    const warnings = [];

    if (!this.knowledge) return { isValid: false, errors: ['لا توجد بيانات'], warnings: [] };

    const { categories = [], articles = [] } = this.knowledge;
    const categoryIds = new Set(categories.map(c => c.id));
    const articleIds = new Set();

    // Check Duplicate Categories
    const catCounts = {};
    for (const c of categories) {
      if (!c.id) errors.push('يوجد قسم بدون معرّف ID فريد.');
      if (!c.title) errors.push(`القسم "${c.id || 'بدون اسم'}" بدون عنوان.`);
      catCounts[c.id] = (catCounts[c.id] || 0) + 1;
    }
    for (const [id, count] of Object.entries(catCounts)) {
      if (count > 1) errors.push(`معرّف القسم (${id}) مكرر ${count} مرات.`);
    }

    // Check Articles
    for (const a of articles) {
      if (!a.id) errors.push('يوجد مقال بدون معرّف ID.');
      if (articleIds.has(a.id)) {
        errors.push(`معرّف المقال (${a.id}) مكرر.`);
      } else {
        articleIds.add(a.id);
      }

      if (!a.title) errors.push(`المقال (${a.id}) بدون عنوان.`);
      if (!a.categoryId || !categoryIds.has(a.categoryId)) {
        warnings.push(`المقال "${a.title || a.id}" مرتبط بقسم غير موجود (${a.categoryId || 'فارغ'}).`);
      }
      if (!a.answer || !a.answer.text || !a.answer.text.trim()) {
        warnings.push(`المقال "${a.title || a.id}" بدون نص إجابة.`);
      }
      if (!a.keywords || a.keywords.length === 0) {
        warnings.push(`المقال "${a.title || a.id}" لا يحتوي على كلمات مفتاحية للبحث.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  setupNavigation() {
    document.querySelectorAll('[data-dash-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-dash-tab');
        this.switchTab(tab);
      });
    });
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('[data-dash-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-dash-tab') === tab);
    });

    const titles = {
      overview: 'نظرة عامة والتحليلات المحلية',
      categories: 'إدارة الأقسام والتصنيفات',
      articles: 'بنك الأسئلة الشائعة والإجابات',
      keywords: 'إدارة الكلمات المفتاحية والمرادفات',
      quickreplies: 'أزرار الردود السريعة الترحيبية',
      settings: 'إعدادات المساعد والهوية البصرية',
      preview: 'المعاينة الحية والتجربة المباشرة',
      importexport: 'استيراد وتصدير قاعدة المعرفة (JSON)'
    };

    if (this.topbarTitleEl) {
      this.topbarTitleEl.textContent = titles[tab] || 'لوحة تحكم B.A.B';
    }

    this.render();
  }

  render() {
    if (!this.contentEl) return;

    switch (this.currentTab) {
      case 'overview':
        this.renderOverview();
        break;
      case 'categories':
        this.renderCategories();
        break;
      case 'articles':
        this.renderArticles();
        break;
      case 'keywords':
        this.renderKeywords();
        break;
      case 'quickreplies':
        this.renderQuickReplies();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'preview':
        this.renderPreview();
        break;
      case 'importexport':
        this.renderImportExport();
        break;
      default:
        this.renderOverview();
    }
  }

  // 1. OVERVIEW TAB
  renderOverview() {
    const { categories = [], articles = [], settings = {} } = this.knowledge || {};
    const validation = this.validateData();

    const enabledArticles = articles.filter(a => a.enabled !== false).length;
    const disabledArticles = articles.filter(a => a.enabled === false).length;
    const articlesWithoutKeywords = articles.filter(a => !a.keywords || a.keywords.length === 0).length;
    const articlesWithEmptyAnswer = articles.filter(a => !a.answer?.text || !a.answer.text.trim()).length;

    this.contentEl.innerHTML = `
      <!-- Validation Alerts if issues exist -->
      ${!validation.isValid ? `
        <div class="dash-alert dash-alert-danger">
          <div style="font-size: 20px;">⚠️</div>
          <div>
            <strong>توجد أخطاء في البيانات يجب تصحيحها:</strong>
            <ul style="margin: 6px 16px 0 0;">
              ${validation.errors.map(err => `<li>${this.escape(err)}</li>`).join('')}
            </ul>
          </div>
        </div>
      ` : ''}

      ${validation.warnings.length > 0 ? `
        <div class="dash-alert">
          <div style="font-size: 20px;">💡</div>
          <div>
            <strong>تنبيهات وملاحظات للتحسين:</strong>
            <ul style="margin: 6px 16px 0 0;">
              ${validation.warnings.slice(0, 4).map(warn => `<li>${this.escape(warn)}</li>`).join('')}
            </ul>
          </div>
        </div>
      ` : ''}

      <!-- Metric Cards -->
      <div class="dash-metrics-grid">
        <div class="dash-metric-card">
          <div class="dash-metric-info">
            <h3>إجمالي الأقسام</h3>
            <div class="value">${categories.length}</div>
          </div>
          <div class="dash-metric-icon">📁</div>
        </div>

        <div class="dash-metric-card">
          <div class="dash-metric-info">
            <h3>إجمالي المقالات والأسئلة</h3>
            <div class="value">${articles.length}</div>
          </div>
          <div class="dash-metric-icon">💬</div>
        </div>

        <div class="dash-metric-card">
          <div class="dash-metric-info">
            <h3>المقالات المفعلة</h3>
            <div class="value" style="color: #10b981;">${enabledArticles}</div>
          </div>
          <div class="dash-metric-icon" style="background: #ecfdf5; color: #10b981;">✅</div>
        </div>

        <div class="dash-metric-card">
          <div class="dash-metric-info">
            <h3>مقالات بحاجة لكلمات مفتاحية</h3>
            <div class="value" style="color: ${articlesWithoutKeywords > 0 ? '#f59e0b' : '#10b981'};">
              ${articlesWithoutKeywords}
            </div>
          </div>
          <div class="dash-metric-icon">🔍</div>
        </div>
      </div>

      <!-- Quick Actions and Assistant Info -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
        
        <!-- Assistant Identity Card -->
        <div class="dash-card">
          <div class="dash-card-header">
            <h3>معلومات المساعد الحالي</h3>
            <button class="btn btn-secondary btn-sm" id="ov-edit-settings-btn">تعديل الإعدادات</button>
          </div>
          <div class="dash-card-body">
            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13.5px;">
              <div><strong>اسم المساعد:</strong> ${this.escape(settings.assistantName || 'B.A.B')} (${this.escape(settings.brandName || 'DANDY')})</div>
              <div><strong>رقم واتساب المعتمد:</strong> <span dir="ltr">${this.escape(settings.supportWhatsapp || 'غير محدد')}</span></div>
              <div><strong>ساعات العمل الرسمية:</strong> ${this.escape(settings.supportHours || 'غير محددة')}</div>
              <div><strong>نسخة Schema:</strong> الإصدار ${this.escape(this.knowledge.schemaVersion || 1)}</div>
              <div><strong>حالة الحفظ:</strong> <span class="badge badge-success">محفوظ في المتصفح تلقائياً</span></div>
            </div>
          </div>
        </div>

        <!-- Publishing Instructions Banner -->
        <div class="dash-card" style="border-color: var(--dandy-border); background: linear-gradient(135deg, #ffffff 0%, #fffbfd 100%);">
          <div class="dash-card-header">
            <h3>آلية النشر على متجر DANDY</h3>
            <span class="badge badge-pink">مهم جداً</span>
          </div>
          <div class="dash-card-body" style="font-size: 13px; line-height: 1.6; color: var(--dandy-dark);">
            <p>التعديلات في هذه اللوحة تُحفظ محلياً في متصفحكِ لتسهيل العمل بأمان دون مساس بالمتجر الفعلي.</p>
            <ol style="margin: 10px 18px 0 0; display: flex; flex-direction: column; gap: 6px;">
              <li>قومي بإضافة أو تعديل الأسئلة والأقسام واختبارها عبر <strong>المعاينة الحية</strong>.</li>
              <li>انتقلي إلى تبويب <strong>استيراد / تصدير</strong> واضغطي <strong>تصدير knowledge.json</strong>.</li>
              <li>استبدلي ملف <code>public/assets/bab/data/knowledge.json</code> بالملف المُصدّر.</li>
            </ol>
            <div style="margin-top: 14px;">
              <button class="btn btn-primary btn-sm" id="ov-export-btn">تصدير الآن (knowledge.json)</button>
            </div>
          </div>
        </div>

      </div>

      <!-- Recent Articles Table -->
      <div class="dash-card">
        <div class="dash-card-header">
          <h3>أحدث المقالات المضافة</h3>
          <button class="btn btn-primary btn-sm" id="ov-add-article-btn">+ إضافة مقال جديد</button>
        </div>
        <div class="dash-table-wrap">
          <table class="dash-table">
            <thead>
              <tr>
                <th>العنوان</th>
                <th>القسم</th>
                <th>السؤال الرئيسي</th>
                <th>الكلمات المفتاحية</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              ${articles.slice(0, 5).map(art => {
                const cat = categories.find(c => c.id === art.categoryId);
                return `
                  <tr>
                    <td><strong>${this.escape(art.title)}</strong></td>
                    <td><span class="badge badge-secondary">${this.escape(cat?.title || art.categoryId)}</span></td>
                    <td style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escape(art.question)}</td>
                    <td>
                      <span class="badge badge-pink">${(art.keywords || []).length} كلمات</span>
                    </td>
                    <td>
                      <span class="badge ${art.enabled !== false ? 'badge-success' : 'badge-danger'}">
                        ${art.enabled !== false ? 'مفعّل' : 'معطّل'}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-sm edit-art-btn" data-id="${this.escape(art.id)}">تعديل</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('ov-edit-settings-btn')?.addEventListener('click', () => this.switchTab('settings'));
    document.getElementById('ov-export-btn')?.addEventListener('click', () => this.exportKnowledgeJson());
    document.getElementById('ov-add-article-btn')?.addEventListener('click', () => this.openArticleModal());

    this.contentEl.querySelectorAll('.edit-art-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const artId = btn.getAttribute('data-id');
        const art = this.knowledge.articles.find(a => a.id === artId);
        if (art) this.openArticleModal(art);
      });
    });
  }

  // 2. CATEGORIES TAB
  renderCategories() {
    const { categories = [], articles = [] } = this.knowledge || {};

    this.contentEl.innerHTML = `
      <div class="dash-card">
        <div class="dash-card-header">
          <h3>قائمة الأقسام (${categories.length})</h3>
          <button class="btn btn-primary btn-sm" id="cat-add-btn">+ إضافة قسم جديد</button>
        </div>
        <div class="dash-table-wrap">
          <table class="dash-table">
            <thead>
              <tr>
                <th style="width: 50px;">الترتيب</th>
                <th style="width: 60px;">الأيقونة</th>
                <th>اسم القسم</th>
                <th>الوصف</th>
                <th>عدد المقالات</th>
                <th>الحالة</th>
                <th style="text-align: left;">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${categories.map((cat, idx) => {
                const count = articles.filter(a => a.categoryId === cat.id).length;
                return `
                  <tr>
                    <td><strong>${cat.order || idx + 1}</strong></td>
                    <td style="font-size: 18px;">${this.getCategoryIconSymbol(cat.icon)}</td>
                    <td><strong>${this.escape(cat.title)}</strong><br><small style="color: var(--dandy-muted);">ID: ${this.escape(cat.id)}</small></td>
                    <td style="max-width: 280px;">${this.escape(cat.description)}</td>
                    <td><span class="badge badge-pink">${count} مقالات</span></td>
                    <td>
                      <span class="badge ${cat.enabled !== false ? 'badge-success' : 'badge-danger'}">
                        ${cat.enabled !== false ? 'مفعّل' : 'معطّل'}
                      </span>
                    </td>
                    <td style="text-align: left;">
                      <button class="btn btn-secondary btn-sm cat-edit-btn" data-id="${this.escape(cat.id)}">تعديل</button>
                      <button class="btn btn-danger btn-sm cat-delete-btn" data-id="${this.escape(cat.id)}">حذف</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('cat-add-btn')?.addEventListener('click', () => this.openCategoryModal());

    this.contentEl.querySelectorAll('.cat-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const cat = categories.find(c => c.id === id);
        if (cat) this.openCategoryModal(cat);
      });
    });

    this.contentEl.querySelectorAll('.cat-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.confirmDeleteCategory(id);
      });
    });
  }

  getCategoryIconSymbol(iconName) {
    const map = {
      sparkles: '✨',
      truck: '🚚',
      'rotate-ccw': '🔄',
      tag: '🏷️',
      user: '👤',
      'credit-card': '💳',
      'message-circle': '💬'
    };
    return map[iconName] || '📁';
  }

  // 3. ARTICLES TAB
  renderArticles() {
    const { categories = [], articles = [] } = this.knowledge || {};

    // Filter
    let filtered = articles;
    if (this.categoryFilter !== 'all') {
      filtered = filtered.filter(a => a.categoryId === this.categoryFilter);
    }
    if (this.statusFilter !== 'all') {
      const isEnabled = this.statusFilter === 'enabled';
      filtered = filtered.filter(a => (a.enabled !== false) === isEnabled);
    }
    if (this.searchQuery.trim()) {
      const q = normalizeArabic(this.searchQuery);
      filtered = filtered.filter(a => {
        return normalizeArabic(a.title || '').includes(q) ||
               normalizeArabic(a.question || '').includes(q) ||
               (a.keywords || []).some(k => normalizeArabic(k).includes(q));
      });
    }

    this.contentEl.innerHTML = `
      <!-- Filters bar -->
      <div class="dash-card" style="margin-bottom: 16px;">
        <div class="dash-card-body" style="padding: 16px 20px;">
          <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 12px; flex-wrap: wrap; flex: 1;">
              <input 
                type="text" 
                class="form-input" 
                placeholder="بحث في المقالات والأسئلة والكلمات..." 
                value="${this.escape(this.searchQuery)}" 
                id="art-search-input"
                style="max-width: 280px;"
              />
              <select class="form-select" id="art-category-filter" style="max-width: 200px;">
                <option value="all">جميع الأقسام</option>
                ${categories.map(c => `
                  <option value="${this.escape(c.id)}" ${this.categoryFilter === c.id ? 'selected' : ''}>
                    ${this.escape(c.title)}
                  </option>
                `).join('')}
              </select>
              <select class="form-select" id="art-status-filter" style="max-width: 150px;">
                <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>جميع الحالات</option>
                <option value="enabled" ${this.statusFilter === 'enabled' ? 'selected' : ''}>المفعلة فقط</option>
                <option value="disabled" ${this.statusFilter === 'disabled' ? 'selected' : ''}>المعطلة فقط</option>
              </select>
            </div>
            <button class="btn btn-primary" id="art-add-btn">+ إضافة مقال جديد</button>
          </div>
        </div>
      </div>

      <!-- Articles list table -->
      <div class="dash-card">
        <div class="dash-card-header">
          <h3>الأسئلة والإجابات (${filtered.length} من إجمالي ${articles.length})</h3>
        </div>
        <div class="dash-table-wrap">
          <table class="dash-table">
            <thead>
              <tr>
                <th style="width: 50px;">ترتيب</th>
                <th>عنوان المقال</th>
                <th>القسم</th>
                <th>السؤال الرئيسي</th>
                <th>الكلمات المفتاحية</th>
                <th>روابط مرفقة</th>
                <th>الحالة</th>
                <th style="text-align: left;">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length > 0 ? filtered.map((art, idx) => {
                const cat = categories.find(c => c.id === art.categoryId);
                return `
                  <tr>
                    <td><strong>${art.order || idx + 1}</strong></td>
                    <td>
                      <strong>${this.escape(art.title)}</strong>
                      <br><small style="color: var(--dandy-muted);">ID: ${this.escape(art.id)}</small>
                    </td>
                    <td><span class="badge badge-secondary">${this.escape(cat?.title || art.categoryId)}</span></td>
                    <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${this.escape(art.question)}
                    </td>
                    <td>
                      <span class="badge ${art.keywords?.length ? 'badge-pink' : 'badge-danger'}">
                        ${art.keywords?.length || 0} كلمات
                      </span>
                    </td>
                    <td>
                      <span class="badge badge-secondary">
                        ${art.answer?.links?.length || 0} رابط
                      </span>
                    </td>
                    <td>
                      <span class="badge ${art.enabled !== false ? 'badge-success' : 'badge-danger'}">
                        ${art.enabled !== false ? 'مفعّل' : 'معطّل'}
                      </span>
                    </td>
                    <td style="text-align: left;">
                      <button class="btn btn-secondary btn-sm art-edit-btn" data-id="${this.escape(art.id)}">تعديل</button>
                      <button class="btn btn-danger btn-sm art-delete-btn" data-id="${this.escape(art.id)}">حذف</button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 40px; color: var(--dandy-muted);">
                    لا توجد مقالات مطابقة لمعايير البحث الحالية.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('art-search-input')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderArticles();
    });

    document.getElementById('art-category-filter')?.addEventListener('change', (e) => {
      this.categoryFilter = e.target.value;
      this.renderArticles();
    });

    document.getElementById('art-status-filter')?.addEventListener('change', (e) => {
      this.statusFilter = e.target.value;
      this.renderArticles();
    });

    document.getElementById('art-add-btn')?.addEventListener('click', () => this.openArticleModal());

    this.contentEl.querySelectorAll('.art-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const art = articles.find(a => a.id === id);
        if (art) this.openArticleModal(art);
      });
    });

    this.contentEl.querySelectorAll('.art-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.confirmDeleteArticle(id);
      });
    });
  }

  // 4. KEYWORDS & SYNONYMS TAB
  renderKeywords() {
    const { articles = [] } = this.knowledge || {};

    // Collect all keywords and synonyms
    const termMap = new Map(); // term -> array of article titles
    articles.forEach(art => {
      const allTerms = [...(art.keywords || []), ...(art.synonyms || [])];
      allTerms.forEach(t => {
        const norm = t.trim();
        if (!norm) return;
        if (!termMap.has(norm)) {
          termMap.set(norm, []);
        }
        termMap.get(norm).push(art);
      });
    });

    const articlesWithoutKw = articles.filter(a => !a.keywords || a.keywords.length === 0);

    this.contentEl.innerHTML = `
      ${articlesWithoutKw.length > 0 ? `
        <div class="dash-alert">
          <div style="font-size: 20px;">⚠️</div>
          <div>
            <strong>توجد (${articlesWithoutKw.length}) مقالات بدون كلمات مفتاحية:</strong>
            <div style="margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap;">
              ${articlesWithoutKw.map(a => `
                <button class="btn btn-secondary btn-sm edit-art-from-kw" data-id="${this.escape(a.id)}">
                  ${this.escape(a.title)} (إضافة كلمات)
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <div class="dash-card">
        <div class="dash-card-header">
          <h3>فهرس الكلمات المفتاحية والمرادفات (${termMap.size} كلمة مسجلة)</h3>
        </div>
        <div class="dash-table-wrap">
          <table class="dash-table">
            <thead>
              <tr>
                <th>الكلمة / العبارة</th>
                <th>المقالات المرتبطة</th>
                <th>تكرار الكلمة</th>
                <th style="text-align: left;">إجراء</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from(termMap.entries()).map(([term, arts]) => {
                const isDuplicate = arts.length > 1;
                return `
                  <tr>
                    <td><strong>${this.escape(term)}</strong></td>
                    <td>
                      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${arts.map(a => `
                          <span class="badge badge-secondary" title="${this.escape(a.title)}">
                            ${this.escape(a.title)}
                          </span>
                        `).join('')}
                      </div>
                    </td>
                    <td>
                      <span class="badge ${isDuplicate ? 'badge-warning' : 'badge-success'}">
                        ${arts.length} ${arts.length === 1 ? 'مقال' : 'مقالات'}
                      </span>
                    </td>
                    <td style="text-align: left;">
                      <button class="btn btn-secondary btn-sm edit-art-from-kw" data-id="${this.escape(arts[0].id)}">
                        تعديل المقال
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.contentEl.querySelectorAll('.edit-art-from-kw').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const art = articles.find(a => a.id === id);
        if (art) this.openArticleModal(art);
      });
    });
  }

  // 5. QUICK REPLIES TAB
  renderQuickReplies() {
    const { quickReplies = [], articles = [] } = this.knowledge || {};

    this.contentEl.innerHTML = `
      <div class="dash-card">
        <div class="dash-card-header">
          <h3>أزرار الردود السريعة (الشاشة الترحيبية)</h3>
          <button class="btn btn-primary btn-sm" id="qr-add-btn">+ إضافة زر رد سريع</button>
        </div>
        <div class="dash-card-body">
          <p style="font-size: 13px; color: var(--dandy-muted); margin-bottom: 16px;">
            تظهر هذه الأزرار كخيارات جاهزة في أعلى شاشة المساعد فور فتحه لتسهيل وصول العميل بنقرة واحدة.
          </p>
          <div class="dash-table-wrap">
            <table class="dash-table">
              <thead>
                <tr>
                  <th>نص الزر الترحيبي</th>
                  <th>نوع الإجراء</th>
                  <th>الوجهة المحددة</th>
                  <th style="text-align: left;">إجراء</th>
                </tr>
              </thead>
              <tbody>
                ${quickReplies.map((qr, idx) => {
                  const targetArt = articles.find(a => a.id === qr.articleId);
                  const isWa = qr.action === 'whatsapp';
                  return `
                    <tr>
                      <td><strong>${this.escape(qr.label)}</strong></td>
                      <td>
                        <span class="badge ${isWa ? 'badge-success' : 'badge-pink'}">
                          ${isWa ? '💬 محادثة واتساب' : '📄 فتح مقال'}
                        </span>
                      </td>
                      <td>
                        ${isWa ? 'محادثة فورية مع خدمة العملاء' : this.escape(targetArt?.title || qr.articleId || 'غير محدد')}
                      </td>
                      <td style="text-align: left;">
                        <button class="btn btn-danger btn-sm qr-delete-btn" data-index="${idx}">حذف</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('qr-add-btn')?.addEventListener('click', () => this.openQuickReplyModal());

    this.contentEl.querySelectorAll('.qr-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          this.knowledge.quickReplies.splice(idx, 1);
          this.saveWorkingData();
          this.renderQuickReplies();
        }
      });
    });
  }

  // 6. SETTINGS TAB
  renderSettings() {
    const s = this.knowledge?.settings || {};
    const t = s.theme || {};

    this.contentEl.innerHTML = `
      <form id="dash-settings-form" class="dash-card">
        <div class="dash-card-header">
          <h3>إعدادات وهوية المساعد B.A.B</h3>
          <button type="submit" class="btn btn-primary">حفظ الإعدادات</button>
        </div>
        <div class="dash-card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px;">
            
            <div class="form-group">
              <label class="form-label">اسم المساعد (Assistant Name)</label>
              <input type="text" class="form-input" name="assistantName" value="${this.escape(s.assistantName || 'B.A.B')}" required />
            </div>

            <div class="form-group">
              <label class="form-label">الوصف الفرعي (Subtitle)</label>
              <input type="text" class="form-input" name="assistantSubtitle" value="${this.escape(s.assistantSubtitle || 'مساعد DANDY الذكي')}" />
            </div>

            <div class="form-group">
              <label class="form-label">اسم المتجر (Brand Name)</label>
              <input type="text" class="form-input" name="brandName" value="${this.escape(s.brandName || 'DANDY')}" required />
            </div>

            <div class="form-group">
              <label class="form-label">رقم واتساب للدعم الفني (مع كود الدولة 20)</label>
              <input type="text" class="form-input" name="supportWhatsapp" value="${this.escape(s.supportWhatsapp || '201038941005')}" dir="ltr" required />
              <div class="form-help">مثال: 201038941005 (يُستخدم لفتح رابط wa.me المباشر)</div>
            </div>

            <div class="form-group">
              <label class="form-label">رقم الهاتف المحلي للعرض</label>
              <input type="text" class="form-input" name="supportPhone" value="${this.escape(s.supportPhone || '01038941005')}" dir="ltr" />
            </div>

            <div class="form-group">
              <label class="form-label">مواعيد العمل الرسمية</label>
              <input type="text" class="form-input" name="supportHours" value="${this.escape(s.supportHours || 'يوميًا من 10:00 صباحًا حتى 10:00 مساءً')}" />
            </div>

            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">رسالة الترحيب الأولى (Welcome Message)</label>
              <textarea class="form-textarea" rows="3" name="welcomeMessage" required>${this.escape(s.welcomeMessage || '')}</textarea>
            </div>

            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">نص شريط البحث (Search Placeholder)</label>
              <input type="text" class="form-input" name="searchPlaceholder" value="${this.escape(s.searchPlaceholder || '')}" />
            </div>

            <div class="form-group" style="grid-column: 1 / -1;">
              <label class="form-label">رسالة عدم وجود نتائج (No Results Message)</label>
              <textarea class="form-textarea" rows="2" name="noResultsMessage">${this.escape(s.noResultsMessage || '')}</textarea>
            </div>

          </div>

          <!-- Color Theme Settings -->
          <h4 style="font-size: 15px; font-weight: 800; color: var(--dandy-dark); margin: 24px 0 14px; border-top: 1px solid #f3e8ee; padding-top: 20px;">
            🎨 ألوان الهوية البصرية (Theme Colors)
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
            <div class="form-group">
              <label class="form-label">اللون الرئيسي (Primary)</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="color" name="theme_primary" value="${this.escape(t.primary || '#fe5d9f')}" style="width: 44px; height: 38px; border: none; cursor: pointer; border-radius: 6px;" />
                <input type="text" class="form-input" name="theme_primary_text" value="${this.escape(t.primary || '#fe5d9f')}" dir="ltr" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">اللون الثانوي (Secondary)</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="color" name="theme_secondary" value="${this.escape(t.secondary || '#db2777')}" style="width: 44px; height: 38px; border: none; cursor: pointer; border-radius: 6px;" />
                <input type="text" class="form-input" name="theme_secondary_text" value="${this.escape(t.secondary || '#db2777')}" dir="ltr" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">اللون الداكن (Dark)</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="color" name="theme_dark" value="${this.escape(t.dark || '#38121d')}" style="width: 44px; height: 38px; border: none; cursor: pointer; border-radius: 6px;" />
                <input type="text" class="form-input" name="theme_dark_text" value="${this.escape(t.dark || '#38121d')}" dir="ltr" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">لون الخلفية (Background)</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="color" name="theme_background" value="${this.escape(t.background || '#fdf2f8')}" style="width: 44px; height: 38px; border: none; cursor: pointer; border-radius: 6px;" />
                <input type="text" class="form-input" name="theme_background_text" value="${this.escape(t.background || '#fdf2f8')}" dir="ltr" />
              </div>
            </div>
          </div>

        </div>
      </form>
    `;

    // Bind color inputs to text inputs
    const form = document.getElementById('dash-settings-form');
    ['primary', 'secondary', 'dark', 'background'].forEach(k => {
      const colInput = form.querySelector(`input[name="theme_${k}"]`);
      const txtInput = form.querySelector(`input[name="theme_${k}_text"]`);
      colInput?.addEventListener('input', () => { txtInput.value = colInput.value; });
      txtInput?.addEventListener('input', () => { colInput.value = txtInput.value; });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);

      this.knowledge.settings = {
        ...this.knowledge.settings,
        assistantName: fd.get('assistantName'),
        assistantSubtitle: fd.get('assistantSubtitle'),
        brandName: fd.get('brandName'),
        supportWhatsapp: fd.get('supportWhatsapp'),
        supportPhone: fd.get('supportPhone'),
        supportHours: fd.get('supportHours'),
        welcomeMessage: fd.get('welcomeMessage'),
        searchPlaceholder: fd.get('searchPlaceholder'),
        noResultsMessage: fd.get('noResultsMessage'),
        theme: {
          primary: fd.get('theme_primary'),
          secondary: fd.get('theme_secondary'),
          dark: fd.get('theme_dark'),
          background: fd.get('theme_background'),
          surface: '#ffffff'
        }
      };

      this.saveWorkingData();
      alert('تم حفظ إعدادات المساعد بنجاح وتحديث المعاينة.');
    });
  }

  // 7. PREVIEW TAB
  renderPreview() {
    this.contentEl.innerHTML = `
      <div class="preview-layout">
        
        <!-- Controls & Description -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="dash-card">
            <div class="dash-card-header">
              <h3>المعاينة الحية التفاعلية للمساعد B.A.B</h3>
              <button class="btn btn-primary btn-sm" id="sync-preview-now-btn">تحديث البيانات الآن</button>
            </div>
            <div class="dash-card-body" style="font-size: 13.5px; line-height: 1.6; color: var(--dandy-dark);">
              <p>تستخدم هذه المعاينة المكون الفعلي <code>&lt;dandy-bab-widget&gt;</code> مع تقنية Shadow DOM تماماً كما سيظهر على متجر DANDY.</p>
              <div style="margin-top: 12px; padding: 12px; background: var(--dandy-bg); border-radius: 12px; border: 1px solid var(--dandy-border);">
                <strong>طريقة التجربة:</strong>
                <ul style="margin: 6px 18px 0 0; display: flex; flex-direction: column; gap: 4px; font-size: 13px;">
                  <li>اضغطي على الزر الوردي العائم أسفل اليسار لفتح المساعد.</li>
                  <li>جرّبي البحث (مثلاً: "مدة الشحن"، "شحن مجاني").</li>
                  <li>تصفحي الأقسام واقرئي الإجابات المعتمدة.</li>
                  <li>تأكدي من عمل روابط DANDY وزر واتساب بدقة.</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="dash-card">
            <div class="dash-card-header">
              <h3>فحص التوافقية والأمان</h3>
            </div>
            <div class="dash-card-body" style="font-size: 13px;">
              <ul style="display: flex; flex-direction: column; gap: 8px;">
                <li>🔒 <strong>انعدام الربط مع الذكاء الاصطناعي الخارجي:</strong> يعمل النظام بالكامل عبر محرك محلي بالقواعد الثابتة.</li>
                <li>🛡️ <strong>حماية الخصوصية:</strong> لا يطلب المساعد أرقام طلبات أو بطاقات داخل المحادثة ويوجه فقط للصفحات الرسمية.</li>
                <li>📦 <strong>عزل الأنماط (Shadow DOM):</strong> لا تتأثر أنماط المتجر بأنماط المساعد والعكس.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Phone / Mock Frame with Embedded Widget -->
        <div class="preview-phone-frame">
          <div class="preview-phone-header">
            <span>DANDY Store Preview Simulation</span>
            <span>https://dandy-ebon.vercel.app</span>
          </div>
          
          <div class="preview-stage" id="preview-stage-container">
            <div style="padding: 24px; text-align: center; color: var(--dandy-muted);">
              <div style="font-size: 22px; font-weight: 800; color: var(--dandy-dark); margin-bottom: 6px;">DANDY BEAUTY STORE</div>
              <p style="font-size: 12px;">المساعد عائم أسفل اليسار. اضغطي عليه لتجربته الآن ⬇️</p>
            </div>

            <!-- The Real Web Component Instance -->
            <dandy-bab-widget id="dash-preview-widget" embedded open></dandy-bab-widget>
          </div>
        </div>

      </div>
    `;

    document.getElementById('sync-preview-now-btn')?.addEventListener('click', () => {
      this.syncPreviewWidget();
      alert('تمت مزامنة بيانات المعاينة بنجاح!');
    });

    // Inject data into preview widget
    setTimeout(() => this.syncPreviewWidget(), 100);
  }

  // 8. IMPORT / EXPORT TAB
  renderImportExport() {
    this.contentEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px;">
        
        <!-- Export Box -->
        <div class="dash-card">
          <div class="dash-card-header">
            <h3>تصدير قاعدة المعرفة (Export JSON)</h3>
            <span class="badge badge-success">جاهز للتصدير</span>
          </div>
          <div class="dash-card-body" style="font-size: 13.5px; line-height: 1.6;">
            <p>قومي بتحميل النسخة الأحدث من قاعدة المعرفة <code>knowledge.json</code> التي تحتوي على جميع تعديلاتكِ الحالية.</p>
            <div style="margin-top: 18px;">
              <button class="btn btn-primary" id="btn-export-json">
                📥 تحميل ملف knowledge.json
              </button>
            </div>
          </div>
        </div>

        <!-- Import Box -->
        <div class="dash-card">
          <div class="dash-card-header">
            <h3>استيراد قاعدة معرفة (Import JSON)</h3>
            <span class="badge badge-pink">فحص تلقائي</span>
          </div>
          <div class="dash-card-body" style="font-size: 13.5px; line-height: 1.6;">
            <p>يمكنكِ استيراد ملف <code>knowledge.json</code> سابق. سيقوم النظام بفحص هيكلية الملف والتحقق من صحته قبل اعتماده.</p>
            <div style="margin-top: 18px;">
              <input type="file" id="json-file-input" accept=".json" style="display: none;" />
              <button class="btn btn-secondary" id="btn-trigger-import">
                📤 اختيار ملف JSON للاستيراد
              </button>
            </div>
            <div id="import-status-msg" style="margin-top: 12px; font-size: 12.5px;"></div>
          </div>
        </div>

        <!-- Reset Box -->
        <div class="dash-card" style="border-color: #fecaca;">
          <div class="dash-card-header" style="background: #fff5f5;">
            <h3 style="color: #b91c1c;">استعادة البيانات الأصلية (Reset)</h3>
            <span class="badge badge-danger">إجراء حساس</span>
          </div>
          <div class="dash-card-body" style="font-size: 13.5px; line-height: 1.6;">
            <p>إذا رغبتِ في إلغاء كافة التعديلات المحلية والعودة إلى البيانات الأصلية المعتمدة للمتجر، يمكنكِ استعادة النسخة الافتراضية.</p>
            <div style="margin-top: 18px;">
              <button class="btn btn-danger" id="btn-reset-default">
                🔄 استعادة البيانات الافتراضية
              </button>
            </div>
          </div>
        </div>

        <!-- Publishing Guide Card -->
        <div class="dash-card" style="grid-column: 1 / -1; background: #fffbfd; border-color: var(--dandy-border);">
          <div class="dash-card-header">
            <h3>دليل نشر المساعد على موقع DANDY الفعلي</h3>
          </div>
          <div class="dash-card-body" style="font-size: 13.5px; line-height: 1.7; color: var(--dandy-dark);">
            <p>عند الرغبة في إتاحة التعديلات لزوار متجر DANDY الرسمي، اتبعي الخطوات الثلاث البسيطة التالية:</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 14px;">
              <div style="background: #ffffff; padding: 14px; border-radius: 12px; border: 1px solid var(--dandy-border);">
                <strong>1. تصدير الملف:</strong>
                <p style="font-size: 12.5px; color: var(--dandy-muted); margin-top: 4px;">اضغطي على زر "تحميل ملف knowledge.json" أعلاه للحصول على أحدث نسخة.</p>
              </div>
              <div style="background: #ffffff; padding: 14px; border-radius: 12px; border: 1px solid var(--dandy-border);">
                <strong>2. استبدال الملف في المشروع:</strong>
                <p style="font-size: 12.5px; color: var(--dandy-muted); margin-top: 4px;">ضعي الملف المصدّر في مسار <code>public/assets/bab/data/knowledge.json</code>.</p>
              </div>
              <div style="background: #ffffff; padding: 14px; border-radius: 12px; border: 1px solid var(--dandy-border);">
                <strong>3. النشر:</strong>
                <p style="font-size: 12.5px; color: var(--dandy-muted); margin-top: 4px;">ارفعي التعديلات إلى الاستضافة وسيظهر المحتوى المحدث لجميع الزوار فوراً.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    document.getElementById('btn-export-json')?.addEventListener('click', () => this.exportKnowledgeJson());
    
    const fileInput = document.getElementById('json-file-input');
    document.getElementById('btn-trigger-import')?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => this.handleImportFile(e));

    document.getElementById('btn-reset-default')?.addEventListener('click', () => this.confirmResetDefault());
  }

  exportKnowledgeJson() {
    const jsonStr = JSON.stringify(this.knowledge, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  handleImportFile(e) {
    const file = e.target.files?.[0];
    const statusEl = document.getElementById('import-status-msg');
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('ملف JSON غير صالح.');
        }
        if (!parsed.categories || !Array.isArray(parsed.categories)) {
          throw new Error('الملف لا يحتوي على مصفوفة الأقسام (categories).');
        }
        if (!parsed.articles || !Array.isArray(parsed.articles)) {
          throw new Error('الملف لا يحتوي على مصفوفة المقالات (articles).');
        }

        // Successfully verified
        this.knowledge = parsed;
        this.saveWorkingData();
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">✅ تم استيراد الملف وحفظه بنجاح! تم تحديث ${parsed.articles.length} مقال و ${parsed.categories.length} قسم.</span>`;
        }
        setTimeout(() => this.render(), 1200);
      } catch (err) {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #dc2626; font-weight: 700;">❌ فشل الاستيراد: ${this.escape(err.message)}</span>`;
        }
      }
    };
    reader.readAsText(file);
  }

  confirmResetDefault() {
    if (confirm('هل أنتِ متأكدة من رغبتكِ في استعادة البيانات الافتراضية؟ سيتم إلغاء كافة التعديلات المحلية غير المصدرة.')) {
      if (this.originalKnowledge) {
        this.knowledge = JSON.parse(JSON.stringify(this.originalKnowledge));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      this.saveWorkingData();
      alert('تمت استعادة البيانات الافتراضية بنجاح.');
      this.render();
    }
  }

  // --- MODALS (Category, Article, QuickReply) ---

  setupGlobalModals() {
    // Backdrop close handlers
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
  }

  openCategoryModal(cat = null) {
    let overlay = document.getElementById('modal-category-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-category-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    const isEdit = Boolean(cat);
    const c = cat || {
      id: `cat-${Date.now()}`,
      title: '',
      description: '',
      icon: 'sparkles',
      order: (this.knowledge.categories?.length || 0) + 1,
      enabled: true
    };

    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>${isEdit ? 'تعديل القسم' : 'إضافة قسم جديد'}</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>
        <form id="category-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">معرّف القسم الفريد (ID)</label>
              <input type="text" class="form-input" name="id" value="${this.escape(c.id)}" ${isEdit ? 'readonly style="background: #f9fafb;"' : 'required'} />
            </div>

            <div class="form-group">
              <label class="form-label">عنوان القسم</label>
              <input type="text" class="form-input" name="title" value="${this.escape(c.title)}" required />
            </div>

            <div class="form-group">
              <label class="form-label">وصف القسم المختصر</label>
              <textarea class="form-textarea" rows="2" name="description">${this.escape(c.description)}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">أيقونة القسم</label>
              <select class="form-select" name="icon">
                <option value="sparkles" ${c.icon === 'sparkles' ? 'selected' : ''}>✨ لمعان وعناية (sparkles)</option>
                <option value="truck" ${c.icon === 'truck' ? 'selected' : ''}>🚚 شحن وتوصيل (truck)</option>
                <option value="rotate-ccw" ${c.icon === 'rotate-ccw' ? 'selected' : ''}>🔄 استرجاع واستبدال (rotate-ccw)</option>
                <option value="tag" ${c.icon === 'tag' ? 'selected' : ''}>🏷️ عروض وخصومات (tag)</option>
                <option value="user" ${c.icon === 'user' ? 'selected' : ''}>👤 حساب شخصي (user)</option>
                <option value="credit-card" ${c.icon === 'credit-card' ? 'selected' : ''}>💳 دفع وتأكيد (credit-card)</option>
                <option value="message-circle" ${c.icon === 'message-circle' ? 'selected' : ''}>💬 خدمة عملاء (message-circle)</option>
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label">ترتيب العرض</label>
                <input type="number" class="form-input" name="order" value="${c.order || 1}" min="1" />
              </div>
              <div class="form-group">
                <label class="form-label">حالة التفعيل</label>
                <select class="form-select" name="enabled">
                  <option value="true" ${c.enabled !== false ? 'selected' : ''}>مفعّل (ظاهر للعميل)</option>
                  <option value="false" ${c.enabled === false ? 'selected' : ''}>معطّل (مخفي)</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">إلغاء</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'حفظ التعديلات' : 'إضافة القسم'}</button>
          </div>
        </form>
      </div>
    `;

    overlay.classList.add('active');

    overlay.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => overlay.classList.remove('active'));
    });

    overlay.querySelector('#category-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const catData = {
        id: fd.get('id').trim(),
        title: fd.get('title').trim(),
        description: fd.get('description').trim(),
        icon: fd.get('icon'),
        order: parseInt(fd.get('order'), 10) || 1,
        enabled: fd.get('enabled') === 'true'
      };

      if (!this.knowledge.categories) this.knowledge.categories = [];

      if (isEdit) {
        const idx = this.knowledge.categories.findIndex(x => x.id === c.id);
        if (idx !== -1) this.knowledge.categories[idx] = catData;
      } else {
        // Prevent duplicate ID
        if (this.knowledge.categories.some(x => x.id === catData.id)) {
          alert('معرّف القسم (ID) مسجل مسبقاً! يُرجى اختيار معرّف فريد.');
          return;
        }
        this.knowledge.categories.push(catData);
      }

      this.saveWorkingData();
      overlay.classList.remove('active');
      this.render();
    });
  }

  confirmDeleteCategory(catId) {
    const count = (this.knowledge.articles || []).filter(a => a.categoryId === catId).length;
    if (count > 0) {
      const targetCat = this.knowledge.categories.find(c => c.id !== catId);
      const msg = `تنبيه: هذا القسم يحتوي على (${count}) مقالات مسجلة.\n\nهل ترغبين في حذف القسم ونقل مقالاته إلى قسم آخر (${targetCat ? targetCat.title : 'افتراضي'})؟`;
      if (confirm(msg)) {
        if (targetCat) {
          this.knowledge.articles.forEach(a => {
            if (a.categoryId === catId) a.categoryId = targetCat.id;
          });
        }
        this.knowledge.categories = this.knowledge.categories.filter(c => c.id !== catId);
        this.saveWorkingData();
        this.render();
      }
    } else {
      if (confirm('هل أنتِ متأكدة من حذف هذا القسم؟')) {
        this.knowledge.categories = this.knowledge.categories.filter(c => c.id !== catId);
        this.saveWorkingData();
        this.render();
      }
    }
  }

  openArticleModal(art = null) {
    let overlay = document.getElementById('modal-article-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-article-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    const isEdit = Boolean(art);
    const a = art || {
      id: `art-${Date.now()}`,
      categoryId: this.knowledge.categories?.[0]?.id || '',
      title: '',
      question: '',
      alternativeQuestions: [],
      keywords: [],
      synonyms: [],
      answer: { text: '', steps: [], links: [] },
      relatedIds: [],
      enabled: true,
      order: (this.knowledge.articles?.length || 0) + 1
    };

    // Tag arrays in memory during editing
    const altQuestions = [...(a.alternativeQuestions || [])];
    const keywords = [...(a.keywords || [])];
    const synonyms = [...(a.synonyms || [])];
    const steps = [...(a.answer?.steps || [])];
    const links = JSON.parse(JSON.stringify(a.answer?.links || []));

    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 780px;">
        <div class="modal-header">
          <h3>${isEdit ? 'تعديل المقال والسؤال' : 'إضافة سؤال وإجابة جديدة'}</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>
        <form id="article-form">
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label">معرّف المقال (ID)</label>
                <input type="text" class="form-input" name="id" value="${this.escape(a.id)}" ${isEdit ? 'readonly style="background: #f9fafb;"' : 'required'} />
              </div>

              <div class="form-group">
                <label class="form-label">القسم التابع له</label>
                <select class="form-select" name="categoryId" required>
                  ${(this.knowledge.categories || []).map(c => `
                    <option value="${this.escape(c.id)}" ${a.categoryId === c.id ? 'selected' : ''}>
                      ${this.escape(c.title)}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">عنوان المقال (يظهر في القوائم ونتائج البحث)</label>
              <input type="text" class="form-input" name="title" value="${this.escape(a.title)}" required />
            </div>

            <div class="form-group">
              <label class="form-label">السؤال الرئيسي</label>
              <input type="text" class="form-input" name="question" value="${this.escape(a.question)}" required />
            </div>

            <!-- Alternative Questions Tags -->
            <div class="form-group">
              <label class="form-label">أسئلة بديلة وصيغ أخرى للسؤال (اضغطي Enter للإضافة)</label>
              <div class="tag-container" id="alt-tags-box">
                ${altQuestions.map((q, i) => `
                  <span class="tag-item">
                    ${this.escape(q)}
                    <button type="button" class="tag-remove" data-type="alt" data-idx="${i}">✕</button>
                  </span>
                `).join('')}
                <input type="text" class="tag-input" id="alt-tag-input" placeholder="اكتبي صيغة بديلة واضغطي Enter..." />
              </div>
            </div>

            <!-- Keywords Tags -->
            <div class="form-group">
              <label class="form-label">الكلمات المفتاحية للبحث (Keywords - مهمة جداً للبحث المحلي)</label>
              <div class="tag-container" id="kw-tags-box">
                ${keywords.map((k, i) => `
                  <span class="tag-item">
                    ${this.escape(k)}
                    <button type="button" class="tag-remove" data-type="kw" data-idx="${i}">✕</button>
                  </span>
                `).join('')}
                <input type="text" class="tag-input" id="kw-tag-input" placeholder="أضيفي كلمة مفتاحية واضغطي Enter..." />
              </div>
            </div>

            <!-- Synonyms Tags -->
            <div class="form-group">
              <label class="form-label">المرادفات الشائعة واللهجات (Synonyms)</label>
              <div class="tag-container" id="syn-tags-box">
                ${synonyms.map((s, i) => `
                  <span class="tag-item">
                    ${this.escape(s)}
                    <button type="button" class="tag-remove" data-type="syn" data-idx="${i}">✕</button>
                  </span>
                `).join('')}
                <input type="text" class="tag-input" id="syn-tag-input" placeholder="أضيفي مرادف واضغطي Enter..." />
              </div>
            </div>

            <!-- Answer Text -->
            <div class="form-group">
              <label class="form-label">نص الإجابة المعتمد</label>
              <textarea class="form-textarea" rows="4" name="answerText" required>${this.escape(a.answer?.text || '')}</textarea>
            </div>

            <!-- Steps List Builder -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">خطوات مرقمة (اختياري)</label>
                <button type="button" class="btn btn-secondary btn-sm" id="add-step-btn">+ إضافة خطوة</button>
              </div>
              <div id="steps-container" style="display: flex; flex-direction: column; gap: 8px;">
                ${steps.map((st, i) => `
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-weight: 700; width: 20px;">${i + 1}.</span>
                    <input type="text" class="form-input step-input" value="${this.escape(st)}" />
                    <button type="button" class="btn btn-danger btn-sm remove-step-btn" data-idx="${i}">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Action Links Builder -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">روابط توجيه داخلية أو خارجية (اختياري)</label>
                <button type="button" class="btn btn-secondary btn-sm" id="add-link-btn">+ إضافة رابط</button>
              </div>
              <div id="links-container" style="display: flex; flex-direction: column; gap: 8px;">
                ${links.map((lk, i) => `
                  <div style="display: flex; gap: 8px; align-items: center; background: #fafafa; padding: 8px; border-radius: 8px;">
                    <input type="text" class="form-input link-title" placeholder="نص الرابط" value="${this.escape(lk.title)}" style="flex: 1;" />
                    <input type="text" class="form-input link-url" placeholder="https://..." value="${this.escape(lk.url)}" dir="ltr" style="flex: 2;" />
                    <button type="button" class="btn btn-danger btn-sm remove-link-btn" data-idx="${i}">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Order & Status -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label">ترتيب العرض</label>
                <input type="number" class="form-input" name="order" value="${a.order || 1}" min="1" />
              </div>
              <div class="form-group">
                <label class="form-label">حالة التفعيل</label>
                <select class="form-select" name="enabled">
                  <option value="true" ${a.enabled !== false ? 'selected' : ''}>مفعّل (ظاهر)</option>
                  <option value="false" ${a.enabled === false ? 'selected' : ''}>معطّل (مخفي)</option>
                </select>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">إلغاء</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'حفظ التعديلات' : 'إضافة المقال'}</button>
          </div>
        </form>
      </div>
    `;

    overlay.classList.add('active');

    overlay.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => overlay.classList.remove('active'));
    });

    // Tag management helpers
    const setupTagInput = (inputId, list, boxId, type) => {
      const input = overlay.querySelector(`#${inputId}`);
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = input.value.trim();
          if (val && !list.includes(val)) {
            list.push(val);
            renderTagBox(boxId, list, type);
            input.value = '';
          }
        }
      });
    };

    const renderTagBox = (boxId, list, type) => {
      const box = overlay.querySelector(`#${boxId}`);
      const input = box.querySelector('.tag-input');
      const tagsHtml = list.map((item, idx) => `
        <span class="tag-item">
          ${this.escape(item)}
          <button type="button" class="tag-remove" data-type="${type}" data-idx="${idx}">✕</button>
        </span>
      `).join('');
      box.innerHTML = tagsHtml;
      box.appendChild(input);
      setupTagInput(input.id, list, boxId, type);

      box.querySelectorAll('.tag-remove').forEach(rmBtn => {
        rmBtn.addEventListener('click', () => {
          const idx = parseInt(rmBtn.getAttribute('data-idx'), 10);
          list.splice(idx, 1);
          renderTagBox(boxId, list, type);
        });
      });
    };

    setupTagInput('alt-tag-input', altQuestions, 'alt-tags-box', 'alt');
    setupTagInput('kw-tag-input', keywords, 'kw-tags-box', 'kw');
    setupTagInput('syn-tag-input', synonyms, 'syn-tags-box', 'syn');

    overlay.querySelectorAll('.tag-remove').forEach(rmBtn => {
      rmBtn.addEventListener('click', () => {
        const type = rmBtn.getAttribute('data-type');
        const idx = parseInt(rmBtn.getAttribute('data-idx'), 10);
        if (type === 'alt') { altQuestions.splice(idx, 1); renderTagBox('alt-tags-box', altQuestions, 'alt'); }
        if (type === 'kw') { keywords.splice(idx, 1); renderTagBox('kw-tags-box', keywords, 'kw'); }
        if (type === 'syn') { synonyms.splice(idx, 1); renderTagBox('syn-tags-box', synonyms, 'syn'); }
      });
    });

    // Step handlers
    const stepsCont = overlay.querySelector('#steps-container');
    overlay.querySelector('#add-step-btn')?.addEventListener('click', () => {
      const div = document.createElement('div');
      div.style.cssText = 'display: flex; gap: 8px; align-items: center;';
      div.innerHTML = `
        <span style="font-weight: 700; width: 20px;">*</span>
        <input type="text" class="form-input step-input" placeholder="اكتبي الخطوة..." />
        <button type="button" class="btn btn-danger btn-sm remove-step-btn">✕</button>
      `;
      div.querySelector('.remove-step-btn').addEventListener('click', () => div.remove());
      stepsCont.appendChild(div);
    });

    overlay.querySelectorAll('.remove-step-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.parentElement.remove());
    });

    // Link handlers
    const linksCont = overlay.querySelector('#links-container');
    overlay.querySelector('#add-link-btn')?.addEventListener('click', () => {
      const div = document.createElement('div');
      div.style.cssText = 'display: flex; gap: 8px; align-items: center; background: #fafafa; padding: 8px; border-radius: 8px;';
      div.innerHTML = `
        <input type="text" class="form-input link-title" placeholder="نص الرابط" style="flex: 1;" />
        <input type="text" class="form-input link-url" placeholder="https://..." dir="ltr" style="flex: 2;" />
        <button type="button" class="btn btn-danger btn-sm remove-link-btn">✕</button>
      `;
      div.querySelector('.remove-link-btn').addEventListener('click', () => div.remove());
      linksCont.appendChild(div);
    });

    overlay.querySelectorAll('.remove-link-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.parentElement.remove());
    });

    // Submit handler
    overlay.querySelector('#article-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);

      // Collect updated steps
      const updatedSteps = [];
      overlay.querySelectorAll('.step-input').forEach(inp => {
        const val = inp.value.trim();
        if (val) updatedSteps.push(val);
      });

      // Collect updated links
      const updatedLinks = [];
      overlay.querySelectorAll('#links-container > div').forEach(div => {
        const title = div.querySelector('.link-title')?.value.trim();
        const url = div.querySelector('.link-url')?.value.trim();
        if (title && url) {
          updatedLinks.push({ title, url, isExternal: url.startsWith('http') });
        }
      });

      const articleData = {
        id: fd.get('id').trim(),
        categoryId: fd.get('categoryId'),
        title: fd.get('title').trim(),
        question: fd.get('question').trim(),
        alternativeQuestions: altQuestions,
        keywords: keywords,
        synonyms: synonyms,
        answer: {
          text: fd.get('answerText').trim(),
          steps: updatedSteps,
          links: updatedLinks
        },
        relatedIds: a.relatedIds || [],
        enabled: fd.get('enabled') === 'true',
        order: parseInt(fd.get('order'), 10) || 1
      };

      if (!this.knowledge.articles) this.knowledge.articles = [];

      if (isEdit) {
        const idx = this.knowledge.articles.findIndex(x => x.id === a.id);
        if (idx !== -1) this.knowledge.articles[idx] = articleData;
      } else {
        if (this.knowledge.articles.some(x => x.id === articleData.id)) {
          alert('معرّف المقال (ID) مكرر! يُرجى اختيار معرّف فريد.');
          return;
        }
        this.knowledge.articles.push(articleData);
      }

      this.saveWorkingData();
      overlay.classList.remove('active');
      this.render();
    });
  }

  confirmDeleteArticle(artId) {
    if (confirm('هل أنتِ متأكدة من حذف هذا المقال نهائياً؟')) {
      this.knowledge.articles = this.knowledge.articles.filter(a => a.id !== artId);
      this.saveWorkingData();
      this.render();
    }
  }

  openQuickReplyModal() {
    let overlay = document.getElementById('modal-qr-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-qr-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    const { articles = [] } = this.knowledge || {};

    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <h3>إضافة زر رد سريع</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>
        <form id="qr-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">نص الزر (مثلاً: 🚚 مدة التوصيل)</label>
              <input type="text" class="form-input" name="label" required placeholder="مثال: 🎁 الشحن المجاني" />
            </div>

            <div class="form-group">
              <label class="form-label">نوع الإجراء</label>
              <select class="form-select" id="qr-action-type" name="actionType">
                <option value="article">فتح مقال محدد</option>
                <option value="whatsapp">محادثة واتساب مباشرة</option>
              </select>
            </div>

            <div class="form-group" id="qr-article-select-wrap">
              <label class="form-label">المقال المستهدف</label>
              <select class="form-select" name="articleId">
                ${articles.map(a => `
                  <option value="${this.escape(a.id)}">${this.escape(a.title)}</option>
                `).join('')}
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary close-modal-btn">إلغاء</button>
            <button type="submit" class="btn btn-primary">إضافة الزر</button>
          </div>
        </form>
      </div>
    `;

    overlay.classList.add('active');

    overlay.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => overlay.classList.remove('active'));
    });

    const actionSelect = overlay.querySelector('#qr-action-type');
    const artWrap = overlay.querySelector('#qr-article-select-wrap');
    actionSelect.addEventListener('change', () => {
      artWrap.style.display = actionSelect.value === 'whatsapp' ? 'none' : 'block';
    });

    overlay.querySelector('#qr-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const isWa = fd.get('actionType') === 'whatsapp';

      const newQr = {
        id: `qr-${Date.now()}`,
        label: fd.get('label').trim(),
        action: isWa ? 'whatsapp' : undefined,
        articleId: isWa ? undefined : fd.get('articleId')
      };

      if (!this.knowledge.quickReplies) this.knowledge.quickReplies = [];
      this.knowledge.quickReplies.push(newQr);
      this.saveWorkingData();
      overlay.classList.remove('active');
      this.render();
    });
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Instantiate dashboard on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.babDashboard = new BabDashboard();
});
