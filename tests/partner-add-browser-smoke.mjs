import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),server=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===server.origin?route.continue():route.abort());
 const initial={revision:4,capital_posted:100.25,state:{partners:[{id:'a',name:'الأول',capital:100.25,share:80,joinedDate:'2026-10-01'}],formerPartners:[],opaque:{keep:true}}};
 async function mount(snapshot,paid=false){
  await page.goto(server.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
  await page.evaluate(async({snapshot,paid})=>{
   window.snapshot=snapshot;window.calls=0;window.cash=snapshot.capital_posted;window.saved=0;window.lose=true;window.active=true;
   window.project={id:'project',subscription_status:paid?'active':'free',subscription_expires_at:paid?'2099-01-01T00:00:00Z':null};
   window.api={financeState:async()=>structuredClone(window.snapshot),saveFinanceState:async(project,state,revision)=>{
    calls++;const total=state.partners.filter(p=>p.active!==false).reduce((sum,p)=>sum+p.capital,0);cash+=total-window.snapshot.capital_posted;
    window.snapshot={revision:revision+1,state:structuredClone(state),capital_posted:total};if(lose)throw Error('lost addition reply');return {revision:revision+1,capital_posted:total};
   }};
   const {renderPartners}=await import('/partners-ui.js');window.show=mode=>renderPartners({api,projectId:'project',project,container:document.querySelector('#fixture'),mode:mode||'owner',isCurrent:()=>active,onSaved:()=>saved++});await show();
  },{snapshot,paid});
 }
 await mount(initial);await page.locator('[data-partner-tab=former]').click();assert.equal(await page.locator('[data-add-partner]').isVisible(),false);await page.locator('[data-partner-tab=current]').click();
 await page.locator('[data-add-partner]').click();await page.locator('[name=name]').fill('<svg>');await page.locator('[name=capital]').fill('0.25');await page.locator('[name=share]').fill('30');
 const preview=page.locator('[data-add-partner-preview]');assert.match(await preview.innerText(),/100\.5/);assert.match(await preview.innerText(),/50/);assert.match(await preview.innerText(),/<svg>/);assert.equal(await preview.locator('svg').count(),0);assert.equal(await page.evaluate(()=>calls),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 await page.locator('.partner-add form').evaluate(form=>{form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));});
 await page.waitForFunction(()=>document.querySelector('.partner-add [role=alert]').textContent.includes('lost addition'));
 assert.equal(await page.evaluate(()=>calls),1);assert.equal(await page.evaluate(()=>cash),100.5);assert.equal(await page.locator('[name=capital]').isDisabled(),true);
 assert.deepEqual(await page.evaluate(()=>snapshot.state.partners.map(p=>p.share)),[50,30]);assert.equal(await page.evaluate(()=>snapshot.state.opaque.keep),true);assert.equal(await page.evaluate(()=>snapshot.state.partners[0].joinedDate),'2026-10-01');
 const captured=await page.evaluate(()=>structuredClone(snapshot)),identity=captured.state.partners[1];assert.match(identity.id,/^[0-9a-f-]{36}$/);assert.match(identity.joinedAt,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);assert.equal(identity.joinedDate,identity.joinedAt.slice(0,10));
 await page.reload();await mount(captured);await page.locator('[data-add-partner]').click();assert.equal(await page.locator('.finance-edit-recovery').count(),1);assert.equal(await page.locator('.finance-edit-recovery input').count(),0);assert.match(await page.locator('.finance-edit-recovery').innerText(),/<svg>/);
 await page.evaluate(()=>snapshot.capital_posted=100);await page.locator('.finance-edit-recovery [data-verify-finance-edit]').click();await page.waitForFunction(()=>document.querySelector('.finance-edit-recovery [role=alert]').textContent.includes('رأس المال'));assert.equal(await page.evaluate(()=>sessionStorage.length),1);assert.equal(await page.evaluate(()=>calls),0);
 await page.evaluate(()=>snapshot.capital_posted=100.5);await page.locator('.finance-edit-recovery [data-verify-finance-edit]').click();await page.waitForFunction(()=>saved===1);assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.equal(await page.evaluate(()=>calls),0);
 await page.evaluate(()=>show());await page.locator('[data-add-partner]').click();assert.equal(await page.locator('.partner-add').count(),0);assert.match(await page.locator('[data-partner-error]').innerText(),/شريكين/);
 await mount(captured,true);await page.locator('[data-add-partner]').click();await page.locator('[name=name]').fill('ج');await page.locator('[name=capital]').fill('0');await page.locator('[name=share]').fill('10');await page.evaluate(()=>project.subscription_expires_at='2020-01-01T00:00:00Z');await page.locator('.partner-add .primary').click();await page.waitForFunction(()=>document.querySelector('.partner-add [role=alert]').textContent.includes('شريكين'));assert.equal(await page.evaluate(()=>calls),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.equal(await page.locator('[name=capital]').isDisabled(),false);await page.keyboard.press('Escape');
 await page.evaluate(()=>show('viewer'));assert.equal(await page.locator('[data-add-partner]').count(),0);
 await mount(initial);await page.locator('[data-add-partner]').click();await page.locator('[name=name]').fill('ب');await page.evaluate(()=>active=false);await page.locator('.partner-add form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));assert.equal(await page.evaluate(()=>calls),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: native partner addition/shares, exact capital preview and single cash delta, escaped name, immutable identity and joining metadata, duplicate/lost-response protection, actual-reload read-only recovery despite free limit, wrong posted-total retention, expiry before dispatch, viewer/current-former/stale and mobile RTL');
}finally{await browser.close();await server.close();}
