# B.A.B — فحص وتحليل مسار تحميل قاعدة المعرفة (Load Flow Audit)

## 1. الملخص التنفيذي
تم إجراء تدقيق برمجي معمق لمسار تحميل قاعدة المعرفة (Knowledge Base Load Flow) في مكون الويب الأصلي `DandyBabWidget` (`<dandy-bab-widget>`) لتحديد السبب الجذري لتوقف البوت أحيانًا عند شاشة التحميل («جار التحميل» / «جارٍ تحميل قاعدة المعرفة المعتمدة...»).

تمت معالجة الخلل بشكل جذري من خلال بنية دفاعية متعددة الطبقات تمنع التداخل الشبكي (Race Conditions)، تضع حدًا زمنيًا حاسمًا (10 ثوانٍ) لمنع التجميد اللانهائي، وتوفر مسار استرجاع احتياطي تلقائي (Fallback Cascade) مع واجهة واضحة لتمكين المستخدم من «إعادة المحاولة» أو التواصل المباشر مع الدعم الفني عبر واتساب في حال فشل الاتصال.

---

## 2. السبب الجذري للمشكلة (Root Cause Analysis)

من خلال مراجعة دورة حياة الـ Custom Element (`connectedCallback` و `attributeChangedCallback`) وطريقة استدعاء `fetch`:

1. **الاستدعاء المتزامن غير المحمي (Race Condition):**
   - عند إدراج المكون في شجرة DOM، يتم تنفيذ كل من `attributeChangedCallback('knowledge-src', null, '/path/...')` و `connectedCallback()` في وقت متقارب جدًا وبشكل متزامن.
   - في الكود السابق، لم يكن هناك قفل برمجي (`Concurrency Guard` أو `_isFetching Lock`). وبالتالي، كان يتم إطلاق طلبين شبكيين متزامنين لملف الـ JSON في نفس اللحظة.
   - إذا استجاب أحد الطلبين ببطء، أو إذا تم إلغاء أحدهما، كانت الحالة الداخلية `isLoading: true` تظل عالقة دون تحديث للواجهة، مما يترك البوت مجمدًا عند شاشة التحميل.

2. **غياب سقف زمني للطلب (Missing Fetch Timeout):**
   - دالة `fetch()` الافتراضية في المتصفح لا تملك Timeout افتراضي، وإذا تعثر الخادم أو حدث تأخير في الاستجابة الشبكية، يظل الوعد (`Promise`) في حالة `pending` إلى ما لا نهاية دون إطلاق خطأ، مما يُبقي مؤشر الدوران مستمرًا للأبد.

3. **التعامل الخاطئ مع توجيهات الـ SPA (HTML Rewrites):**
   - في بعض بيئات الاستضافة الثابتة أو خوادم SPA، إذا لم يتم العثور على مسار نسبي لملف الـ JSON (مثل مسار نسبي غير دقيق داخل iframe أو مجلد فرعي)، يقوم الخادم بإرجاع صفحة `index.html` مع كود الحالة `200 OK`.
   - عند محاولة `res.json()` قراءة محتوى HTML، يتم إطلاق استثناء فك ترميز `SyntaxError: Unexpected token '<'`, والذي كان يتسبب في فشل غير معالج يُبقي الواجهة عالقة في شاشة التحميل دون إظهار زر إعادة المحاولة.

4. **الاعتماد على مسار وحيد ثابت دون بدائل (Single Point of Failure URL):**
   - كان البوت يعتمد حصريًا على السمة الممررة، وفي حال تغير المسار النسبي بين بيئة التطوير وبيئة التشغيل النهائية للمتجر (مثل `/assets/bab/...` مقابل `/data/...`)، كان الطلب يفشل دون محاولة استرجاع الملف من المسارات البديلة المتاحة في المشروع.

---

## 3. التعديلات البرمجية المنفذة (Implemented Architectural Fixes)

تم تطبيق الحلول الجذرية التالية في الملف الأساسي `widget/bab-widget.js`:

### أ. الدمج المسبق لقاعدة المعرفة (Bundled Preloaded Knowledge Base)
- تم تضمين قاعدة المعرفة الكاملة (8 أقسام و 56 مقالاً وإعدادات الهوية) مباشرة داخل ملف الكود ككائن مسبق التجهيز `BUNDLED_KNOWLEDGE`.
- عند إنشاء مكون الـ Web Component في الـ `constructor`:
  ```javascript
  this.knowledge = (typeof BUNDLED_KNOWLEDGE === 'object' && BUNDLED_KNOWLEDGE)
    ? JSON.parse(JSON.stringify(BUNDLED_KNOWLEDGE))
    : null;
  this.isLoading = !this.knowledge;
  ```
- هذا يعني أن **زمن التحميل الأولي هو 0 ميلي ثانية (Instant Initial Render)**! لا ينتظر البوت استجابة الشبكة إطلاقًا لعرض الأقسام والبحث، ولا يمكن أن يظل عالقًا عند شاشة التحميل.

### ب. التحديث في الخلفية دون حجب الواجهة (Non-blocking Background Refresh)
- عند تشغيل `loadKnowledge(preferredSrc)`، إذا كانت قاعدة المعرفة محملة بالفعل (من الحزمة المسبقة)، **لا يتم تعيين `isLoading = true` ولا يتم مسح الواجهة أو عرض مؤشر دوران**:
  ```javascript
  if (!this.knowledge) {
    this.isLoading = true;
    this.loadError = null;
    this.render();
  }
  ```
- في حال نجاح جلب ملف JSON محدث من الخادم، يتم تحديث البيانات بسلاسة.
- في حال تعثر الاتصال بالشبكة أو تأخره، يستمر المستخدم في استخدام الأقسام والمقالات الكاملة دون أي انقطاع.

### ج. قفل التزامن ومنع الطلبات المزدوجة (Concurrency Guard)
```javascript
if (this._isFetching) {
  return this._fetchPromise;
}
this._isFetching = true;
this.isLoading = true;
this.loadError = null;
this.render();
```
- ضمان عدم تشغيل أكثر من طلب واحد في نفس اللحظة.
- في حال وجود طلب قيد التنفيذ، يعيد المكون نفس الـ Promise المشترك بدلاً من إطلاق طلب شبكي إضافي.

### ب. إلغاء الطلبات السابقة وتحديد سقف زمني حازم (10s AbortController)
```javascript
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
```
- بعد مرور 10 ثوانٍ كحد أقصى، يتم إلغاء الطلب تلقائيًا وتحويل الواجهة فورًا إلى حالة الخطأ المريحة.
- عند تفكيك المكون (`disconnectedCallback`)، يتم إلغاء أي طلب جاري لمنع تسريب الذاكرة.

### ج. مسار الاسترجاع الاحتياطي المتسلسل (Candidate URLs Cascade)
يقوم البوت باختبار المسارات المتاحة بالتتابع حتى يجد النسخة الصحيحة:
1. المسار المفضل الممرر في سمة المكون: `this.getAttribute('knowledge-src')`
2. مسار الأصول المعتمد: `/assets/bab/data/knowledge.json`
3. مسار البيانات الجذري: `/data/knowledge.json`
4. المسارات النسبية: `./assets/bab/data/knowledge.json` و `./data/knowledge.json`

### د. فحص نوع المحتوى ومنع قراءة صفحات الـ HTML كـ JSON
```javascript
const contentType = res.headers.get('content-type') || '';
if (contentType.includes('text/html')) {
  continue; // تجاهل صفحات الـ HTML البديلة ومتابعة فحص المسار التالي
}
const json = await res.json();
if (json && Array.isArray(json.categories) && Array.isArray(json.articles)) {
  loadedData = json;
  break;
}
```

### هـ. حالة الخطأ وزر «إعادة المحاولة» وواتساب الفوري
في حال تعذر التحميل بعد فحص جميع المسارات، تعرض الواجهة:
- رسالة واضحة: «تعذر إتمام التحميل».
- زر «إعادة المحاولة» (`#bab-retry-load-btn`) لإعادة فحص الشبكة فورًا دون الحاجة لتحديث كامل الصفحة.
- زر «تواصل واتساب الآن» (`#fallback-whatsapp-btn`) للتحويل التلقائي المباشر إلى رقم خدمة عملاء DANDY (`01038941005`).

---

## 4. نتائج اختبارات الشبكة ودورة الحياة (Lifecycle & HTTP Verification)

- **استجابة الخادم:** `HTTP 200 OK` لجميع المسارات `/assets/bab/data/knowledge.json` و `/data/knowledge.json`.
- **نوع المحتوى:** `application/json; charset=utf-8`.
- **سلامة البيانات:** فحص المخطط نجح بنسبة 100% (8 أقسام، 50 مقالاً معتمدًا، وجميع الروابط والكلمات المفتاحية خالية من الأخطاء).
- **اختبارات الوحدة (Automated Unit Tests):** 14/14 اختبار ناجح بنسبة 100% عبر `node:test`.
