import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, levenshteinDistance, searchKnowledgeBase } from '../widget/bab-widget.js';
import fs from 'node:fs';
import path from 'node:path';

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

test('searchKnowledgeBase ranks exact title match above broader matches', () => {
  const mockKnowledge = {
    articles: [
      {
        id: 'art-general',
        title: 'معلومات عامة عن المتجر',
        question: 'ما هو متجر DANDY؟',
        keywords: ['متجر', 'جمال'],
        answer: { text: 'متجر مستحضرات تجميل مصري رائد.' },
        enabled: true
      },
      {
        id: 'art-shipping-time',
        title: 'مدة التوصيل',
        question: 'متى يصل طلبي؟',
        keywords: ['الشحن', 'التوصيل', 'مدة التوصيل'],
        synonyms: ['ميعاد وصول الشحنة'],
        answer: { text: 'من يومين إلى خمسة أيام عمل.' },
        enabled: true
      },
      {
        id: 'art-shipping-fees',
        title: 'مصاريف الشحن',
        question: 'كم تبلغ تكلفة التوصيل؟',
        keywords: ['رسوم الشحن', 'التوصيل', 'تكلفة'],
        answer: { text: 'تختلف حسب المحافظة في صفحة الدفع.' },
        enabled: true
      }
    ]
  };

  // Searching for "مدة التوصيل"
  const results = searchKnowledgeBase('مدة التوصيل', mockKnowledge);
  assert.ok(results.length > 0);
  assert.equal(results[0].id, 'art-shipping-time');

  // Searching with colloquial Egyptian phrasing "الشحنة هتوصل امتى" -> synonym match
  const synResults = searchKnowledgeBase('ميعاد وصول الشحنة', mockKnowledge);
  assert.ok(synResults.length > 0);
  assert.equal(synResults[0].id, 'art-shipping-time');
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

test('data/knowledge.json meets required schema and contains verified DANDY information', () => {
  const filePath = path.resolve('data/knowledge.json');
  assert.ok(fs.existsSync(filePath), 'data/knowledge.json must exist');
  
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assert.equal(content.schemaVersion, 1);
  assert.ok(content.settings, 'settings must exist');
  assert.equal(content.settings.supportPhone, '01038941005');
  assert.equal(content.settings.supportWhatsapp, '201038941005');
  assert.ok(Array.isArray(content.categories), 'categories must be an array');
  assert.ok(Array.isArray(content.articles), 'articles must be an array');
  assert.ok(content.categories.length >= 5, 'Should have multiple categories');
  assert.ok(content.articles.length >= 8, 'Should have comprehensive verified articles');

  // Verify delivery time article
  const deliveryArt = content.articles.find((a: any) => a.id === 'shipping-delivery-time');
  assert.ok(deliveryArt, 'shipping-delivery-time must exist');
  assert.ok(deliveryArt.answer.text.includes('يومين إلى خمسة أيام عمل'), 'Must contain 2-5 business days');

  // Verify free shipping article
  const freeShippingArt = content.articles.find((a: any) => a.id === 'shipping-free');
  assert.ok(freeShippingArt, 'shipping-free must exist');
  assert.ok(freeShippingArt.answer.text.includes('2,000') || freeShippingArt.answer.text.includes('2000'), 'Must contain 2000 EGP threshold');
});
