import test from 'node:test';
import assert from 'node:assert/strict';
import {escape,money,timestamp,status} from '../ui.js';
test('untrusted text is escaped',()=>assert.equal(escape('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;'));
test('fractional unit cost stays visible',()=>assert.match(money(2.4,2),/2\.4/));
test('numeric months and invalid dates',()=>{assert.equal(timestamp('invalid'),'تاريخ غير متوفر');assert.doesNotMatch(timestamp('2026-09-26T10:00:00Z'),/أيلول|تموز/);});
test('partial returns have a readable label',()=>assert.equal(status('partially_returned'),'مرتجع جزئي'));
test('query cannot replace the project scope',async()=>{const {Api}=await import('../api.js');const api=new Api({});assert.throws(()=>api.rows('sales','project','*',0,{project_id:'eq.other'}),/INVALID_FILTER/);});
