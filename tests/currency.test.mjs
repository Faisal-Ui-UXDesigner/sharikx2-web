import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECT_CURRENCIES,currencyCode,currencySymbol,projectCurrencyPayload,projectCurrencyResult} from '../currency.js';
import {setCurrency,currency,money} from '../ui.js';
import {Api} from '../api.js';
test('currency choices and order match Android with Lebanese and Iraqi symbols',()=>{
 assert.deepEqual(PROJECT_CURRENCIES.map(row=>row.code),['ILS','JOD','SAR','AED','EGP','LBP','QAR','KWD','BHD','OMR','MAD','TND','DZD','IQD','YER','SDG']);
 assert.equal(currencySymbol('LBP'),'ل.ل');assert.equal(currencySymbol('IQD'),'ع.ع');assert.throws(()=>PROJECT_CURRENCIES.push({}),TypeError);assert.throws(()=>PROJECT_CURRENCIES[0].symbol='changed',TypeError);
});
test('currency normalization preserves safe unknown and legacy reads without markup injection',()=>{
 assert.equal(currencyCode(' jod '),'JOD');assert.equal(currencyCode('<img src=x>'),'ILS');assert.equal(currencySymbol('USD'),'USD');assert.equal(currencySymbol('LYD'),'ل.د');assert.equal(currencySymbol('SYP'),'ل.س');
});
test('every Android currency changes symbol only, never the numeric amount',()=>{
 for(const row of PROJECT_CURRENCIES){setCurrency(row.code);assert.equal(currency(),row.code);assert.equal(money(123.45,2),`123.45 ${row.symbol}`);}
 setCurrency('ILS');
});
test('currency mutations require project identity and an Android selection',()=>{
 assert.deepEqual(projectCurrencyPayload('project',' lbp '),{currency:'LBP'});
 for(const code of ['USD','',null,'<script>','SYP'])assert.throws(()=>projectCurrencyPayload('project',code));assert.throws(()=>projectCurrencyPayload(null,'ILS'));
});
test('currency response must confirm exactly one project and requested code',()=>{
 const rows=[{id:'project',currency:'LBP'}];assert.equal(projectCurrencyResult(rows,'project','LBP'),rows[0]);
 for(const rows of [null,[],[{},{}],[{id:'other',currency:'LBP'}],[{id:'project',currency:'ILS'}]])assert.throws(()=>projectCurrencyResult(rows,'project','LBP'));
});
test('currency API captures validated PATCH fields with expected currency guard',async()=>{
 const api=new Api({}),calls=[];api.request=async(path,options)=>{calls.push({path,options});return [{id:'project',currency:'IQD'}];};
 assert.deepEqual(await api.updateCurrency('project','iqd','JOD'),{id:'project',currency:'IQD'});
 assert.equal(calls[0].path,'/rest/v1/sharikx2_projects?id=eq.project&currency=eq.JOD&select=id,currency');assert.equal(calls[0].options.method,'PATCH');assert.equal(calls[0].options.headers.Prefer,'return=representation');assert.deepEqual(JSON.parse(calls[0].options.body),{currency:'IQD'});
 await assert.rejects(api.updateCurrency('project','USD'));await assert.rejects(api.updateCurrency('project','ILS','bad-filter'));assert.equal(calls.length,1);
});
test('currency API never reports an empty or mismatched PATCH response as success',async()=>{
 const api=new Api({});for(const rows of [[],[{}],[{id:'other',currency:'ILS'}],[{id:'project',currency:'JOD'}]]){api.request=async()=>rows;await assert.rejects(api.updateCurrency('project','ILS'));}
});
