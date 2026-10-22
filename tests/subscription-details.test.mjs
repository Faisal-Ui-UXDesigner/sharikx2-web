import test from 'node:test';
import assert from 'node:assert/strict';
import {Api} from '../api.js';
import {subscriptionPaymentSettings,subscriptionPrice,subscriptionStatus,subscriptionLimits,SUBSCRIPTION_FEATURES,SUBSCRIPTION_SETTINGS_PATH} from '../subscription-details.js';
import {appShellMarkup} from '../app-shell-ui.js';
const now=Date.parse('2026-10-22T12:00:00Z'),day=86400000;
test('native payment settings trim whitelisted fields, preserve leading zeros and use USD independently of project currency',()=>{
 const row={subscription_price_usd:'12.50',bank_name:' بنك ',bank_account_number:' 00102 ',bank_iban:' PS00 ',bank_phone:' 05900 ',wallet_name:' محفظة ',wallet_phone:' 00099 ',updated_by:'not-exposed'},value=subscriptionPaymentSettings([row]);
 assert.equal(value.price,12.5);assert.equal(value.currency,'USD');assert.equal(subscriptionPrice(value),'12.5 $');assert.equal(value.bank_account_number,'00102');assert.equal(value.wallet_phone,'00099');assert.equal(value.updated_by,undefined);assert.ok(Object.isFrozen(value));assert.equal(row.bank_name,' بنك ');
});
test('native empty row and nonpositive price use ten dollars without inventing bank details',()=>{
 for(const rows of [[],[{}],[{subscription_price_usd:0}],[{subscription_price_usd:-2}]]){const value=subscriptionPaymentSettings(rows);assert.equal(subscriptionPrice(value),'10 $');assert.equal(value.bank_account_number,'');assert.equal(value.wallet_phone,'');}
});
test('malformed settings never silently display stale transfer destinations',()=>{
 for(const value of [null,{},[null],[{},{}],[[]],[{subscription_price_usd:'bad'}],[{subscription_price_usd:Infinity}],[{subscription_price_usd:true}],[{bank_account_number:123}],[{wallet_name:{}}]])assert.throws(()=>subscriptionPaymentSettings(value));
});
test('native subscription active boundary, ceil days and three-day renewal threshold',()=>{
 for(const [offset,days,near] of [[4*day,4,false],[3*day+1,4,false],[3*day,3,true],[1,1,true]]){
  const value=subscriptionStatus({subscription_status:'active',subscription_expires_at:now+offset},now);assert.equal(value.active,true);assert.equal(value.daysLeft,days);assert.equal(value.nearExpiry,near);assert.equal(value.action,near?'تجديد الاشتراك':'');
 }
 for(const expiry of [now,now-1]){const value=subscriptionStatus({subscription_status:'active',subscription_expires_at:expiry},now);assert.equal(value.active,false);assert.equal(value.expired,true);assert.equal(value.action,'إعادة الاشتراك');assert.equal(value.showExpiry,false);}
});
test('native active-without-expiry retains its original zero-day renewal presentation; free limits remain separate',()=>{
 const value=subscriptionStatus({subscription_status:'active'},now);assert.equal(value.active,true);assert.equal(value.daysLeft,0);assert.equal(value.nearExpiry,true);assert.equal(value.showExpiry,false);
 const free=subscriptionStatus({subscription_status:'trial'},now);assert.equal(free.active,false);assert.equal(free.expired,false);assert.equal(free.action,'عرض المزايا والاشتراك');assert.equal(subscriptionLimits(false).find(row=>row[0]==='ديون الزبائن')[1],'10 زبائن');assert.ok(subscriptionLimits(true).every(Object.isFrozen));assert.equal(SUBSCRIPTION_FEATURES.length,7);assert.ok(Object.isFrozen(SUBSCRIPTION_FEATURES));
});
test('invalid time data cannot appear as an active header or grant an entitlement',()=>{
 assert.throws(()=>subscriptionStatus({},NaN));assert.throws(()=>subscriptionStatus({subscription_expires_at:'bad'},now));
 const bad=appShellMarkup({project:{name:'name',subscription_status:'active',subscription_expires_at:'bad'},mode:'owner',screen:'cashier'});assert.match(bad,/تعذر التحقق من الخطة/);assert.ok(!bad.includes('data-subscribe'));
 const expired=appShellMarkup({project:{name:'name',subscription_status:'active',subscription_expires_at:'2000-01-01T00:00:00Z'},mode:'owner',screen:'cashier'});assert.match(expired,/خطة مجانية/);assert.match(expired,/data-subscribe/);
 const viewer=appShellMarkup({project:{name:'name'},mode:'viewer',screen:'cashier'});assert.match(viewer,/مشاهدة فقط/);assert.ok(!viewer.includes('data-subscribe'));
});
test('settings API uses only the same new-table GET as Android with generation protection',async()=>{
 const api=new Api({});let calls=0;api.session=async()=> 'synthetic';api.fetch=async(path,options)=>{calls++;assert.equal(path,SUBSCRIPTION_SETTINGS_PATH);assert.equal(options.body,undefined);assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert.ok(!options.method||options.method==='GET');return [{subscription_price_usd:'9.99',bank_account_number:'0001'}];};
 assert.equal((await api.subscriptionPaymentSettings()).price,9.99);assert.equal(calls,1);
 api.fetch=async()=>{api.clearSession();return [{}];};await assert.rejects(api.subscriptionPaymentSettings(),/SESSION_CLOSED/);
});
