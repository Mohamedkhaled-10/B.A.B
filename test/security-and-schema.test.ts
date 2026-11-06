import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidUrl, sanitizeUrl, validateKnowledgeData } from '../widget/bab-widget.js';
import fs from 'node:fs';
import path from 'node:path';

test('URL Security: blocks dangerous protocols and payloads', () => {
  const dangerousUrls = [
    'javascript:alert(1)',
    'javascript:document.cookie',
    'JAVASCRIPT:void(0)',
    'javascript%3aalert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:application/javascript;base64,YWxlcnQoMSk=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.com/uuid',
    '//attacker.com/malicious', // Protocol-relative link
    'ftp://ftp.example.com'
  ];

  for (const url of dangerousUrls) {
    assert.equal(isValidUrl(url), false, `Should reject dangerous URL: ${url}`);
    assert.equal(sanitizeUrl(url), '#', `sanitizeUrl should replace dangerous URL with '#': ${url}`);
  }
});

test('URL Security: permits safe internal and external HTTPS URLs', () => {
  const safeUrls = [
    '/all-products',
    '/category/hair-care',
    '/cart',
    '/track-order',
    'https://dandy-ebon.vercel.app/all-products',
    'https://wa.me/201038941005?text=Hello',
    'https://example.com/guide'
  ];

  for (const url of safeUrls) {
    assert.equal(isValidUrl(url), true, `Should accept safe URL: ${url}`);
  }

  // Internal path resolves against base URL
  assert.equal(
    sanitizeUrl('/track-order', 'https://dandy-ebon.vercel.app'),
    'https://dandy-ebon.vercel.app/track-order'
  );
});

test('Knowledge Schema: data/knowledge.json meets full production specifications', () => {
  const filePath = path.resolve('data/knowledge.json');
  assert.ok(fs.existsSync(filePath), 'data/knowledge.json must exist');

  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const validation = validateKnowledgeData(content);

  assert.equal(validation.isValid, true, `Validation failed: ${validation.errors.join('; ')}`);
  assert.equal(validation.errors.length, 0);

  // Settings verification
  assert.equal(content.schemaVersion, 1);
  assert.equal(content.settings.brandName, 'DANDY');
  assert.equal(content.settings.supportPhone, '01038941005');
  assert.equal(content.settings.supportWhatsapp, '201038941005');
  assert.equal(content.settings.officialBaseUrl, 'https://dandy-ebon.vercel.app');

  // Categories count and verification (8 required categories)
  assert.equal(content.categories.length, 8, 'Must have exactly the 8 required categories');
  const expectedCatIds = [
    'orders-purchasing',
    'shipping-delivery',
    'order-tracking',
    'products-care',
    'payments-returns',
    'account-user',
    'website-tech-help',
    'store-info'
  ];
  for (const catId of expectedCatIds) {
    assert.ok(content.categories.some((c: any) => c.id === catId), `Category ${catId} must exist`);
  }

  // Articles count (between 40 and 60 FAQs)
  assert.ok(
    content.articles.length >= 40 && content.articles.length <= 60,
    `Article count must be between 40 and 60, found: ${content.articles.length}`
  );

  // Policy verification
  // 1. Delivery: 2-5 business days
  const deliveryArt = content.articles.find((a: any) => a.id === 'shipping-delivery-time');
  assert.ok(deliveryArt);
  assert.ok(deliveryArt.answer.text.includes('2') && deliveryArt.answer.text.includes('5'));

  // 2. Free shipping: 2,000 EGP
  const freeArt = content.articles.find((a: any) => a.id === 'shipping-free');
  assert.ok(freeArt);
  assert.ok(freeArt.answer.text.includes('2,000') || freeArt.answer.text.includes('2000'));

  // 3. Shipping fees: depends on governorate, never fixed
  const feesArt = content.articles.find((a: any) => a.id === 'shipping-fees');
  assert.ok(feesArt);
  assert.ok(feesArt.answer.text.includes('المحافظة') || feesArt.answer.text.includes('ليست ثابتة'));

  // 4. Order tracking: /track-order without collecting customer data in chat
  const trackArt = content.articles.find((a: any) => a.id === 'track-how-to');
  assert.ok(trackArt);
  assert.ok(trackArt.answer.links.some((l: any) => l.url.includes('/track-order')));
});

test('validateKnowledgeData rejects invalid data without throwing', () => {
  // Missing categories
  const invalid1 = { schemaVersion: 1, settings: {}, articles: [] };
  const val1 = validateKnowledgeData(invalid1);
  assert.equal(val1.isValid, false);

  // Duplicate category IDs
  const invalid2 = {
    schemaVersion: 1,
    settings: { assistantName: 'B.A.B', brandName: 'DANDY', supportWhatsapp: '123' },
    categories: [
      { id: 'cat1', title: 'Cat 1' },
      { id: 'cat1', title: 'Duplicate Cat' }
    ],
    articles: []
  };
  const val2 = validateKnowledgeData(invalid2);
  assert.equal(val2.isValid, false);
  assert.ok(val2.errors.some(e => e.includes('مكرر')));

  // Article referencing non-existent category
  const invalid3 = {
    schemaVersion: 1,
    settings: { assistantName: 'B.A.B', brandName: 'DANDY', supportWhatsapp: '123' },
    categories: [{ id: 'cat1', title: 'Cat 1' }],
    articles: [
      {
        id: 'art1',
        categoryId: 'ghost-category',
        title: 'Title',
        question: 'Q',
        answer: { text: 'Ans' }
      }
    ]
  };
  const val3 = validateKnowledgeData(invalid3);
  assert.equal(val3.isValid, false);
  assert.ok(val3.errors.some(e => e.includes('يشير لقسم غير موجود')));

  // Article with malicious javascript: URL
  const invalid4 = {
    schemaVersion: 1,
    settings: { assistantName: 'B.A.B', brandName: 'DANDY', supportWhatsapp: '123' },
    categories: [{ id: 'cat1', title: 'Cat 1' }],
    articles: [
      {
        id: 'art1',
        categoryId: 'cat1',
        title: 'Title',
        question: 'Q',
        answer: {
          text: 'Ans',
          links: [{ title: 'Hacked', url: 'javascript:alert(1)' }]
        }
      }
    ]
  };
  const val4 = validateKnowledgeData(invalid4);
  assert.equal(val4.isValid, false);
  assert.ok(val4.errors.some(e => e.includes('رابط غير آمن')));
});
