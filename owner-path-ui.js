// New SharikX2 owner path on the web (Figma 03–16 setup, 19 cashier, 26–27 sale, 34–36 accounts/partners).
// Same server functions and payloads as the Android OwnerPathScreen. Totals shown before confirming are
// display only; confirmed numbers always come from the server.
import {escape,money as fmt} from './ui.js';
import {createOwnerPath,createOpeningMoney,createOpeningStock,deviceId,number,FREE_PRODUCTS} from './owner-path-store.js';
import {renderReports,createReportState} from './report-ui.js';
import {openBarcodeScanner} from './barcode-scanner.js';

const m=v=>v===null||v===undefined||v===''?'—':fmt(v,2);
const e=escape;
const STATUS={done:'مكتمل',in_progress:'قيد الاستكمال',not_started:'لم تكتبه بعد'};
const ERRORS={OWNER_REQUIRED:'هذا المحل مفتوح على جهاز آخر. افتحه من الجهاز الذي أنشأته منه.',STALE_REVISION:'تغيّرت بيانات المحل. أعد التحميل وراجع.',INSUFFICIENT_STOCK:'الكمية أكثر من المتاح.',FREE_PLAN_LIMIT:'وصلت حد الخطة المجانية.'};
const friendly=error=>{const raw=String(error?.message||error||'');for(const [code,text] of Object.entries(ERRORS))if(raw.includes(code))return text;
  if(/[؀-ۿ]/.test(raw))return raw;return 'تعذر إكمال الطلب. تحقق من الاتصال وحاول مرة ثانية.';};
const dec=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const sum2=values=>Math.round(values.reduce((a,v)=>a+Math.round(dec(v)*100),0))/100;

export function mountOwnerPath({app,api,project,onExit,notice,theme}){
  const device=deviceId(api),flow=createOwnerPath({api,project:project.id,device});
  const moneyFlow=createOpeningMoney({api,project:project.id,device}),stockFlow=createOpeningStock({api,project:project.id,device});
  let reportState=createReportState(),debtData=null;
  let state=null,page='cashier',busy=false,closed=false,selectedPartner=null,moneyState=null,stockState=null,stockSelected=new Set(),returnTo='cashier';
  const alive=()=>!closed&&app.isConnected;
  const say=text=>notice?.(text);
  function showError(text){const node=app.querySelector('[data-error]');if(node){node.textContent=text;node.hidden=false;node.scrollIntoView({block:'nearest'});}else say(text);}
  function loading(on){document.body.classList.toggle('op-loading',on);}
  async function run(work,done){
    if(busy||!alive())return;busy=true;loading(true);app.querySelectorAll('button,input,select').forEach(b=>b.disabled=true);
    try{const value=await work();if(!alive())return;busy=false;loading(false);await done?.(value);}
    catch(error){if(!alive())return;busy=false;loading(false);try{state=flow.snapshot();}catch{try{state=flow.cached();}catch{}}render();showError(friendly(error));}
    finally{if(busy){busy=false;loading(false);}}
  }
  const reload=target=>{page=target;closeSheet();run(flow.load,value=>{state=value;render();});};
  const go=target=>{page=target;closeSheet();render();window.scrollTo(0,0);};
  const post=(action,values,target)=>run(()=>flow.command(action,values),()=>{say('تم الحفظ');reload(target);});

  // ---------- shared pieces ----------
  const title=()=>({money:'الفلوس',goods:'البضاعة الموجودة',debts:'ديون قديمة',partners:'جهّز محلك',capital:'جهّز محلك',retained:'جهّز محلك',review:'مراجعة محلك',sale:'مبيعة جديدة',profits:'الشركاء',statement:'تفاصيل الحساب',accounts:'الحسابات',history:'سجل العمليات',purchase:'تسجيل فاتورة شراء',customers:'ديون الزبائن',suppliers:'حسابات الموردين',reports:'التقارير'}[page]||'الكاشير');
  const home=()=>['cashier','profits','accounts','statement','reports'].includes(page);
  function header(){
    if(home())return `<header class="op-head"><div class="op-id"><b>${e(project.name||'محلي')}</b>${project.owner_phone?`<small dir="ltr">${e(project.owner_phone)}</small>`:''}${project.project_number?`<small>رقم المحل ${e(project.project_number)}</small>`:''}</div><button class="op-icon" data-menu aria-label="الإعدادات">☰</button></header>`;
    return `<header class="op-head"><button class="op-icon" data-back aria-label="رجوع">→</button><b class="op-title">${e(title())}</b>${page==='sale'?'<button class="op-icon" data-new-sale aria-label="مبيعة جديدة وتعليق الحالية">＋</button><button class="op-icon" data-held aria-label="المبيعات المعلقة">⏸</button>':''}</header>`;
  }
  function nav(){
    const items=[['accounts','الحسابات','▤'],['goods','البضاعة','▦'],['cashier','الكاشير','⌂'],['profits','الشركاء','👥'],['reports','التقارير','📊']];
    return `<nav class="op-nav">${items.map(([id,label,icon])=>`<button data-nav="${id}" class="${page===id||(id==='profits'&&page==='statement')?'on':''}"><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav>`;
  }
  const choice=(id,titleText,helper,on)=>`<button class="op-choice ${on?'on':''}" data-choice="${id}"><span class="op-radio" aria-hidden="true"></span><span><b>${e(titleText)}</b><small>${e(helper)}</small></span></button>`;
  const pill=(text,tone='')=>`<span class="op-pill ${tone}">${e(text)}</span>`;
  const field=(name,label,value='',unit='',attrs='')=>`<label class="op-field">${e(label)}<span class="op-input">${unit?`<i>${e(unit)}</i>`:''}<input name="${name}" value="${e(value??'')}" ${unit?'inputmode="decimal" dir="ltr"':''} ${attrs}></span></label>`;
  const steps=()=>`<p class="muted small">الخطوة 3 من 3: الشركاء والمراجعة</p><div class="op-steps"><i></i><i></i><i></i></div>`;
  function frame(body,footer=''){
    app.innerHTML=`<section class="op-app">${header()}${home()?planRow():''}<main class="op-body"><p class="op-error" data-error hidden></p>${state?.local_only?'<p class="op-warn">آخر بيانات محفوظة على هذا المتصفح. تحتاج اتصالاً للحفظ.</p>':''}${body}</main>${footer?`<footer class="op-foot">${footer}</footer>`:''}${home()||page==='goods'?nav():''}</section>`;
    app.querySelector('[data-back]')?.addEventListener('click',back);
    app.querySelector('[data-menu]')?.addEventListener('click',menu);
    app.querySelector('[data-new-sale]')?.addEventListener('click',anotherSale);
    app.querySelector('[data-held]')?.addEventListener('click',heldSales);
    app.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{const t=b.dataset.nav;if(t==='goods')openGoods('cashier');else if(t==='reports')go('reports');else reload(t);});
  }
  const planRow=()=>`<div class="op-plan"><span>${state?.stock?.paid?'الخطة المدفوعة':`الخطة المجانية · حتى ${state?.stock?.free_limit||FREE_PRODUCTS} صنفاً`}</span></div>`;
  const on=(selector,handler)=>app.querySelectorAll(selector).forEach(node=>node.addEventListener('click',event=>{if(!busy)handler(node,event);}));
  function back(){if(busy)return say('انتظر حتى ينتهي الطلب الحالي');
    ({statement:()=>go('profits'),capital:()=>go('partners'),retained:()=>go('capital'),sale:()=>go('cashier'),purchase:()=>go('cashier'),history:()=>go('cashier'),customers:()=>go('cashier'),suppliers:()=>go('cashier'),money:()=>reload(returnTo),goods:()=>reload(returnTo),review:()=>go('cashier'),debts:()=>go('cashier'),partners:()=>go('cashier')}[page]||(()=>go('cashier')))();}

  // ---------- dialogs ----------
  let dialog=null;
  function closeSheet(){if(dialog){dialog.close();dialog.remove();dialog=null;}}
  function sheet(heading,body,buttons=[]){
    closeSheet();dialog=document.createElement('dialog');dialog.className='op-sheet';
    dialog.innerHTML=`<form method="dialog" class="op-sheet-in"><header><b>${e(heading)}</b><button value="close" class="op-icon" aria-label="إغلاق">×</button></header><div class="op-sheet-body">${body}<p class="op-error" data-sheet-error hidden></p></div><div class="op-sheet-actions">${buttons.map((b,i)=>`<button type="button" class="${i===0?'primary':'outline'}" data-sheet-action="${i}">${e(b[0])}</button>`).join('')}</div></form>`;
    app.append(dialog);dialog.addEventListener('close',()=>{if(dialog){dialog.remove();dialog=null;}});
    dialog.querySelectorAll('[data-sheet-action]').forEach(node=>node.onclick=()=>{if(!busy)buttons[Number(node.dataset.sheetAction)][1](dialog);});
    dialog.showModal();return dialog;
  }
  const sheetError=(d,text)=>{const n=d.querySelector('[data-sheet-error]');n.textContent=text;n.hidden=false;};
  function menu(){
    const d=sheet('الإعدادات',`<p class="muted">${e(project.name||'')}</p>`,[[theme?.mode?.()==='dark'?'الوضع الفاتح':'الوضع الداكن',()=>{theme?.toggle?.();closeSheet();render();}],['تسجيل الخروج من المحل',()=>{closeSheet();onExit();}]]);
    void d;
  }

  // ---------- pending request (unknown result) ----------
  function pending(){
    const p=state.pending;
    if(p.preview&&p.action==='prepare_lock')return lockConfirm(p.preview);
    if(p.preview&&p.action==='prepare_finance')return financeReview(p.preview);
    frame('<p class="op-lead">تحقق من نتيجة الطلب السابق قبل إرسال طلب جديد. بياناتك المحفوظة باقية.</p>',
      '<button class="primary" data-check>تحقق الآن</button><button class="outline" data-retry>إعادة إرسال الطلب نفسه</button><button class="ghost" data-cancel>إلغاء الطلب غير المؤكد</button>');
    on('[data-check]',()=>run(flow.status,()=>reload(page)));
    on('[data-retry]',()=>run(flow.retry,result=>{if(result?.action==='sale')doneSale(result,p.payload?.values);else reload(page);}));
    on('[data-cancel]',()=>run(async()=>{await flow.cancel();return flow.load();},value=>{state=value;render();}));
  }

  // ---------- cashier (Figma 19) ----------
  function cashier(){
    const s=state,ui=flow.draft('ui'),sections=s.sections||{};let checklist='';
    if(!s.opening_locked&&!ui.checklist_hidden){
      const list=s.checklist||[],done=list.filter(x=>x.status==='done').length;
      const row=(label,status,ok,target)=>`<button class="op-check" data-open="${target}"><span class="op-mark ${ok?'ok':''}" aria-hidden="true">${ok?'✓':''}</span><span><b>${e(label)}</b><small>${e(status)}</small></span><span class="op-chev" aria-hidden="true">‹</span></button>`;
      checklist=`<div class="op-card"><div class="op-row"><b>أكمل تجهيز محلك</b><button class="ghost small" data-hide>إخفاء</button></div>
        <div class="op-progress">${list.map((_,i)=>`<i class="${i<done?'ok':''}"></i>`).join('')}</div><small class="muted">${done} من ${list.length}</small>
        ${row('الفلوس',STATUS[sections.money?.status]||'',sections.money?.status==='done','money')}
        ${row('البضاعة الموجودة',STATUS[sections.goods?.status]||'',sections.goods?.status==='done','goods')}
        ${row('الديون السابقة',STATUS[sections.debts?.status]||'',sections.debts?.status==='done','debts')}
        ${row('الشركاء والمراجعة',s.partners_saved?'محفوظ':'لم تبدأ',!!s.partners_saved,s.partners_saved?'review':'partners')}
        <button class="op-check ${s.lock_ready?'':'off'}" data-open="${s.lock_ready?'review':''}"><span class="op-mark" aria-hidden="true">🔒</span><span><b>تثبيت أرقام البداية</b><small>${s.lock_ready?'جاهز للمراجعة والتثبيت':'يتاح بعد اكتمال الأقسام'}</small></span></button></div>`;
    }
    const held=flow.heldSales().length;
    frame(`${checklist}
      <button class="op-hero" data-go="sale"><span><b>مبيعة جديدة</b><small>امسح باركود أو اختر صنف رصيده مؤكد ومتاح</small></span><span aria-hidden="true">▥</span></button>
      <div class="op-tiles"><button data-debts="customers"><span aria-hidden="true">👤</span>ديون الزبائن</button><button data-debts="suppliers"><span aria-hidden="true">🚚</span>حسابات الموردين</button><button data-go="purchase"><span aria-hidden="true">🧾</span>فاتورة شراء</button><button data-expense><span aria-hidden="true">💸</span>مصروف جديد</button><button data-go="history" class="wide"><span aria-hidden="true">🕘</span>سجل العمليات</button></div>
      ${s.opening_locked?'':ui.checklist_hidden?'<button class="ghost" data-show>إظهار قائمة تجهيز محلك</button>':''}
      ${held?`<button class="ghost" data-held-list>المبيعات المعلقة (${held})</button>`:''}`);
    on('[data-open]',node=>{const t=node.dataset.open;if(!t)return;if(t==='money')openMoney('cashier');else if(t==='goods')openGoods('cashier');else go(t);});
    on('[data-go]',node=>go(node.dataset.go));
    on('[data-debts]',node=>openDebts(node.dataset.debts));
    on('[data-expense]',expense);
    on('[data-hide]',()=>{flow.draft('ui',{checklist_hidden:true});render();});
    on('[data-show]',()=>{flow.draft('ui',{checklist_hidden:false});render();});
    on('[data-held-list]',heldSales);
  }

  // ---------- money (Figma 04) ----------
  function openMoney(from){returnTo=from;page='money';run(moneyFlow.load,value=>{moneyState=value;render();});}
  function money(){
    const s=moneyState;if(!s)return frame('<p>جارٍ التحميل…</p>');
    const confirmed=new Map((s.confirmed||[]).map(c=>[c.account_id,c])),draftValues=new Map((s.draft?.values_json||[]).map(v=>[v.account_id,v.counted_amount]));
    const order=['cash','bank'],accounts=[...s.accounts].sort((a,b)=>(order.indexOf(a.type)+1||9)-(order.indexOf(b.type)+1||9));
    if(s.pending?.preview){
      const lines=s.pending.preview.accounts||[];
      return frame(`<h2>راجع الفلوس قبل التأكيد</h2><p class="muted">هذه أرصدة البداية كما حسبها الخادم. لا نسجّل بيعاً أو شراء.</p><div class="op-card">${lines.map(l=>`<div class="op-row"><span>${e(l.name)}</span><b>${m(l.opening_amount??l.counted_amount)}</b></div>`).join('')}</div>`,
        '<button class="primary" data-commit>تأكيد الأرصدة</button><button class="outline" data-cancel>رجوع للتعديل</button>'),
        on('[data-commit]',()=>run(()=>moneyFlow.commit(s.pending.preview.review_token),()=>{say('تم تأكيد الأرصدة');openMoney(returnTo);})),
        on('[data-cancel]',()=>run(async()=>{await moneyFlow.cancel();return moneyFlow.load();},v=>{moneyState=v;render();}));
    }
    if(s.pending)return frame('<p class="op-lead">عندك مراجعة سابقة لم تكتمل.</p>','<button class="primary" data-check>تحقق منها</button><button class="outline" data-cancel>إلغاء المراجعة</button>'),
      on('[data-check]',()=>run(moneyFlow.prepare,v=>v.status==='confirmed'?openMoney(returnTo):run(moneyFlow.load,x=>{moneyState=x;render();}))),
      on('[data-cancel]',()=>run(async()=>{await moneyFlow.cancel();return moneyFlow.load();},v=>{moneyState=v;render();}));
    const open=accounts.filter(a=>!confirmed.has(a.id));
    frame(`<h2>أين فلوسك اليوم؟</h2><p class="muted">سجّل فلوس المحل، حتى لو جزء منها معك خارج الدرج، ولا تكتب فلوسك الشخصية. إذا ما عندك شيء، اختر «لا يوجد».</p>
      ${accounts.map(a=>{const c=confirmed.get(a.id);return `<div class="op-card"><div class="op-row"><b>${e(a.name)}</b>${c?pill('مؤكد','ok'):`<button class="ghost small" data-none="${e(a.id)}">لا يوجد</button>`}</div>
        ${c?`<p class="op-big">${m(c.opening_amount??c.counted_amount)}</p>`:field(`acc-${a.id}`,'المبلغ الموجود الآن',draftValues.get(a.id)??'','₪','autocomplete="off"')}</div>`;}).join('')}`,
      open.length?'<button class="primary" data-save>حفظ ومراجعة</button>':'<button class="primary" data-back2>تم تأكيد الأرصدة</button>');
    on('[data-none]',node=>{const input=app.querySelector(`[name="acc-${CSS.escape(node.dataset.none)}"]`);if(input)input.value='0';});
    on('[data-back2]',back);
    on('[data-save]',()=>{
      const values=[];
      try{for(const a of open){const raw=app.querySelector(`[name="acc-${CSS.escape(a.id)}"]`)?.value??'';if(!raw.trim())continue;values.push({account_id:a.id,counted_amount:Number(number(raw,2,'1000000000000'))}); /* the server requires a JSON number (≤2 decimals: exact) */}}
      catch{return showError('اكتب مبلغاً صحيحاً، بحد أقصى منزلتين عشريتين');}
      if(!values.length)return showError('اكتب المبلغ لكل حساب، أو اختر «لا يوجد»');
      run(async()=>{await moneyFlow.save(values);return moneyFlow.prepare();},v=>{if(v.status==='confirmed')openMoney(returnTo);else run(moneyFlow.load,x=>{moneyState=x;render();});});
    });
  }

  // ---------- goods (Figma 07–10) ----------
  function openGoods(from){returnTo=from;page='goods';stockSelected=new Set();run(stockFlow.load,value=>{stockState=value;render();});}
  function goods(){
    const s=stockState;if(!s)return frame('<p>جارٍ التحميل…</p>');
    if(s.pending?.preview){
      const lines=s.pending.preview.lines;
      return frame(`<h2>تأكيد الرصيد</h2><p class="muted">راجع الرصيد قبل التأكيد. لا نسجّل شراء أو حركة فلوس.</p>${lines.map(l=>`<div class="op-card"><b>${e(l.name)}</b><small class="muted">المعدود: ${e(l.counted_quantity)} · المسجّل: ${e(l.registered_quantity)}<br>الفرق الذي نضيفه: ${e(l.opening_quantity)} ${e(l.unit||'')}</small><div class="op-row"><span>قيمة البضاعة السابقة</span><b>${m(l.opening_value)}</b></div></div>`).join('')}`,
        '<button class="primary" data-commit>تأكيد الرصيد</button><button class="outline" data-cancel>رجوع</button>'),
        on('[data-commit]',()=>run(()=>stockFlow.commit(s.pending.preview.review_token),()=>{say('تم تأكيد الرصيد');openGoods(returnTo);})),
        on('[data-cancel]',()=>run(async()=>{await stockFlow.cancel();return stockFlow.load();},v=>{stockState=v;stockSelected=new Set();render();}));
    }
    const products=s.products,limit=s.free_limit||FREE_PRODUCTS,saves=Object.keys(s.saves||{});
    const body=!products.length?`<h2>سجّل البضاعة التي عندك الآن</h2><p class="muted">ابدأ بالأصناف الأكثر بيعاً، وأكمل الباقي في وقتك.</p><div class="op-note"><b>هذه البضاعة الموجودة في محلك قبل البداية</b><small>البضاعة التي تشتريها لاحقاً من مورد سجّلها كفاتورة شراء، وليس هنا.</small></div><p class="op-empty">لم تسجّل أي صنف بعد<br><small>لكل صنف: الكمية التي عددتها وسعر شراء الوحدة. تقدر تبيع الصنف بعد تأكيد رصيده.</small></p>`
      :`<div class="op-note"><small>قيمة البضاعة المؤكدة بسعر الشراء</small><p class="op-big">${m(s.confirmed_value)}</p>${s.paid?'':`<small>${products.length} من ${limit} صنفاً</small>`}</div>
      ${s.pending?'<button class="outline" data-check>تحقق من الطلب السابق</button>':''}
      ${saves.length?`<p class="op-warn">${saves.length} صنف لم يكتمل حفظه. <button class="ghost small" data-resave>إعادة المحاولة</button></p>`:''}
      ${products.map(row=>{const p=row.product,confirmed=!!row.confirmation,d=row.draft?.values_json;return `<div class="op-card"><div class="op-row"><b>${e(d?.name||p.name)}</b>${!confirmed&&!s.opening_locked?`<input type="checkbox" data-pick="${e(p.id)}" ${stockSelected.has(p.id)?'checked':''} aria-label="تحديد ${e(p.name)}">`:''}</div>
        ${pill(confirmed?'مؤكد':'بانتظار التأكيد',confirmed?'ok':'')}
        ${d&&!confirmed?`<small class="muted">${e(d.counted_quantity||'—')} ${e(d.unit||'')} · ${m(d.unit_cost)} للوحدة</small>`:`<small class="muted">الكمية المتاحة: ${e(p.quantity_pieces)} ${e(p.base_unit||'')}</small>`}
        ${confirmed?`<p><b>${m(row.confirmation.opening_value)}</b></p>`:''}
        ${!confirmed&&!s.opening_locked?`<button class="outline small" data-edit="${e(p.id)}">مراجعة الرصيد</button>`:''}</div>`;}).join('')}`;
    const atLimit=!s.paid&&products.length>=limit;
    frame(body,`${s.opening_locked?'<p class="muted small">أرقام البداية مثبتة. البضاعة الجديدة تدخل بفاتورة شراء.</p>':`<button class="${products.length?'outline':'primary'}" data-add ${atLimit||s.pending?'disabled':''}>+ إضافة صنف</button>`}
      ${stockSelected.size?`<button class="primary" data-confirm>تأكيد المحدد (${stockSelected.size})</button>`:''}
      ${products.length&&!s.opening_locked?'<p class="muted small">تأكيد الرصيد يحتاج اتصال. بعده تقدر تبيع من الصنف، وأي تعديل يدخل كتصحيح ويظهر في السجل.</p>':''}
      ${atLimit?`<p class="op-warn">وصلت إلى ${limit} صنفاً في الخطة المجانية.</p>`:''}`);
    app.querySelectorAll('[data-pick]').forEach(box=>box.onchange=()=>{box.checked?stockSelected.add(box.dataset.pick):stockSelected.delete(box.dataset.pick);render();});
    on('[data-add]',()=>stockEditor(null));
    on('[data-edit]',node=>stockEditor(products.find(r=>r.product.id===node.dataset.edit)));
    on('[data-confirm]',()=>run(()=>stockFlow.prepare([...stockSelected]),v=>{stockSelected=new Set();if(v.status==='confirmed')openGoods(returnTo);else{stockState=stockFlow.snapshot();render();}}));
    on('[data-check]',()=>run(()=>stockFlow.prepare([]),v=>{if(v.status==='confirmed')openGoods(returnTo);else{stockState=stockFlow.snapshot();render();}}));
    on('[data-resave]',()=>run(async()=>{const saves=stockFlow.snapshot().saves;let last;for(const a of Object.values(saves))last=await stockFlow.save(a.values,a.source_token,a.counted_at);return last||stockFlow.load();},v=>{stockState=v;render();}));
  }
  function stockEditor(row,barcode=''){
    const p=row?.product,d=row?.draft?.values_json||null,id=p?.id||crypto.randomUUID();
    const source=row?row.source_token:stockState.new_source_token;
    const units=['علبة','قطعة','كيس','كغ','غرام','لتر'];
    const dlg=sheet('صنف موجود في المحل',`<p class="muted small">بضاعة كانت موجودة قبل البداية · لا تدخل كمشتريات</p>
      ${field('name','اسم الصنف',d?.name||p?.name||'')}
      <label class="op-field">الوحدة التي تبيع بها<span class="op-input"><input name="unit" list="op-units" value="${e(d?.unit||p?.base_unit||'')}" ${p?'readonly':''}></span></label><datalist id="op-units">${units.map(u=>`<option value="${u}">`).join('')}</datalist>
      <div class="op-two">${field('qty','الكمية التي عددتها الآن',d?.counted_quantity||'','#')}${field('cost','سعر شراء الوحدة',d?.unit_cost||'','₪')}</div>
      <p class="muted small">أدخل تكلفة شراء الوحدة من البضاعة الموجودة، وليس سعر بيعها.</p>
      ${field('price','سعر البيع',d?.sale_price||p?.default_sale_price||'','₪')}<p class="muted small">لا يدخل في قيمة البضاعة، فقط للبيع</p>
      <p class="op-row"><span>قيمة هذا الصنف بسعر الشراء</span><b data-value>—</b></p>
      <details><summary>تفاصيل إضافية اختيارية</summary>${field('barcode','الباركود',d?.barcode?.startsWith('manual-')?'':(d?.barcode||p?.barcode||barcode),'',`dir="ltr" ${p?'readonly':''}`)}${p?'':'<button type="button" class="ghost small" data-scan-code>📷 مسح باركود</button>'}${field('category','التصنيف',d?.category||'')}${field('low','تنبيه نقص المخزون',d?.low_stock_level||'','#')}${field('notes','ملاحظات',d?.notes||'')}</details>`,
      [['تأكيد الرصيد',d=>saveStock(d,true)],['حفظ بدون تأكيد',d=>saveStock(d,false)]]);
    const value=()=>{const q=dec(dlg.querySelector('[name=qty]').value),c=dec(dlg.querySelector('[name=cost]').value);dlg.querySelector('[data-value]').textContent=q&&c?m(Math.round(q*c*100)/100):'—';};
    dlg.querySelectorAll('[name=qty],[name=cost]').forEach(i=>i.oninput=value);value();
    const scanCode=dlg.querySelector('[data-scan-code]');
    if(scanCode)scanCode.onclick=()=>{closeSheet();openBarcodeScanner({onDetected:code=>{if(alive())stockEditor(row,code);},isCurrent:alive}).catch(()=>{});};
    function saveStock(dlg,confirm){
      const v=name=>dlg.querySelector(`[name=${name}]`).value;let values;
      try{values={product_id:id,name:v('name').trim(),unit:v('unit').trim(),barcode:v('barcode').trim()||`manual-${id}`,
        counted_quantity:number(v('qty'),3,'100000000000',true),unit_cost:number(v('cost'),4,'10000000000',true),sale_price:number(v('price'),2,'1000000000000',true),
        category:v('category'),low_stock_level:number(v('low'),3,'100000000000',true),notes:v('notes')};
        if(!values.name||!values.unit)throw new Error();
        if(confirm&&(!values.counted_quantity||!values.unit_cost))throw new Error();}
      catch{return sheetError(dlg,'راجع الاسم والوحدة والأرقام. التأكيد يحتاج الكمية وسعر الشراء.');}
      const counted=d&&d.counted_quantity===values.counted_quantity&&row?.draft?.counted_at?row.draft.counted_at:new Date().toISOString();
      run(async()=>{await stockFlow.save(values,source,counted);return confirm?stockFlow.prepare([id]):null;},v=>{closeSheet();if(v?.status==='confirmed'||!confirm)openGoods(returnTo);else{stockState=stockFlow.snapshot();render();}});
    }
  }

  // ---------- old debts (Figma 11–12) ----------
  function debts(){
    const s=state,list=s.debts||[];
    const section=kind=>{const customer=kind==='customer',rows=list.filter(d=>d.kind===kind),checked=s[customer?'customers_checked':'suppliers_checked'];
      return `<div class="op-card"><div class="op-row"><b>${customer?'لك على زبائن':'عليك لموردين'}</b>${rows.length?pill('لا يوجد'):checked?pill('لا يوجد ✓','ok'):`<button class="ghost small" data-none="${kind}">لا يوجد</button>`}</div><small class="muted">${customer?'فلوس لازم تستلمها':'فلوس لازم تدفعها'}</small>
      ${rows.map(d=>`<button class="op-line" data-debt="${e(d.id)}" ${d.confirmed?'disabled':''}><span>${e(d.name)}</span><span><b>${d.amount===null||d.amount===undefined?'—':m(d.amount)}</b>${pill(d.confirmed?'مؤكد':'بانتظار التأكيد',d.confirmed?'ok':'')}</span></button>`).join('')}
      ${rows.length?`<div class="op-row"><span class="muted">المجموع المؤكد</span><b>${m(s[customer?'customers_value':'suppliers_value'])}</b></div>`:''}
      <button class="ghost" data-add-debt="${kind}">${customer?'+ إضافة زبون عليه دين':'+ إضافة مورد له دين عليك'}</button></div>`;};
    frame(`<h2>ديون من قبل البداية</h2><p class="muted">سجّل المبلغ المتبقي اليوم فقط. هذه ديون قديمة، لا تدخل كمبيعات أو مشتريات جديدة.</p>${section('customer')}${section('supplier')}`,
      '<p class="muted small">تقدر تحفظ وتكمل لاحقاً. القسم يبقى «قيد الاستكمال» حتى تضغط هذا الزر.</p><button class="primary" data-finish>انتهيت من تسجيل الديون السابقة</button><button class="ghost" data-later>حفظ والرجوع</button>');
    on('[data-none]',node=>post('debts_check',{kind:node.dataset.none},'debts'));
    on('[data-add-debt]',node=>debtEditor(node.dataset.addDebt,null));
    on('[data-debt]',node=>{const d=list.find(x=>x.id===node.dataset.debt);if(d)debtEditor(d.kind,d);});
    on('[data-finish]',()=>post('debts_finish',{},'partners'));
    on('[data-later]',()=>go('cashier'));
  }
  function debtEditor(kind,existing){
    const customer=kind==='customer',saved=existing||flow.draft(`debt:${kind}`),id=saved.id||crypto.randomUUID();
    const dlg=sheet(customer?'دين قديم لك على زبون':'دين قديم عليك لمورد',`${pill(customer?'دين سابق · لا يدخل كمبيعة جديدة':'دين سابق · لا يدخل كفاتورة شراء جديدة')}
      ${field('name',customer?'اسم الزبون':'اسم المورد',saved.name||'')}${field('phone','رقم الجوال (اختياري)',saved.phone||'','','dir="ltr" inputmode="tel" placeholder="059 XXX XXXX"')}
      ${field('amount',customer?'المبلغ المتبقي عليه اليوم':'المبلغ المتبقي عليك اليوم',saved.amount??'','₪')}<p class="muted small">اكتب الباقي بعد أي دفعات سابقة، وليس المبلغ الأصلي</p>${field('note','ملاحظة (اختياري)',saved.note||'','','placeholder="مثال: من دفتر الديون"')}`,
      [['تأكيد الدين',d=>send(d,true)],['حفظ بدون تأكيد',d=>send(d,false)]]);
    const keep=()=>{const v=n=>dlg.querySelector(`[name=${n}]`).value;flow.draft(`debt:${kind}`,{id,kind,name:v('name'),phone:v('phone'),amount:v('amount'),note:v('note')});};
    if(!existing)dlg.querySelectorAll('input').forEach(i=>i.addEventListener('input',keep));
    function send(dlg,confirm){
      const v=n=>dlg.querySelector(`[name=${n}]`).value;
      if(!v('name').trim())return sheetError(dlg,'اكتب الاسم');
      let amount;try{amount=number(v('amount'),2,'1000000000000',!confirm);}catch{return sheetError(dlg,'راجع المبلغ. اكتب المبلغ المتبقي فقط.');}
      run(()=>flow.command(confirm?'debt_confirm':'debt_save',{id,kind,name:v('name').trim(),phone:v('phone').trim(),note:v('note'),amount}),()=>{flow.draft(`debt:${kind}`,{});closeSheet();reload('debts');});
    }
  }

  // ---------- partners (Figma 05, 05b, 06) ----------
  function partnerDraft(){const d=flow.draft('partners');if(!d.partners)d.partners=structuredClone(state.partners||[]);if(!d.partners.length)d.partners.push({id:crypto.randomUUID(),name:'',share:'',capital:''});return d;}
  const total=(rows,k)=>sum2(rows.map(r=>r[k]));
  function partners(capital){
    const d=partnerDraft(),rows=d.partners,paid=!!state.stock?.paid,recorded=state.value_recorded_so_far??'0';
    let top;
    if(capital){
      const byShare=d.capital_mode==='share',equal=rows.every(r=>r.share===rows[0].share);
      top=`<h2>كيف توزّعون قيمة ما سجّلته بين الشركاء؟</h2><p class="muted">أدخلوا الرصيد المتفق عليه لكل شريك عند البداية. قد يختلف عن نسبة الربح، ولا يشمل ما لم تسجّلوه.</p>
        ${choice('share','حسب نسبة الربح',equal?`اقتراح: ${m(Math.floor(dec(recorded)*100/Math.max(1,rows.length))/100)} لكل شريك، أكّدوه بأنفسكم`:'اقتراح حسب نسبة كل شريك، أكّدوه بأنفسكم',byShare)}${choice('custom','مبالغ مختلفة','اكتبوا الرصيد المتفق عليه لكل شريك',!byShare)}`;
    }else{
      const single=d.ownership==='single'||!d.ownership&&rows.length===1&&rows[0].share==='100',multi=d.ownership==='multi'||!d.ownership&&rows.length>1;
      top=`${steps()}<h2>من يملك المحل؟</h2>${choice('single','المحل لشخص واحد','شريك واحد يملك المحل بنسبة 100%',single)}${choice('multi','المحل لعدة شركاء','حدد نسبة كل شريك من الربح',multi)}<p class="muted small">إذا كنت تدير المحل ولست شريكاً، فلا مشكلة. أضف الشركاء فقط.</p>`;
    }
    const key=capital?'capital':'share',locked=capital&&d.capital_mode==='share';
    const list=rows.map((r,i)=>`<div class="op-card op-partner"><div><input class="op-name" data-name="${i}" value="${e(r.name)}" placeholder="اسم الشريك" aria-label="اسم الشريك">${capital?`<small class="muted">ربحه ${e(r.share)}%</small>`:''}</div><span class="op-input small"><i>${capital?'₪':'%'}</i><input data-val="${i}" value="${e(r[key]??'')}" inputmode="decimal" dir="ltr" ${locked?'readonly':''} aria-label="${capital?'رصيد البداية':'نسبة الربح'}"></span></div>`).join('');
    frame(`${top}${list}${capital?'':'<button class="ghost" data-add>+ إضافة شريك</button>'}
      <div class="op-bar"><i data-bar></i></div><div class="op-row"><b data-total></b>${!capital&&!paid?'<small class="muted">الخطة المجانية: حتى شريكين</small>':''}</div>
      ${capital?'<p class="muted small">المجموع لازم يساوي قيمة ما سجّلته في محلك</p><button class="ghost" data-how>كيف نحسب هذه المبالغ؟</button>':''}`,
      '<button class="primary" data-next>متابعة</button><button class="ghost" data-later>متابعة البيع وأكمل لاحقاً</button>');
    const recount=()=>{const sum=total(rows,key),target=capital?dec(recorded):100,ok=Math.abs(sum-target)<0.0001;
      app.querySelector('[data-total]').textContent=capital?`المجموع ${m(sum)} من ${m(recorded)}`:`المجموع ${sum}%`;app.querySelector('[data-total]').className=ok?'ok':'warn';
      const bar=app.querySelector('[data-bar]');bar.style.width=`${Math.max(0,Math.min(100,target>0?sum/target*100:0))}%`;bar.className=ok?'ok':'';};
    const save=()=>{flow.draft('partners',d);recount();};
    app.querySelectorAll('[data-name]').forEach(i=>i.oninput=()=>{rows[i.dataset.name].name=i.value;save();});
    app.querySelectorAll('[data-val]').forEach(i=>i.oninput=()=>{rows[i.dataset.val][key]=i.value;save();});
    recount();
    on('[data-choice]',node=>{const c=node.dataset.choice;
      if(c==='single'){rows.splice(1);rows[0].share='100';d.ownership='single';}
      else if(c==='multi'){d.ownership='multi';if(rows.length<2)rows.push({id:crypto.randomUUID(),name:'',share:'',capital:''});if(rows[0].share==='100')rows[0].share='';}
      else if(c==='share'){try{for(const r of rows){const v=Math.round(dec(recorded)*dec(r.share))/100;if(Math.abs(dec(recorded)*dec(r.share)/100-v)>1e-9)throw new Error();r.capital=String(v);}d.capital_mode='share';}catch{return showError('اكتبوا المبالغ المتفق عليها بأنفسكم؛ الاقتراح لا يطابق المبلغ بدقة.');}}
      else d.capital_mode='custom';
      flow.draft('partners',d);render();});
    on('[data-add]',()=>{if(rows.length>=2&&!paid)return showError('الخطة المجانية: حتى شريكين. اشترك لإضافة شركاء أكثر.');rows.push({id:crypto.randomUUID(),name:'',share:'',capital:''});flow.draft('partners',d);render();});
    on('[data-how]',()=>sheet('كيف نحسب هذه المبالغ؟','<p>قيمة ما سجّلته = فلوس + بضاعة بسعر الشراء + ديون لك − ديون عليك. الأرقام مبدئية وتقدر تتابع الآن. المطابقة النهائية تكون عند تثبيت أرقام البداية بعد ما تكمل تجهيز محلك، فلا تكتب مبالغ غير حقيقية.</p>',[['فهمت',closeSheet]]));
    on('[data-next]',()=>go(capital?'retained':'capital'));
    on('[data-later]',()=>go('cashier'));
  }
  function retained(){
    const d=partnerDraft(),saved=d.retained_rate??(state.partners_saved?String(state.retained_rate??''):'');
    const mode=d.retained_mode||(saved===''?'':dec(saved)===0?'no':'yes'),preset=['5','10','15','20'],other=saved!==''&&!preset.includes(saved);
    const example=()=>{const kept=Math.floor(1000*dec(saved))/100,rest=1000-kept;return `<div class="op-card"><small class="muted">مثال مبسّط: لو توفّر ${m(1000)} قبل تخصيص حصة المحل</small><div class="op-row"><span>يبقى للمحل</span><b>${m(kept)}</b></div>${d.partners.filter(p=>p.share!=='').map(p=>`<div class="op-row"><span>${e(p.name||'شريك')}</span><b>${m(Math.floor(rest*dec(p.share))/100)}</b></div>`).join('')}</div>`;};
    frame(`${steps()}<h2>هل تريد إبقاء جزء من الأرباح داخل المحل؟</h2><p class="muted">هذا الجزء يبقى لتشغيل المحل وحماية رأس ماله. ليس مصروفاً، ولا ينقص من رأس مال أي شريك.</p>
      ${choice('no','لا، وزّع كل الأرباح','كل الربح يتوزع على الشركاء',mode==='no')}${choice('yes','نعم، أبقِ نسبة للمحل','اختر النسبة من الأرباح',mode==='yes')}
      ${mode==='yes'?`<div class="op-chips">${preset.map(p=>`<button class="op-chip ${p===saved?'on':''}" data-rate="${p}">${p}%</button>`).join('')}<button class="op-chip ${other?'on':''}" data-other>${other?saved+'%':'نسبة أخرى'}</button></div>
        <div data-other-box ${other?'':'hidden'}>${field('rate','نسبة حصة المحل',other?saved:'','%')}</div>${example()}`:''}
      <details class="op-card" ${d.retained_cap||state.retained_cap?'':''}><summary>كيف نحسبه؟ ومتى يتوقف الاقتطاع</summary><p class="muted small">الاقتطاع يراعي حماية رأس المال والأرباح السابقة، ويتوقف لما توصل حصة المحل المتجمّعة إلى السقف المحدد لمحلك.</p>${field('cap','السقف',d.retained_cap??state.retained_cap??'','₪')}</details>`,
      `<button class="primary" data-confirm ${mode?'':'disabled'}>مراجعة وتأكيد</button>`);
    const keep=()=>flow.draft('partners',d);
    on('[data-choice]',node=>{if(node.dataset.choice==='no'){d.retained_mode='no';d.retained_rate='0';}else{d.retained_mode='yes';if(!d.retained_rate||d.retained_rate==='0')d.retained_rate='10';}keep();render();});
    on('[data-rate]',node=>{d.retained_rate=node.dataset.rate;keep();render();});
    on('[data-other]',()=>{const box=app.querySelector('[data-other-box]');box.hidden=false;box.querySelector('input').focus();});
    const rate=app.querySelector('[name=rate]');if(rate)rate.oninput=()=>{d.retained_rate=rate.value;keep();};
    const cap=app.querySelector('[name=cap]');cap.oninput=()=>{d.retained_cap=cap.value;keep();};
    on('[data-confirm]',()=>{
      const values=structuredClone(d);delete values.capital_mode;delete values.retained_mode;delete values.ownership;
      try{for(const p of values.partners){p.share=number(p.share,4,'101');p.capital=number(p.capital,2,'1000000000000');if(!String(p.name||'').trim())throw new Error();}
        if(!d.retained_rate&&d.retained_rate!=='0')throw new Error();values.retained_rate=number(d.retained_rate,4,'101');}
      catch{return showError('أكمل أسماء الشركاء ونسب الربح ومبالغ البداية، واختر حصة المحل.');}
      try{values.retained_cap=number(cap.value,2,'1000000000000');}catch{app.querySelector('details').open=true;return showError('اكتب السقف الذي تتوقف عنده حصة المحل.');}
      post('partners_save',values,'review');
    });
  }

  // ---------- review & lock (Figma 13–16) ----------
  function review(){
    const s=state,sec=s.sections||{},ready=!!s.lock_ready;
    const line=(label,id,value)=>`<div class="op-line"><span>${e(label)}<br>${pill(STATUS[sec[id]?.status]||'',sec[id]?.status==='done'?'ok':'warn')}</span><span><b>${m(value)}</b><button class="ghost small" data-open="${id}">مراجعة</button></span></div>`;
    const early=s.pre_lock_sales,ops=(s.operations||[]).length;
    frame(`${steps()}<div class="op-banner ${ready?'ok':'warn'}"><b>${ready?'كل الأقسام مكتملة':'أكمل الأقسام غير المكتملة'}</b><small>${ready?'راجع الأرقام. بعد تثبيت أرقام البداية تصبح هذه القيمة أساس رأس مال الشركاء.':'أكمل الأقسام غير المكتملة وراجع مبالغ الشركاء قبل التثبيت.'}</small></div>
      <div class="op-card"><b>أرقام البداية</b>${line('الفلوس','money',sec.money?.confirmed_opening_value)}${line('البضاعة بسعر الشراء','goods',sec.goods?.confirmed_opening_value)}${line('ديون لك على زبائن','debts',s.customers_value)}${line('ديون عليك لموردين','debts',s.suppliers_value)}
      <div class="op-row"><b>قيمة ما سجّلته في محلك</b><b class="op-big">${m(s.value_recorded_so_far)}</b></div><small class="muted">فلوس + بضاعة بسعر الشراء + ديون لك − ديون عليك. لا يشمل الأثاث والمعدات.</small>
      ${dec(s.value_recorded_so_far)<=0?'<p class="op-warn">رأس مال الشركاء غير محسوب. لا تضف مبالغ غير حقيقية لتغيير النتيجة. إذا كانت الأرقام صحيحة، تواصل معنا لمراجعة وضع محلك.</p>':''}</div>
      ${early?.count>0?`<div class="op-card"><b>مبيعات قبل تثبيت النسب</b><div class="op-row"><span class="muted">${e(early.count)} عملية</span><b>ربحها ${m(early.gross_profit)}</b></div><small class="muted">تتوزع على الشركاء بالنسب التي تثبّتها في هذه الصفحة، مرة واحدة عند التثبيت.</small></div>`:''}
      ${ops?`<div class="op-card"><b>عمليات بعد البداية</b><small class="muted">${ops} عملية: مبيعات، مشتريات وغيرها. لا تدخل في رأس المال مباشرة، ونستخدمها لنفصل أرقام البداية عن أرصدتك الحالية.</small></div>`:''}
      <div class="op-card"><b>الشركاء</b><small class="muted">رأس مال كل شريك ونسبته من الربح</small>${(s.partners||[]).map(p=>`<div class="op-row"><span><b>${e(p.name)}</b> <small class="muted">ربح ${e(p.share)}%</small></span><b>${m(p.capital)}</b></div>`).join('')}
      <label class="op-agree"><input type="checkbox" data-agree> أؤكد أن هذه النسب ومبالغ رأس المال صحيحة</label><button class="ghost small" data-goto="partners">مراجعة</button></div>
      <div class="op-card"><b>حصة المحل من الأرباح</b><div class="op-row"><span class="muted">نسبة تبقى للمحل</span><b>${e(s.retained_rate??0)}%</b></div><div class="op-row"><span class="muted">السقف</span><b>${m(s.retained_cap??0)}</b></div><small class="muted">تنقص من الأرباح القادمة فقط، وليس من رأس مال أي شريك.</small><button class="ghost small" data-goto="retained">مراجعة</button></div>`,
      `<button class="primary" data-lock ${ready&&!s.opening_locked?'':'disabled'}>مراجعة وتثبيت أرقام البداية</button><button class="ghost" data-goto="cashier">متابعة البيع وأكمل لاحقاً</button>`);
    on('[data-open]',node=>{const t=node.dataset.open;if(t==='money')openMoney('review');else if(t==='goods')openGoods('review');else go('debts');});
    on('[data-goto]',node=>go(node.dataset.goto));
    on('[data-lock]',()=>{if(!app.querySelector('[data-agree]').checked)return showError('أكّد اتفاق الشركاء على النسب والمبالغ أولاً');beforeLock();});
  }
  function beforeLock(){
    const limit=!state.stock?.paid&&(state.stock?.products?.length||0)>=(state.stock?.free_limit||FREE_PRODUCTS),max=state.stock?.free_limit||FREE_PRODUCTS;
    const items=[['فلوس كل الحسابات','الكاش في الدرج ومعك، والبنك والمحافظ'],['كل البضاعة','المخزن الخلفي، الرفوف العالية، الثلاجة، والكراتين المسكّرة'],['الديون القديمة','ما لك على الزبائن، وما عليك للموردين']];
    const dlg=sheet('قبل ما تثبّت أرقام البداية',`<p class="muted">راجع هذه الأسئلة. ما تنساه تقدر تصححه لاحقاً، لكنه يغيّر رأس مال الشركاء.</p>${items.map((x,i)=>`<label class="op-agree"><input type="checkbox" data-q="${i}"><span><b>${x[0]}</b><small class="muted">${x[1]}</small></span></label>`).join('')}
      ${limit?`<div class="op-banner warn"><b>وصلت إلى ${max} من ${max} صنفاً</b><small>إذا عندك بضاعة لم تسجّلها، تقدر تضيفها بعد التثبيت كتصحيح، لكن تحتاج الاشتراك الشهري لإضافة أكثر من ${max} صنفاً.</small></div>`:''}`,
      [[limit?'فهمت، ثبّت أرقام البداية':'كل شيء مسجّل، أكمل',d=>{const q=i=>d.querySelector(`[data-q="${i}"]`).checked;
        if(!q(0)||!q(2)||(!limit&&!q(1)))return sheetError(d,'علّم كل سؤال بعد ما تتأكد منه، أو ارجع وأضف الناقص.');
        run(()=>flow.prepareLock(true,limit),()=>{closeSheet();state=flow.snapshot();render();});}],
       ['رجوع وإضافة الناقص',()=>{closeSheet();go('cashier');}]]);
    void dlg;
  }
  function lockConfirm(preview){
    const people=preview.partners||state.partners||[],early=state.pre_lock_sales;
    frame(`<h2>تثبيت أرقام البداية؟</h2><p class="op-big">رأس المال ${m(preview.opening_value)}</p><div class="op-card">${people.map(p=>`<div class="op-row"><span>${e(p.name)}</span><b>${m(p.capital)}</b></div>`).join('')}</div>
      <p class="muted">تثبيت أرقام البداية يعتمد الأرقام ورأس مال الشركاء، ولا يسجّل الأرصدة المؤكدة مرة ثانية.</p>
      ${early?.count>0?`<p><b>مبيعات قبل تثبيت النسب: ${e(early.count)} عملية، ربحها ${m(early.gross_profit)}. تتوزع على الشركاء بالنسب التي تثبّتها الآن.</b></p>`:''}`,
      '<button class="primary" data-commit>تثبيت أرقام البداية</button><button class="ghost" data-cancel>العودة للمراجعة</button>');
    on('[data-commit]',()=>run(flow.commitLock,()=>{say('تم تثبيت أرقام البداية');reload('cashier');}));
    on('[data-cancel]',()=>run(async()=>{await flow.cancel();return flow.load();},v=>{state=v;page='review';render();}));
  }

  // ---------- sale (Figma 26–27) ----------
  const products=()=>state.stock?.products||[];
  const product=id=>products().find(r=>r.product.id===id);
  const cart=()=>flow.draft('cart').items||[];
  const saveCart=items=>flow.draft('cart',{items});
  const accounts=()=>state.money?.accounts||[];
  const accountName=id=>accounts().find(a=>a.id===id)?.name||'';
  const customers=()=>state.operating_customers||(state.debts||[]).filter(d=>d.confirmed&&d.kind==='customer');
  const suppliers=()=>state.operating_suppliers||(state.debts||[]).filter(d=>d.confirmed&&d.kind==='supplier');
  const options=(rows,chosen,empty)=>`${empty?`<option value="">${e(empty)}</option>`:''}${rows.map(r=>`<option value="${e(r.id)}" ${r.id===chosen?'selected':''}>${e(r.name)}</option>`).join('')}`;
  function sale(){
    const items=cart(),pay=flow.draft('payment'),cash=accounts().find(a=>a.type==='cash')||accounts()[0];
    const chosen=pay.account_id||cash?.id||'',asDebt=!!pay.as_debt&&!pay.composed,composed=!!pay.composed;
    const subtotal=sum2(items.map(i=>Math.round(dec(i.quantity)*dec(i.unit_sale_price)*100)/100));
    frame(`<form class="op-search" data-search><input name="q" placeholder="امسح باركود أو ابحث عن صنف" autocomplete="off" aria-label="امسح باركود أو ابحث عن صنف"><button class="op-icon" aria-label="بحث">⌕</button><button type="button" class="op-icon" data-scan aria-label="مسح باركود بالكاميرا">📷</button></form>
      ${products().length?`<p class="muted small">أصناف سريعة</p><div class="op-chips scroll">${products().map(r=>`<button class="op-chip ${r.confirmation||r.purchased?'':'dim'}" data-item="${e(r.product.id)}">${e(r.product.name)}</button>`).join('')}</div>`:''}
      ${items.map((i,n)=>`<div class="op-cart"><button class="op-cart-name" data-edit="${n}"><b>${e(i.name)}</b><small>${m(i.unit_sale_price)}</small></button><span class="op-stepper" dir="ltr"><button data-minus="${n}" aria-label="إنقاص">−</button><b>${e(i.quantity)}</b><button data-plus="${n}" aria-label="زيادة">+</button></span></div>`).join('')||'<p class="muted">السلة فارغة. امسح باركود أو اختر صنفاً.</p>'}
      <p class="muted small">طريقة الدفع</p><div class="op-chips">${accounts().map(a=>`<button class="op-chip ${!asDebt&&!composed&&a.id===chosen?'on':''}" data-pay="${e(a.id)}">${e(a.name)}</button>`).join('')}<button class="op-chip ${asDebt?'on':''}" data-debt>على الحساب</button></div>
      ${Number(state.payment_composition_bridge)===1?`<button class="ghost" data-split>${composed?'مراجعة الدفع الجزئي أو المقسّم':'دفع جزئي أو مقسّم'}</button>`:''}
      ${composed?`<div class="op-card">${(pay.payments||[]).map(x=>`<div class="op-row"><span>${e(accountName(x.account_id))}</span><b>${m(x.amount)}</b></div>`).join('')}${pay.customer_id?`<div class="op-row"><span>الباقي على</span><b>${e(customers().find(c=>c.id===pay.customer_id)?.name||'')}</b></div>`:''}</div>`:''}
      ${asDebt?`<label class="op-field">الزبون<select name="customer">${options(customers(),pay.customer_id,'اختر الزبون')}</select></label><button class="ghost" data-new-customer>+ إضافة زبون</button>`:''}
      ${field('discount','الخصم',pay.discount||'0','₪')}`,
      `<div class="op-row"><span class="muted">المجموع</span><b class="op-big" data-total>${m(subtotal-dec(pay.discount))}</b></div><button class="primary" data-finish ${items.length?'':'disabled'}>إتمام البيع</button><button class="ghost" data-refresh>راجع التغييرات في البضاعة</button>`);
    app.querySelector('[data-search]').onsubmit=ev=>{ev.preventDefault();find(ev.target.q.value);};
    on('[data-item]',node=>saleItem(node.dataset.item,-1));
    on('[data-edit]',node=>saleItem(items[node.dataset.edit].product_id,Number(node.dataset.edit)));
    on('[data-plus]',node=>changeQty(Number(node.dataset.plus),1));
    on('[data-minus]',node=>changeQty(Number(node.dataset.minus),-1));
    on('[data-pay]',node=>{flow.draft('payment',{...pay,account_id:node.dataset.pay,as_debt:false,composed:false});render();});
    on('[data-debt]',()=>{flow.draft('payment',{...pay,as_debt:true,composed:false});render();});
    on('[data-split]',()=>splitPayment(subtotal));
    on('[data-new-customer]',()=>newContact('customer',id=>{flow.draft('payment',{...flow.draft('payment'),customer_id:id});}));
    on('[data-scan]',()=>openBarcodeScanner({onDetected:value=>{if(alive()&&page==='sale')find(value);},isCurrent:()=>alive()&&page==='sale'}));
    const customer=app.querySelector('[name=customer]');if(customer)customer.onchange=()=>flow.draft('payment',{...flow.draft('payment'),customer_id:customer.value});
    const discount=app.querySelector('[name=discount]');discount.oninput=()=>{flow.draft('payment',{...flow.draft('payment'),discount:discount.value});app.querySelector('[data-total]').textContent=m(subtotal-dec(discount.value));};
    on('[data-refresh]',()=>run(flow.load,v=>{state=v;const fresh=cart().map(line=>{const row=product(line.product_id);return row?{...line,source_token:row.source_token}:null;});
      if(fresh.some(x=>!x))return render(),showError('صنف في السلة لم يعد متاحاً. احذفه أولاً.');saveCart(fresh);render();say('تم تحديث البضاعة');}));
    on('[data-finish]',()=>{
      const frozen=cart();if(!frozen.length)return showError('أضف صنفاً للسلة أولاً');
      let values;try{values={items:frozen,discount:number(discount.value||'0',2,'1000000000000'),as_debt:asDebt};}catch{return showError('راجع الخصم');}
      if(composed){const total=Math.round((subtotal-dec(values.discount))*100)/100,paid=sum2((pay.payments||[]).map(x=>x.amount));
        if(paid>total)return showError('المبالغ المدفوعة أكثر من مجموع المبيعة. راجع الدفع المقسّم.');
        if(paid<total&&!pay.customer_id)return showError('اختر الزبون لتسجيل الباقي عليه.');
        values.payments=pay.payments||[];if(paid<total)values.customer_id=pay.customer_id;values.as_debt=false;}
      else if(asDebt){const id=customer?.value||'';if(!id)return showError('اختر الزبون للمبيعة على الحساب');values.customer_id=id;}
      else{if(!chosen)return showError('اختر طريقة الدفع');values.account_id=chosen;}
      run(()=>flow.command('sale',values),receipt=>{saveCart([]);flow.draft('payment',{account_id:chosen});doneSale(receipt,values);});
    });
  }
  function find(value){
    value=String(value||'').trim();if(!value)return;
    const exact=products().find(r=>r.product.barcode===value);if(exact)return saleItem(exact.product.id,-1);
    const needle=value.toLowerCase(),matches=products().filter(r=>`${r.product.name} ${r.product.barcode||''}`.toLowerCase().includes(needle));
    if(matches.length===1)return saleItem(matches[0].product.id,-1);
    if(matches.length){const d=sheet('نتائج البحث',matches.map(r=>`<button class="op-line" data-pick="${e(r.product.id)}"><b>${e(r.product.name)}</b><small>${e(r.product.quantity_pieces)} ${e(r.product.base_unit||'')}</small></button>`).join(''),[['العودة للبيع',closeSheet],['الصنف غير موجود',()=>{closeSheet();unregistered(value);}]]);
      d.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{closeSheet();saleItem(b.dataset.pick,-1);});return;}
    unregistered(value);
  }
  function unregistered(value){
    sheet('هذا الباركود غير مسجّل عندك',`<p class="muted">أضف الصنف لتكمل البيع. الأصناف الموجودة في السلة محفوظة.</p><p dir="ltr"><b>${e(value)}</b></p>`,
      [['كانت موجودة عندي',()=>{if(state.opening_locked)return say('أرقام البداية مثبتة. البضاعة السابقة تحتاج تصحيحاً موثقاً.');closeSheet();openGoods('sale');}],['اشتريتها جديدة',()=>newProduct(value)]]);
  }
  function saleItem(id,index){
    const row=product(id);if(!row)return showError('الصنف غير متاح الآن');const p=row.product;
    if(!row.confirmation&&!row.purchased)return sheet(`${p.name}: رصيده بانتظار التأكيد`,'<p class="muted">راجع رصيد الصنف وأكّده حتى تبدأ تبيعه. باقي الأصناف المؤكدة والمتاحة تقدر تبيعها بشكل عادي.</p>',[['راجع وأكّد الرصيد',()=>{closeSheet();openGoods('sale');}],['العودة للبيع',closeSheet]]);
    if(dec(p.quantity_pieces)<=0)return sheet(`${p.name}: لا توجد كمية متاحة للبيع`,'<p class="muted">رصيد هذا الصنف مؤكد، لكن الكمية المتاحة الآن صفر</p>',[['تسجيل فاتورة شراء',()=>go('purchase')],['العودة للبيع',closeSheet]]);
    const items=cart(),prev=index<0?null:items[index];
    sheet(p.name,`${field('qty','الكمية',prev?.quantity||'1',p.base_unit||'#')}${field('price','سعر البيع',prev?.unit_sale_price??p.default_sale_price??'','₪')}<small class="muted">المتاح: ${e(p.quantity_pieces)} ${e(p.base_unit||'')}</small>`,
      [['إضافة للسلة',d=>{let count,price;try{count=number(d.querySelector('[name=qty]').value,3,'100000000000');price=number(d.querySelector('[name=price]').value,2,'1000000000000');if(dec(count)<=0||dec(count)>dec(p.quantity_pieces))throw new Error();}
        catch{return sheetError(d,'راجع الكمية والسعر. الكمية لا تتجاوز المتاح.');}
        const item={product_id:id,name:p.name,quantity:count,unit_sale_price:price,source_token:row.source_token};
        let target=index;items.forEach((x,i)=>{if(x.product_id===id)target=i;});if(target<0)items.push(item);else items[target]=item;saveCart(items);closeSheet();render();}]]);
  }
  function changeQty(index,delta){
    const items=cart(),item=items[index],next=Math.round((dec(item.quantity)+delta)*1000)/1000;
    if(next<=0)items.splice(index,1);else{const row=product(item.product_id);if(row&&next>dec(row.product.quantity_pieces))return showError('الكمية المطلوبة أكثر من المتاح.');item.quantity=String(next);}
    saveCart(items);render();
  }
  function doneSale(receipt,sent){
    const how=(receipt.as_debt??sent?.as_debt)?'على الحساب':accountName(receipt.account_id||sent?.account_id);
    page='done';app.innerHTML=`<section class="op-app op-done"><div class="op-ok" aria-hidden="true">✓</div><h2>تم تسجيل المبيعة</h2><p class="op-big">${m(receipt.total)}${how?` · ${e(how)}`:''}</p>
      ${receipt.paid_amount!==undefined?`<p>المدفوع: ${m(receipt.paid_amount)}</p>`:''}${receipt.debt_amount!==undefined?`<p>المتبقي على الزبون: ${m(receipt.debt_amount)}</p>`:''}
      <p class="muted small">رقم العملية ${e(receipt.sale_number||'')}</p><div class="op-foot"><button class="primary" data-a="cashier">الرجوع للكاشير</button><button class="outline" data-a="sale">مبيعة جديدة</button><button class="ghost" data-a="profits">ربح كل شريك</button></div></section>`;
    app.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>reload(b.dataset.a));
  }
  function anotherSale(){if(state?.pending)return say('تحقق من الطلب السابق أولاً');if(cart().length)flow.holdSale();else flow.draft('payment',{});render();}
  function heldSales(){
    const rows=flow.heldSales();
    const d=sheet('المبيعات المعلقة',`<p class="muted small">مسودات محفوظة على هذا المتصفح فقط. لا تؤثر في المخزون أو الحسابات قبل إتمام البيع.</p>${rows.map((r,i)=>`<div class="op-card"><b>مبيعة معلقة ${i+1}</b>${r.cart.items.map(x=>`<small class="muted">${e(x.name)} · ${e(x.quantity)} × ${m(x.unit_sale_price)}</small>`).join('<br>')}<div class="op-row"><button class="outline small" data-resume="${e(r.id)}">استكمال المبيعة</button><button class="ghost small" data-del="${e(r.id)}">حذف</button></div></div>`).join('')||'<p class="muted">لا توجد مبيعات معلقة.</p>'}`,[['رجوع',closeSheet]]);
    d.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>{flow.resumeHeldSale(b.dataset.resume);closeSheet();go('sale');});
    d.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(confirm('حذف هذه المسودة من المتصفح فقط؟')){flow.deleteHeldSale(b.dataset.del);closeSheet();render();heldSales();}});
  }

  // ---------- purchase ----------
  function purchase(){
    const d=flow.draft('purchase'),list=products(),cash=accounts().find(a=>a.type==='cash')||accounts()[0];
    frame(`<p class="muted">البضاعة التي اشتريتها من مورد تدخل كفاتورة شراء، ولا تغيّر أرقام البداية.</p>
      <label class="op-field">الصنف<select name="product">${options(list.map(r=>({id:r.product.id,name:r.product.name})),d.product_id,list.length?'':'لا توجد أصناف')}</select></label><button class="ghost" data-new>+ صنف جديد</button>
      ${field('qty','الكمية',d.quantity||'','#')}${field('cost','سعر شراء الوحدة',d.unit_cost||'','₪')}
      <label class="op-field">المورد<select name="supplier">${options(suppliers(),d.supplier_id,'بدون مورد — دفع كامل')}</select></label>
      <label class="op-field">الحساب الذي دفعت منه<select name="account">${options(accounts(),d.account_id||cash?.id)}</select></label>
      ${field('paid','المبلغ المدفوع',d.paid??'','₪')}<p class="muted small">إذا دفعت جزءاً فقط، اختر المورد ليسجّل الباقي عليك.</p>`,
      '<button class="primary" data-save>تسجيل فاتورة شراء</button>');
    const v=n=>app.querySelector(`[name=${n}]`).value;
    const keep=()=>flow.draft('purchase',{product_id:v('product'),supplier_id:v('supplier'),account_id:v('account'),quantity:v('qty'),unit_cost:v('cost'),paid:v('paid')});
    app.querySelectorAll('input,select').forEach(i=>{i.addEventListener('input',keep);i.addEventListener('change',keep);});
    on('[data-new]',()=>newProduct(''));
    on('[data-save]',()=>{
      const row=product(v('product'));let count,cost,paid;
      try{if(!row)throw new Error();count=number(v('qty'),3,'100000000000');cost=number(v('cost'),4,'10000000000');paid=number(v('paid')||'0',2,'1000000000000');if(dec(count)<=0)throw new Error();}
      catch{return showError('اختر الصنف وراجع الكمية والتكلفة والمبلغ المدفوع');}
      const payments=dec(paid)>0?[{account_id:v('account'),amount:paid}]:[];
      post('purchase',{items:[{product_id:row.product.id,quantity_pieces:count,unit_cost:cost,source_token:row.source_token}],payments,supplier_id:v('supplier')},'cashier');
    });
  }
  function newProduct(barcode){
    const d=flow.draft('new_product'),id=d.id||crypto.randomUUID();
    sheet('صنف جديد للبيع',`${field('name','اسم الصنف',d.name||'')}${field('barcode','الباركود',barcode||d.barcode||'','','dir="ltr"')}${field('unit','الوحدة التي تبيع بها',d.unit||'','','list="op-units"')}<datalist id="op-units">${['علبة','قطعة','كيس','كغ','غرام','لتر'].map(u=>`<option value="${u}">`).join('')}</datalist>${field('price','سعر البيع',d.sale_price||'','₪')}`,
      [['حفظ ومتابعة فاتورة الشراء',dlg=>{const v=n=>dlg.querySelector(`[name=${n}]`).value.trim();let values;
        try{values={id,name:v('name'),barcode:v('barcode')||`manual-${id}`,unit:v('unit'),sale_price:number(v('price'),2,'1000000000000')};if(!values.name||!values.unit)throw new Error();}
        catch{return sheetError(dlg,'أكمل الاسم والوحدة وسعر البيع');}
        flow.draft('new_product',values);
        run(()=>flow.command('product_create',values),()=>{flow.draft('new_product',{});flow.draft('purchase',{...flow.draft('purchase'),product_id:id});closeSheet();reload('purchase');});}]]);
  }

  // ---------- partners profit, accounts, history (Figma 34–36) ----------
  function profits(partnerId){
    const profit=state.profit||{partners:[]},rows=profit.partners||[],bridge=Number(state.finance_bridge)===1&&state.opening_locked;
    let body='';
    if(!partnerId)body+='<p class="muted small">حساب كل شريك = رأس ماله + أرباحه غير المسحوبة + حصته من المتروك − ديونه</p>';
    body+='<p class="op-warn small">ربح الفترة تقديري حتى الاعتماد. سحب الربح يكون من الرصيد المعتمد فقط.</p>';
    if(profit.allocation_complete===false)body+='<p class="op-warn small">توجد عمليات قبل تحديد نسب الشركاء أو تحتاج توزيعاً. لا نوزّعها بالنسب الحالية تلقائياً.</p>';
    const parts=[['رأس المال','capital'],['أرباح معتمدة لم يسحبها','prior_profit'],['ربح الفترة الحالية (تقديري)','period_profit'],['حصته من المتروك','retained_share'],['دين خسارة عليه للمحل','debt'],['قرض له على المحل','loan_payable'],['مبلغ أخذه كدين','cash_debt'],['ربح محجوز غير متاح للسحب','reserved_profit']];
    for(const r of rows){if(partnerId&&r.id!==partnerId)continue;
      body+=`<div class="op-card">${partnerId?`<h2>حساب ${e(r.name)}</h2><small class="muted">ربح ${e(r.share)}%</small>`:`<div class="op-row"><b>${e(r.name)}</b>${pill(`ربح ${r.share}%`)}</div>`}
        <small class="muted">حسابه اليوم</small><p class="op-big">${r.total===null||r.total===undefined?'بانتظار اكتمال المراجعة':m(r.total)}</p>
        ${partnerId?parts.map(([l,k])=>`<div class="op-row"><span>${l}</span><b>${r[k]===null||r[k]===undefined?'غير محسوب':m(r[k])}</b></div>`).join(''):`<div class="op-row"><button class="ghost small" data-statement="${e(r.id)}">تفاصيل الحساب</button>${bridge?`<button class="ghost small" data-move="${e(r.id)}">تسجيل حركة</button>`:''}</div>`}</div>`;}
    if(!partnerId&&bridge){
      body+='<button class="ghost" data-shares>تغيير نسب الربح باتفاق جديد</button>';
      for(const x of profit.exit_balances||[])body+=`<div class="op-card"><b>رصيد شريك خرج · ${e(rows.find(r=>r.id===x.partner_id)?.name||(state.partners||[]).find(r=>r.id===x.partner_id)?.name||'')}</b><p class="op-big">${m(Math.round((dec(x.entitlement)-dec(x.paid))*100)/100)}</p><button class="ghost small" data-exit-pay="${e(x.partner_id)}">تسجيل دفعة فعلية</button></div>`;
    }
    if(partnerId&&bridge)body+=`<button class="ghost" data-exit="${e(partnerId)}">مراجعة خروج الشريك</button>`;
    if(!partnerId){
      body+=`<div class="op-card"><b>حصة المحل من الأرباح</b><div class="op-row"><span>النسبة</span><b>${e(state.retained_rate??0)}%</b></div><div class="op-row"><span>السقف</span><b>${m(state.retained_cap??0)}</b></div><small class="muted">عندما يصل المتجمّع إلى السقف يتوقف الاقتطاع</small></div>`;
      if(!rows.length)body+='<p class="muted">أكمل الشركاء من قائمة تجهيز محلك.</p>';
    }
    frame(body,partnerId?'<button class="primary" data-backp>الرجوع للشركاء</button>':bridge?'<button class="primary" data-approve>مراجعة واعتماد حسابات الفترة</button>':'');
    on('[data-statement]',node=>{selectedPartner=node.dataset.statement;go('statement');});
    on('[data-backp]',()=>go('profits'));
    on('[data-approve]',()=>prepareFinance({},'approve'));
    on('[data-move]',node=>partnerMovement(node.dataset.move));
    on('[data-shares]',()=>shareAgreement(null));
    on('[data-exit]',node=>shareAgreement(node.dataset.exit));
    on('[data-exit-pay]',node=>exitPayment(node.dataset.exitPay));
  }
  const financeLabel=k=>({capital_increase:'زيادة رأس مال',partner_loan:'قرض من الشريك للمحل',profit_withdrawal:'سحب ربح معتمد',capital_return:'رد رأس مال',cash_borrowing:'مبلغ يأخذه الشريك كدين',loan_repayment:'رد قرض للشريك',debt_repayment:'تحصيل دين من الشريك',exit:'اعتماد خروج الشريك',exit_payment:'دفعة من رصيد الخروج',approve:'اعتماد حسابات الفترة'}[k]||'اتفاق نسب الربح');
  function prepareFinance(values,kind){run(()=>flow.command('prepare_finance',{...values,kind}),()=>{closeSheet();state=flow.snapshot();render();});}
  function partnerMovement(id){
    const kinds=['capital_increase','partner_loan','profit_withdrawal','capital_return','cash_borrowing','loan_repayment','cash_debt_repayment','loss_debt_repayment'];
    const label=k=>k==='cash_debt_repayment'?'تحصيل مبلغ أخذه كدين':k==='loss_debt_repayment'?'تحصيل دين خسارة':financeLabel(k);
    sheet('تسجيل حركة للشريك',`<label class="op-field">نوع الحركة<select name="kind">${kinds.map(k=>`<option value="${k}">${label(k)}</option>`).join('')}</select></label><label class="op-field">الحساب<select name="account">${options(accounts(),'')}</select></label>${field('amount','المبلغ','','₪')}`,
      [['مراجعة',d=>{let amount;try{amount=number(d.querySelector('[name=amount]').value,2,'1000000000000');}catch{return sheetError(d,'أدخل المبلغ وحدد الحساب');}
        let kind=d.querySelector('[name=kind]').value;const v={partner_id:id,account_id:d.querySelector('[name=account]').value,amount};
        if(kind.endsWith('_debt_repayment')){v.debt_kind=kind.startsWith('cash_')?'cash':'loss';kind='debt_repayment';}prepareFinance(v,kind);}],['رجوع',closeSheet]]);
  }
  function financeReview(preview){
    const plan=preview.plan||{},values=preview.values||{},kind=preview.kind,name=pid=>(state.partners||[]).find(p=>p.id===pid)?.name||(state.profit?.partners||[]).find(p=>p.id===pid)?.name||'';
    let body=`<h2>مراجعة الحسابات قبل التأكيد</h2><p class="muted small">${e(financeLabel(kind))}</p>`;
    if(kind==='approve'){body+=`<div class="op-card"><b>ملخص الفترة</b>${[['ربح العمليات غير المعتمد','gross_profit'],['المتاح للتوزيع','distribution_basis'],['تغير حصة المحل','retained_change'],['ربح محجوز يحتفظ بتخصيصه الأصلي','reserved_profit']].map(([l,k])=>`<div class="op-row"><span>${l}</span><b>${m(plan[k])}</b></div>`).join('')}</div>`
      +(plan.partners||[]).map(p=>`<div class="op-card"><b>${e(name(p.id))}</b><div class="op-row"><span>ربح معتمد</span><b>${m(p.prior_profit)}</b></div><div class="op-row"><span>رأس المال</span><b>${m(p.capital)}</b></div><div class="op-row"><span>دين خسارة</span><b>${m(p.loss_debt)}</b></div></div>`).join('');}
    else body+=`${(values.shares||[]).map(p=>`<p>${e(name(p.id))}: ${e(p.share)}%</p>`).join('')}${kind==='exit'?`<p class="op-warn">اعتماد الاستحقاق لا يسجّل دفعاً. يجب اعتماد كل العمليات أولاً وتطابق الحسابات.</p>${preview.exit_entitlement!==undefined?`<p class="op-big">استحقاق الخروج: ${m(preview.exit_entitlement)}</p>`:''}`:''}<div class="op-card">${values.amount!==undefined?`<div class="op-row"><span>المبلغ</span><b>${m(values.amount)}</b></div>`:''}${values.partner_id?`<div class="op-row"><span>الشريك</span><b>${e(name(values.partner_id))}</b></div>`:''}</div>`;
    frame(body,'<button class="primary" data-commit>تأكيد بعد المراجعة</button><button class="ghost" data-cancel>إلغاء المراجعة</button>');
    on('[data-commit]',()=>run(flow.commitFinance,()=>{say('تم تسجيل العملية مرة واحدة');reload('profits');}));
    on('[data-cancel]',()=>run(async()=>{await flow.cancel();return flow.load();},v=>{state=v;page='profits';render();}));
  }
  function accountsPage(){
    const s=state.profit?.summary;
    if(!s)return frame('<p class="muted">أرقام الحسابات تظهر بعد تجهيز محلك.</p>');
    frame(`<div class="op-card"><small class="muted">قيمة محلك اليوم</small><p class="op-big">${m(s.net_project_value)}</p><small class="muted">فلوس + بضاعة بسعر الشراء + ديون لك − ديون عليك</small>
      ${[['فلوس المحل','liquidity'],['البضاعة بسعر الشراء','inventory_cost'],['ديون لك على زبائن','customer_debt'],['ديون عليك لموردين','supplier_debt']].map(([l,k])=>`<div class="op-row"><span>${l}</span><b>${m(s[k])}</b></div>`).join('')}</div>
      <div class="op-card"><b>أين فلوسك</b>${(s.accounts||[]).map(a=>`<div class="op-row"><span>${e(a.name)}</span><b class="${dec(a.balance)===0?'muted':''}">${m(a.balance)}</b></div>`).join('')}</div>`);
  }
  function history(){
    const ops=state.operations||[],when=v=>{try{return new Date(v).toLocaleString('ar-PS-u-nu-latn',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Hebron'});}catch{return v||'';}};
    const label=v=>({paid:'مكتملة',credit:'دين',partially_returned:'مرتجع جزئي',returned:'مرتجعة'}[v]||'');
    frame(ops.map(o=>`<div class="op-card"><b>${o.kind==='sale'?'مبيعة':'فاتورة شراء'} · ${m(o.total)}</b><small class="muted">${e(when(o.occurred_at))}${label(o.status)?' · '+label(o.status):''}</small>${o.kind==='sale'&&o.status!=='returned'&&Number(state.return_bridge)===1?`<button class="ghost small" data-return="${e(o.id)}">تسجيل مرتجع</button>`:''}</div>`).join('')||'<p class="muted">لا توجد عمليات مسجّلة بعد</p>','<button class="primary" data-goto>الرجوع للكاشير</button>');
    on('[data-goto]',()=>go('cashier'));
    on('[data-return]',node=>saleReturn(node.dataset.return));
  }
  // ---------- operating actions after the start (Android OpeningCollectionFlow.execute) ----------
  function operating(action,capability,values,done){
    if(Number(state?.[capability])!==1)return showError('هذه العملية تحتاج تحديث السيرفر. لم تتغير البيانات.');
    run(async()=>{const fresh=await flow.load();state=fresh;if(fresh.pending)throw new Error('تحقق من نتيجة الطلب السابق أولاً');return flow.command(action,values);},
      async receipt=>{say('تم الحفظ');closeSheet();await done?.(receipt);});
  }
  const defaultAccount=()=>accounts().find(a=>a.type==='cash')||accounts()[0];
  function expense(){
    const d=sheet('مصروف جديد',`<div class="op-chips">${[['مصروفات','مصروف'],['يوميات','يوميات']].map(([v,l],i)=>`<button type="button" class="op-chip ${i===0?'on':''}" data-type="${v}">${l}</button>`).join('')}</div>
      ${field('amount','المبلغ','','₪')}${field('description','الوصف','','','placeholder="مثال: كهرباء، أجرة، مواصلات"')}<label class="op-field">دفعت من<select name="account">${options(accounts(),defaultAccount()?.id)}</select></label>`,
      [['حفظ المصروف',d=>{let amount;try{amount=number(d.querySelector('[name=amount]').value,2,'1000000000000');if(dec(amount)<=0)throw new Error();}catch{return sheetError(d,'اكتب مبلغ المصروف');}
        const category=d.querySelector('.op-chip.on').dataset.type,description=d.querySelector('[name=description]').value.trim()||(category==='يوميات'?'يوميات':'مصروف');
        operating('expense','expense_bridge',{category,description,account_id:d.querySelector('[name=account]').value,amount},()=>reload('cashier'));}],['رجوع',closeSheet]]);
    d.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{d.querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('on',x===b));});
  }
  function openDebts(kind){page=kind;run(async()=>{const [debts,fresh]=await Promise.all([api.rpc('get_sharikx2_debt_balances_v2',{p_project_id:project.id}),flow.load()]);state=fresh;return debts;},v=>{debtData=v;render();});}
  function debtsPage(kind){
    const customer=kind==='customers',rows=(debtData?.[kind]||[]),total=debtData?.[customer?'customer_debt':'supplier_debt'];
    const phone=v=>v&&!String(v).startsWith('manual-')?`<small class="muted" dir="ltr">${e(v)}</small>`:'';
    frame(`<div class="op-note"><small>${customer?'مجموع ديون الزبائن':'مجموع ما عليك للموردين'}</small><p class="op-big">${m(total??0)}</p></div>
      ${rows.map(r=>`<div class="op-card"><div class="op-row"><span><b>${e(r.name)}</b><br>${phone(r.phone)}</span><b>${m(r.calculated_debt)}</b></div>
        ${dec(r.calculated_debt)>0?`<button class="outline small" data-${customer?'collect':'pay'}="${e(r.id)}">${customer?'تحصيل دفعة':'دفعة للمورد'}</button>`:pill('لا يوجد دين','ok')}</div>`).join('')||`<p class="muted">${customer?'لا يوجد زبائن بعد':'لا يوجد موردين بعد'}</p>`}`,
      `<button class="outline" data-new>${customer?'+ إضافة زبون':'+ إضافة مورد'}</button>`);
    on('[data-new]',()=>newContact(customer?'customer':'supplier',()=>openDebts(kind)));
    on('[data-collect]',node=>collect(rows.find(r=>r.id===node.dataset.collect)));
    on('[data-pay]',node=>paySupplier(rows.find(r=>r.id===node.dataset.pay)));
  }
  function collect(row){
    sheet(`تحصيل من ${row.name}`,`<p class="muted">الدين الحالي: <b>${m(row.calculated_debt)}</b></p>${field('amount','المبلغ المستلم','','₪')}<label class="op-field">استلمته في<select name="account">${options(accounts(),defaultAccount()?.id)}</select></label>${field('note','ملاحظة (اختياري)','')}`,
      [['تسجيل الدفعة',d=>{let amount;try{amount=number(d.querySelector('[name=amount]').value,2,'1000000000000');if(dec(amount)<=0||dec(amount)>dec(row.calculated_debt))throw new Error();}catch{return sheetError(d,'اكتب مبلغاً لا يزيد عن الدين الحالي');}
        operating('collect_customer','collection_bridge',{customer_id:row.id,account_id:d.querySelector('[name=account]').value,amount,note:d.querySelector('[name=note]').value},()=>openDebts('customers'));}],['رجوع',closeSheet]]);
  }
  function paySupplier(row){
    sheet(`دفعة لـ ${row.name}`,`<p class="muted">عليك له: <b>${m(row.calculated_debt)}</b>. اكتب المبلغ المدفوع من كل حساب.</p>${accounts().map(a=>field(`src-${a.id}`,a.name,'','₪')).join('')}${field('note','ملاحظة (اختياري)','')}`,
      [['تسجيل الدفعة',d=>{const sources=[];
        try{for(const a of accounts()){const raw=d.querySelector(`[name="src-${CSS.escape(a.id)}"]`).value;if(!raw.trim())continue;const v=number(raw,2,'1000000000000');if(dec(v)>0)sources.push({account_id:a.id,amount:Number(v)});}}catch{return sheetError(d,'راجع المبالغ');}
        const sum=sum2(sources.map(x=>x.amount));if(!sources.length)return sheetError(d,'اكتب المبلغ المدفوع');if(sum>dec(row.calculated_debt))return sheetError(d,'المجموع أكبر من الدين الحالي');
        operating('supplier_payment','supplier_payment_bridge',{supplier_id:row.id,sources,note:d.querySelector('[name=note]').value},()=>openDebts('suppliers'));}],['رجوع',closeSheet]]);
  }
  function newContact(kind,created){
    const customer=kind==='customer';
    sheet(customer?'زبون جديد':'مورد جديد',`${field('name','الاسم','')}${field('phone','رقم الجوال','','','dir="ltr" inputmode="tel" placeholder="05xxxxxxxx"')}`,
      [['حفظ',d=>{const id=crypto.randomUUID(),value={id,name:d.querySelector('[name=name]').value,phone:d.querySelector('[name=phone]').value};
        run(()=>customer?api.createCustomer(project.id,value):api.createSupplier(project.id,value),async()=>{closeSheet();say('تم الحفظ');state=await flow.load();await created?.(id);if(page==='sale'||page==='purchase')render();});}],['رجوع',closeSheet]]);
  }
  function splitPayment(subtotal){
    const pay=flow.draft('payment'),old=new Map((pay.payments||[]).map(x=>[x.account_id,x.amount])),total=Math.round((subtotal-dec(pay.discount))*100)/100;
    sheet('تفاصيل الدفع',`<p class="muted">مجموع المبيعة ${m(total)}. اكتب المبلغ المدفوع من كل حساب. إذا بقي مبلغ، اختر الزبون لتسجيل الباقي عليه.</p>${accounts().map(a=>field(`src-${a.id}`,a.name,old.get(a.id)??'','₪')).join('')}
      <label class="op-field">الزبون (للباقي)<select name="customer">${options(customers(),pay.customer_id,'بدون — الدفع كامل')}</select></label>`,
      [['حفظ طريقة الدفع',d=>{const payments=[];
        try{for(const a of accounts()){const raw=d.querySelector(`[name="src-${CSS.escape(a.id)}"]`).value;if(!raw.trim())continue;const v=number(raw,2,'1000000000000');if(dec(v)>0)payments.push({account_id:a.id,amount:v});}}catch{return sheetError(d,'راجع المبالغ');}
        const paid=sum2(payments.map(x=>x.amount)),cust=d.querySelector('[name=customer]').value;
        if(paid>total)return sheetError(d,'المبالغ أكثر من مجموع المبيعة');if(paid<total&&!cust)return sheetError(d,'اختر الزبون لتسجيل الباقي عليه');
        flow.draft('payment',{...pay,payments,customer_id:cust,composed:true,as_debt:false});closeSheet();render();}],['رجوع',closeSheet]]);
  }
  function saleReturn(saleId){
    run(()=>api.sale(project.id,saleId),sale=>{
      if(!sale)return showError('تعذر تحميل المبيعة');
      const returned=new Map();for(const r of sale.returns||[])for(const x of r.items||[])returned.set(x.sale_item_id,(returned.get(x.sale_item_id)||0)+dec(x.quantity));
      const items=(sale.items||[]).map(x=>({...x,left:Math.round((dec(x.quantity)-(returned.get(x.id)||0))*1000)/1000})).filter(x=>x.left>0);
      const nameOf=x=>x.product_name||x.name||product(x.product_id)?.product?.name||'صنف';
      sheet(`مرتجع من المبيعة ${sale.sale_number??''}`,`${items.map(x=>`${field(`ret-${x.id}`,`${nameOf(x)} · المتاح للإرجاع ${x.left}`,'','#')}`).join('')||'<p class="muted">لا يوجد أصناف متاحة للإرجاع</p>'}
        <label class="op-field">ترجع الفلوس من<select name="account">${options(accounts(),sale.payment_account_id||defaultAccount()?.id)}</select></label>${field('reason','السبب (اختياري)','')}`,
        [['تسجيل المرتجع',d=>{const rows=[];
          try{for(const x of items){const raw=d.querySelector(`[name="ret-${CSS.escape(x.id)}"]`).value;if(!raw.trim())continue;const q=number(raw,3,'100000000000');if(dec(q)<=0)continue;if(dec(q)>x.left)throw new Error();rows.push({sale_item_id:x.id,quantity:q});}}
          catch{return sheetError(d,'الكمية أكثر من المتاح للإرجاع');}
          if(!rows.length)return sheetError(d,'اكتب كمية صنف واحد على الأقل');
          operating('sale_return','return_bridge',{sale_id:sale.id,items:rows,account_id:d.querySelector('[name=account]').value,reason:d.querySelector('[name=reason]').value},()=>reload('history'));}],['رجوع',closeSheet]]);
    });
  }
  function shareAgreement(exiting){
    const people=(state.profit?.partners||[]).filter(p=>p.id!==exiting);
    sheet(exiting?'نسب الباقين بعد خروج الشريك':'اتفاق نسب الربح',`<p class="muted">أدخل النسب المتفق عليها بنفسك. لا نغير رأس المال ولا أرباح العمليات السابقة.</p>${people.map(p=>field(`share-${p.id}`,p.name,'','%')).join('')}`,
      [['مراجعة',d=>{let shares;try{shares=people.map(p=>({id:p.id,share:number(d.querySelector(`[name="share-${CSS.escape(p.id)}"]`).value,4,'101')}));if(Math.abs(sum2(shares.map(x=>x.share))-100)>0.0001)throw new Error();}
        catch{return sheetError(d,'أكمل النسب لكل الشركاء الباقين، ومجموعها 100%');}
        const v={shares};if(exiting)v.partner_id=exiting;prepareFinance(v,exiting?'exit':'shares');}],['رجوع',closeSheet]]);
  }
  function exitPayment(partnerId){
    sheet('دفعة رصيد الخروج',`<p class="muted">تُسجّل دفعة فعلية فقط. الرصيد السالب يعني تحصيلاً من الشريك.</p><label class="op-field">الحساب<select name="account">${options(accounts(),defaultAccount()?.id)}</select></label>${field('amount','المبلغ','','₪')}`,
      [['مراجعة',d=>{let amount;try{amount=number(d.querySelector('[name=amount]').value,2,'1000000000000');}catch{return sheetError(d,'أدخل مبلغاً صحيحاً');}
        prepareFinance({partner_id:partnerId,account_id:d.querySelector('[name=account]').value,amount},'exit_payment');}],['رجوع',closeSheet]]);
  }
  function reportsPage(){
    frame('<div data-reports></div>');
    renderReports({api,project,container:app.querySelector('[data-reports]'),state:reportState,isCurrent:()=>alive()&&page==='reports',onAccounts:()=>reload('accounts'),onPlans:()=>say('الاشتراك متاح من تطبيق SharikX2')})
      .catch(error=>showError(friendly(error)));
  }

  function render(){
    if(!alive())return;
    if(page==='money')return money();
    if(page==='goods')return goods();
    if(!state)return frame('<p>تعذر تحميل بيانات المحل</p>','<button class="primary" data-retry>إعادة المحاولة</button>'),on('[data-retry]',()=>reload(page));
    if(state.pending)return pending();
    ({debts,partners:()=>partners(false),capital:()=>partners(true),retained,review,sale,purchase,profits:()=>profits(null),statement:()=>profits(selectedPartner),accounts:accountsPage,history,customers:()=>debtsPage('customers'),suppliers:()=>debtsPage('suppliers'),reports:reportsPage}[page]||cashier)();
  }
  app.innerHTML='<section class="op-app"><p class="op-lead">جارٍ تحميل بيانات المحل…</p></section>';
  run(flow.load,value=>{state=value;
    // A brand-new shop starts with money, as in the app (Figma 04 after creation).
    const money=state.sections?.money;if(!state.opening_locked&&money&&money.status==='not_started')openMoney('cashier');else render();});
  return ()=>{closed=true;closeSheet();loading(false);};
}
