import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, levenshteinDistance, searchKnowledgeBase } from '../widget/bab-widget.js';
import fs from 'node:fs';
import path from 'node:path';

// Load real preloaded knowledge base
const realKnowledge = JSON.parse(fs.readFileSync(path.resolve('data/knowledge.json'), 'utf-8'));

test('normalizeArabic properly cleans and normalizes Arabic characters', () => {
  // Tashkeel / Diacritics and Taa Marbuta to Haa
  assert.equal(normalizeArabic('مُتَوَقَّعَةٌ'), 'متوقعه');
  
  // Tatweel / Kashida
  assert.equal(normalizeArabic('الشـــــحن'), 'الشحن');
  
  // Alefs
  assert.equal(normalizeArabic('أحمد إبراهيم آمال ٱلشحن'), 'احمد ابراهيم امال الشحن');
  
  // Yaa and Alef Maqsura
  assert.equal(normalizeArabic('على وفي'), 'علي وفي');
  
  // Taa Marbuta
  assert.equal(normalizeArabic('خدمة عملاء ممتازة'), 'خدمه عملاء ممتازه');
  
  // Punctuation and extra spaces
  assert.equal(normalizeArabic('  متى يصل طلبي؟!!  '), 'متي يصل طلبي');
});

test('levenshteinDistance computes edit distance correctly', () => {
  assert.equal(levenshteinDistance('توصيل', 'توصيل'), 0);
  assert.equal(levenshteinDistance('توصيل', 'توصيلل'), 1);
  assert.equal(levenshteinDistance('شحن', 'شحن'), 0);
  assert.equal(levenshteinDistance('شحن', 'شحنة'), 1);
  assert.equal(levenshteinDistance('', 'abc'), 3);
});

test('searchKnowledgeBase accurately matches Egyptian colloquial questions for shipping fees', () => {
  const queries = [
    'الشحن بكام؟',
    'مصاريف التوصيل كام؟',
    'سعر الشحن؟',
    'عايز أعرف تكلفة الشحن',
    'كم مصاريف الشحن لمحافظتي؟'
  ];

  for (const q of queries) {
    const results = searchKnowledgeBase(q, realKnowledge);
    assert.ok(results.length > 0, `Search for "${q}" should return results`);
    const topIds = results.slice(0, 2).map((r: any) => r.id);
    assert.ok(
      topIds.includes('shipping-fees') || topIds.includes('shipping-free'),
      `Search for "${q}" should find shipping-fees or shipping-free in top results, found: ${topIds.join(', ')}`
    );
  }
});

test('searchKnowledgeBase accurately matches Egyptian colloquial questions for order tracking', () => {
  const queries = [
    'عايز اتابع الأوردر',
    'طلبي وصل لفين؟',
    'فين الشحنة بتاعتي؟',
    'ازاي اتتبع الطلب؟',
    'Track my order',
    'متابعة الشحنة'
  ];

  for (const q of queries) {
    const results = searchKnowledgeBase(q, realKnowledge);
    assert.ok(results.length > 0, `Search for "${q}" should return results`);
    const topIds = results.slice(0, 2).map((r: any) => r.id);
    assert.ok(
      topIds.includes('track-how-to') || topIds.includes('track-find-info'),
      `Search for "${q}" should find track-how-to in top results, found: ${topIds.join(', ')}`
    );
  }
});

test('searchKnowledgeBase accurately matches delivery time queries', () => {
  const queries = [
    'الشحنة هتوصل امتى؟',
    'التوصيل بياخد كام يوم؟',
    'ما هي مدة الشحن؟',
    'وقت وصول الأوردر',
    'مدة التوصيل'
  ];

  for (const q of queries) {
    const results = searchKnowledgeBase(q, realKnowledge);
    assert.ok(results.length > 0, `Search for "${q}" should return results`);
    assert.equal(results[0].id, 'shipping-delivery-time', `Query "${q}" should rank shipping-delivery-time first`);
  }
});

test('searchKnowledgeBase handles customer returns queries accurately', () => {
  const queries = [
    'عايز ارجع منتج',
    'طريقة ترجيع المنتج',
    'سياسة الاسترجاع',
    'هل ينفع استرجع الطلب؟'
  ];

  for (const q of queries) {
    const results = searchKnowledgeBase(q, realKnowledge);
    assert.ok(results.length > 0, `Search for "${q}" should return results`);
    const topIds = results.slice(0, 2).map((r: any) => r.id);
    assert.ok(topIds.includes('returns-can-i-return'), `Query "${q}" should find returns-can-i-return in top results`);
  }
});

test('searchKnowledgeBase handles product category exploration', () => {
  // Hair care
  const hairRes = searchKnowledgeBase('عايز حاجات للشعر شامبو وبلسم', realKnowledge);
  assert.ok(hairRes.length > 0);
  assert.equal(hairRes[0].id, 'prod-hair-care');

  // Skin care
  const skinRes = searchKnowledgeBase('غسول ومرطب للوجه', realKnowledge);
  assert.ok(skinRes.length > 0);
  assert.equal(skinRes[0].id, 'prod-skin-care');

  // Fragrance
  const perfRes = searchKnowledgeBase('عطور وبرفانات', realKnowledge);
  assert.ok(perfRes.length > 0);
  assert.equal(perfRes[0].id, 'prod-fragrance');
});

test('searchKnowledgeBase handles typos via Levenshtein distance', () => {
  // Typo: "تووصيل" instead of "توصيل"
  const typo1 = searchKnowledgeBase('مدة التووصيل', realKnowledge);
  assert.ok(typo1.length > 0);
  assert.equal(typo1[0].id, 'shipping-delivery-time');

  // Typo: "تتببع" instead of "تتبع"
  const typo2 = searchKnowledgeBase('تتببع طلبي', realKnowledge);
  assert.ok(typo2.length > 0);
  assert.equal(typo2[0].id, 'track-how-to');
});

test('searchKnowledgeBase returns empty array for unrelated non-store queries (fallback)', () => {
  const unrelated = [
    'طريقة عمل الكيكة بالشكولاته في المنزل',
    'سيارات مرسيدس مستعملة للبيع',
    'نتيجة مباراة ليفربول وريال مدريد'
  ];

  for (const q of unrelated) {
    const results = searchKnowledgeBase(q, realKnowledge);
    assert.equal(results.length, 0, `Unrelated query "${q}" must not return false matches; must trigger fallback`);
  }
});

test('searchKnowledgeBase excludes disabled articles', () => {
  const mockKnowledge = {
    articles: [
      {
        id: 'art-active',
        title: 'منتجات العناية بالبشرة',
        question: 'ما هي منتجات البشرة؟',
        keywords: ['بشرة', 'غسول'],
        answer: { text: 'غسول ومرطب.' },
        enabled: true
      },
      {
        id: 'art-disabled',
        title: 'منتجات العناية بالبشرة المخفية',
        question: 'ما هي منتجات البشرة؟',
        keywords: ['بشرة'],
        answer: { text: 'محتوى معطل مؤقتاً.' },
        enabled: false
      }
    ]
  };

  const results = searchKnowledgeBase('بشرة', mockKnowledge);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'art-active');
});
