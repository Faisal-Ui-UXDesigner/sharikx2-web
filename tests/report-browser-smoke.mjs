// Local synthetic browser checks. No live accounts, auth identities or financial writes.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Hebron',serviceWorkers:'block'});
const page=await context.newPage(),errors=[],calls=[];
page.on('pageerror',error=>errors.push(error.message));
let active=true,slow=false,malformedDebt=false;
let holdFinance=false,onFinanceStarted,releaseFinance;
const finance={revision:7,state:{revenues:[{id:'cashier-0',date:'2026-10-01',amount:999},{id:'cashier-46',date:'2026-10-02',amount:999}],
  entries:[{date:'2026-10-01',expenses:3}],
  partners:[{id:'partner-1',name:'شريك الاختبار',capital:100,share:60,active:true}],
  expenses:[{date:'2026-10-01',type:'مشتريات',amount:40},{sharikx2ExpenseId:'wage',date:'2026-10-01',type:'يوميات',amount:999},
    {sharikx2ExpenseId:'expense',date:'2026-10-01',type:'مصروفات',amount:999},
    {sharikx2ExpenseId:'rent',date:'2026-10-02',type:'مصروفات',amount:999}]}};
await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:'window.SHARIKX2_CONFIG={url:"https://fixture.invalid",publicKey:"fixture-public"};'});
  if(url.origin===preview.origin)return route.continue();
  if(url.host!=='fixture.invalid')return route.abort();
  calls.push(url.pathname+url.search);
  let data;
  if(url.pathname==='/auth/v1/signup')data={access_token:'fixture-token',refresh_token:'fixture-refresh',expires_in:3600};
  else if(url.pathname.endsWith('/restore_sharikx2_owner_project_v2')||url.pathname.endsWith('/join_sharikx2_project_v1'))data={id:'fixture',name:'مشروع اختبار محلي',currency:'JOD',subscription_status:active?'active':'trial'};
  else if(url.pathname.endsWith('/get_sharikx2_financial_summary_v2'))data={net_project_value:120,liquidity:50,accounts:[{id:'cash',name:'النقد',balance:50}]};
  else if(url.pathname.endsWith('/get_sharikx2_debt_balances_v2'))data=malformedDebt?{customers:[],customer_debt:null}:{customer_debt:12.345,supplier_debt:5,customers:[{id:'debtor',name:'Test <img src=x>',phone:'0590000000',calculated_debt:'12.345'},{id:'settled',name:'مسدد',calculated_debt:'0.009'}],suppliers:[{id:'supplier-fixture',name:'مورد اختبار',calculated_debt:5}]};
  else if(url.pathname==='/rest/v1/sharikx2_supplier_old_debts')data=[{id:'old-fixture',amount:5,description:'رصيد سابق',created_at:'2026-10-01T10:00:00Z'}];
  else if(['/rest/v1/sharikx2_supplier_payments','/rest/v1/sharikx2_supplier_credits'].includes(url.pathname))data=[];
  else if(url.pathname.endsWith('/get_sharikx2_financial_activity_v2'))data={sales:50,purchases:40,expenses:3,cash_in:50,cash_out:43,movements:[{account_id:'cash',account_name:'النقد',direction:'in',amount:50,movement_type:'sale',occurred_at:'2026-10-01T10:00:00Z'}]};
  else if(url.pathname.endsWith('/get_sharikx2_finance_state_v1')){
    if(holdFinance){onFinanceStarted();await new Promise(resolve=>{releaseFinance=resolve;});}
    if(slow)await new Promise(resolve=>setTimeout(resolve,250));data=finance;
  }
  else if(url.pathname==='/rest/v1/sharikx2_sales'){
    const offset=Number(url.searchParams.get('offset'));
    data=[...Array.from({length:45},(_,i)=>({id:String(i),status:'debt',created_at:'2026-10-01T12:00:00Z',debt_amount:1,total:i===0?32:2})),
      {id:'46',status:'paid',created_at:'2026-10-02T12:00:00Z',debt_amount:0,total:30}].slice(offset,offset+20);
  }else if(url.pathname==='/rest/v1/sharikx2_purchases')data=[];
  else if(url.pathname==='/rest/v1/sharikx2_expenses')data=[
    {id:'expense',category:'operating_expense',amount:7,occurred_at:'2026-10-01T10:00:00Z',created_at:'2026-10-01T10:00:00Z',description:'<img src=x onerror=alert(1)>'},
    {id:'wage',category:'daily_wage',amount:10,occurred_at:'2026-10-01T10:00:00Z',created_at:'2026-10-01T10:00:00Z'},
    {id:'rent',category:'operating_expense',amount:50,occurred_at:'2026-10-02T10:00:00Z',created_at:'2026-10-02T10:00:00Z'}];
  else throw new Error(`Unexpected synthetic request ${url.pathname}`);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
});
try{
  await page.goto(preview.origin);
  await page.getByRole('button',{name:'الدخول إلى مشروع قائم',exact:true}).click();
  await page.locator('input[name=phone]').fill('0590000000');
  await page.locator('input[name=password]').fill('1234');
  await page.getByRole('button',{name:'دخول',exact:true}).click();
  await page.locator('[data-page=reports]').click();
  await page.locator('[data-start]').fill('2026-10-01');
  await page.waitForFunction(()=>document.querySelector('[data-customer-debt]')?.textContent.includes('45'));
  assert.match(await page.locator('.report-net').innerText(),/60.*د\.أ/s);
  await page.getByRole('button',{name:'⌄ عرض الحركات',exact:true}).click();
  assert.equal(await page.locator('[data-movements]').isVisible(),true);
  assert.equal(await page.locator('.report-movement img').count(),0);
  assert.match(await page.locator('[data-movements]').innerText(),/<img src=x/);
  await page.getByRole('button',{name:'فترة',exact:true}).click();
  await page.locator('[data-end]').fill('2026-10-02');
  await page.waitForFunction(()=>document.querySelectorAll('.report-day').length===2);
  assert.match(await page.locator('.report-net').innerText(),/40.*د\.أ/s);
  await page.locator('[data-type]').selectOption({label:'المشتريات'});
  await page.waitForFunction(()=>document.querySelectorAll('.report-day').length===1);
  assert.match(await page.locator('.report-net').innerText(),/40.*د\.أ/s);
  await mkdir('tests/screenshots',{recursive:true});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'tests/screenshots/reports-mobile.png',fullPage:true});
  const overflowing=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(node=>{const r=node.getBoundingClientRect();return r.width&& (r.left < -1 || r.right > innerWidth+1);}).map(node=>({tag:node.tagName,class:node.className,width:node.getBoundingClientRect().width})).slice(0,15));
  assert.deepEqual(overflowing,[],'No content may overflow the mobile viewport: '+JSON.stringify(overflowing));
  // A stale response must not overwrite the next screen or day.
  slow=true;
  await page.locator('[data-start]').fill('2026-10-03');
  await page.locator('[data-start]').fill('2026-10-01');
  await page.waitForFunction(()=>document.querySelector('.report-net')?.textContent.includes('40'));
  slow=false;
  await page.locator('[data-page=accounts]').click();
  await page.getByRole('heading',{name:'الحسابات المالية',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'حفظ العملة',exact:true}).count(),1);
  await page.locator('[data-page=partners]').click();
  await page.locator('[data-edit-partner="partner-1"]').waitFor();
  assert.equal(await page.locator('[data-edit-partner]').count(),1);
  await page.locator('[data-page=cashier]').click();
  await page.locator('[data-customers]').click();
  await page.locator('[data-person="debtor"]').waitFor();
  assert.equal(await page.locator('[data-person]').count(),1);
  assert.equal(await page.locator('[data-collect]').count(),1);
  assert.equal(await page.locator('[data-add-customer]').count(),1);
  assert.equal(await page.locator('[data-edit-customer="debtor"]').count(),1);
  await page.locator('[data-page=cashier]').click();await page.locator('[data-suppliers]').click();
  await page.locator('[data-new-purchase]').waitFor();
  assert.equal(await page.locator('[data-new-purchase]').count(),1);
  await page.locator('[data-open-person="supplier-fixture"]').click();
  await page.locator('[data-old-debt]').waitFor();
  assert.match(await page.locator('dialog .details').innerText(),/رصيد سابق/);
  await page.locator('dialog [data-close]').click();
  await page.locator('[data-page=cashier]').click();await page.locator('[data-customers]').click();
  await page.locator('[data-person="debtor"]').waitFor();
  assert.equal(await page.locator('#rows img').count(),0);
  await page.locator('#search').fill('  TEST  ');
  assert.equal(await page.locator('[data-person]').count(),1);
  await page.locator('#search').fill('');
  await page.locator('[data-tab=archive]').click();
  assert.equal(await page.locator('[data-person="settled"]').count(),1);
 assert.equal(await page.locator('[data-debt-summary]').getAttribute('hidden'),'');
  assert.equal(await page.locator('[data-collect]').count(),0);
  malformedDebt=true;
  await page.locator('[data-page=cashier]').click();await page.locator('[data-customers]').click();
  await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/تعذر قراءة بيانات الديون/);
  malformedDebt=false;await page.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();
  await page.locator('[data-person="debtor"]').waitFor();
  // Reload as a free viewer. The range tab remains gated and returns remain owner-only.
  active=false;
  await page.reload();
  await page.getByRole('button',{name:'المشاهدة برقم المشاركة',exact:true}).click();
  await page.locator('input[name=pin]').fill('1234');
  await page.getByRole('button',{name:'دخول',exact:true}).click();
  await page.locator('[data-page=reports]').click();
  await page.getByRole('button',{name:'فترة 🔒',exact:true}).click();
  assert.equal(await page.locator('dialog').isVisible(),true);
  assert.equal(await page.locator('[data-end]').count(),0);
  await page.getByRole('button',{name:'إغلاق',exact:true}).click();
  await page.locator('[data-start]').fill('2026-10-01');
  await page.waitForFunction(()=>document.querySelector('[data-customer-debt]')?.textContent.includes('45'));
  await page.locator('[data-page=cashier]').click();
  await page.locator('.activity-record').first().click();
  await page.waitForFunction(()=>document.querySelector('dialog .details .panel'));
  assert.equal(await page.locator('[data-return]').isVisible(),false);
  assert.equal(await page.locator('[data-return]').isDisabled(),true);
  await page.getByRole('button',{name:'إغلاق',exact:true}).click();
  await page.locator('[data-page=accounts]').click();
  await page.getByRole('heading',{name:'الحسابات المالية',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'حفظ العملة',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'التحويل بين الحسابات',exact:true}).count(),0);
  await page.locator('[data-page=partners]').click();
  assert.equal(await page.locator('[data-edit-partner]').count(),0);
  await page.locator('[data-page=cashier]').click();await page.locator('[data-customers]').click();
  await page.locator('[data-person="debtor"]').waitFor();assert.equal(await page.locator('[data-collect]').count(),0);assert.equal(await page.locator('[data-add-customer]').count(),0);assert.equal(await page.locator('[data-edit-customer]').count(),0);
  await page.locator('[data-page=reports]').click();
  await page.locator('[data-start]').fill('2026-10-01');
  await page.waitForFunction(()=>document.querySelector('[data-customer-debt]')?.textContent.includes('45'));
  // Hold a real browser request until after logout, then release its stale response.
  const started=new Promise(resolve=>{onFinanceStarted=resolve;});holdFinance=true;
  await page.locator('[data-start]').fill('2026-10-04');await started;
  await page.locator('[data-menu]').click();await page.locator('[data-logout]').click();
  const completed=page.waitForResponse(response=>response.url().endsWith('/get_sharikx2_finance_state_v1'));
  holdFinance=false;releaseFinance();await completed;
  await page.getByRole('button',{name:'الدخول إلى مشروع قائم',exact:true}).waitFor();
  assert.equal(await page.locator('.report-net').count(),0);
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(key=>key.startsWith('sharikx2-auth:'))),false);
  assert.equal(errors.length,0,errors.join('; '));
  assert.ok(calls.some(path=>path.includes('offset=40')));
  console.log('PASS: owner/viewer reports, pagination, currency, filters, stale responses, logout during pending reads, safe text and mobile layout');
}finally{await browser.close();await preview.close();}
