import test from 'node:test';import assert from 'node:assert/strict';
import {FAQ_ENTRIES,FAQ_WEB_NOTICE,createFaqState} from '../faq.js';import {renderFaq} from '../faq-ui.js';
test('FAQ keeps seven general and eight premium Android entries in stable unique order',()=>{
 assert.equal(FAQ_ENTRIES.length,15);assert.equal(FAQ_ENTRIES.filter(entry=>!entry.premium).length,7);assert.equal(FAQ_ENTRIES.filter(entry=>entry.premium).length,8);assert.equal(new Set(FAQ_ENTRIES.map(entry=>entry.id)).size,15);
 assert.equal(FAQ_ENTRIES[0].question,'ما هو تطبيق SharikX2؟');assert.equal(FAQ_ENTRIES[7].question,'ما حدود الخطة المجانية؟');assert.equal(FAQ_ENTRIES.at(-1).question,'كيف أحصل على تقرير للمشروع؟');assert.ok(FAQ_ENTRIES.every(entry=>entry.question&&entry.answer));
});
test('FAQ content is immutable and explicitly distinguishes Android reference from web availability',()=>{
 assert.equal(Object.isFrozen(FAQ_ENTRIES),true);assert.ok(FAQ_ENTRIES.every(Object.isFrozen));assert.throws(()=>FAQ_ENTRIES[0].answer='متغير');assert.match(FAQ_WEB_NOTICE,/مرجع تطبيق الأندرويد/);assert.match(FAQ_WEB_NOTICE,/قيد التنفيذ/);
});
test('FAQ expansion is independent, starts closed and never mutates shared content',()=>{
 const state=createFaqState(),second=createFaqState();assert.ok(FAQ_ENTRIES.every(entry=>!state.isExpanded(entry.id)));assert.equal(state.toggle('about'),true);assert.equal(state.toggle('free-limits'),true);assert.equal(state.isExpanded('about'),true);assert.equal(state.toggle('about'),false);assert.equal(state.isExpanded('free-limits'),true);assert.equal(second.isExpanded('free-limits'),false);assert.throws(()=>state.toggle('unknown'),/موجود/);
});
test('stale FAQ rendering returns before accessing the browser DOM',()=>assert.equal(renderFaq({isCurrent:()=>false}),undefined));
