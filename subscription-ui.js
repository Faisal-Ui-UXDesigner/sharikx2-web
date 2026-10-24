import {escape} from './ui.js';
import {SUBSCRIPTION_FEATURES,subscriptionStatus,subscriptionLimits,subscriptionPrice} from './subscription-details.js';
import {openSubscriptionRequests} from './subscription-requests-ui.js';

export function openSubscriptionStatus({container,project,mode,isCurrent=()=>true,onPlans}){
 if(!isCurrent()||!container?.isConnected||document.querySelector('.subscription-status-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='subscription-status-dialog';
 const current=()=>isCurrent()&&container.isConnected&&dialog.isConnected;
 let ended=false;const finish=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())finish();});
 let data;try{data=subscriptionStatus(project);}catch(error){dialog.innerHTML=`<h2>تفاصيل الخطة الحالية</h2><p role="alert">${escape(error.message)}</p><button data-close>إغلاق</button>`;}
 if(data){
  const date=data.showExpiry?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hebron',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(data.expires)):'';
  dialog.innerHTML=`<h2>تفاصيل الخطة الحالية</h2><div class="panel subscription-status ${data.active&&!data.nearExpiry?'success':'warning'}"><b>${escape(data.title)}</b><span>${escape(data.side)}</span></div><h3>${data.active?'مزايا اشتراكك':'حدود الخطة المجانية'}</h3>${subscriptionLimits(data.active).map(([title,value])=>`<div class="subscription-limit"><span>${escape(title)}</span><b>${escape(value)}</b></div>`).join('')}<p class="muted">${data.showExpiry?'ينتهي الاشتراك في '+escape(date):!data.active?'بياناتك محفوظة دائمًا. اشترك لفتح المزايا الكاملة.':''}</p>${mode==='viewer'?'<p class="muted">المشروع متاح للمشاهدة فقط</p>':''}${mode==='owner'&&data.action&&onPlans?`<button class="primary" data-status-plans>${escape(data.action)}</button>`:''}<button data-close class="outline">إغلاق</button>`;
 }
 container.append(dialog);dialog.showModal();observer.observe(document.documentElement,{childList:true,subtree:true});
 dialog.querySelector('[data-close]').onclick=finish;dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});dialog.addEventListener('close',finish);
 dialog.querySelector('[data-status-plans]')?.addEventListener('click',()=>{const allowed=current()&&mode==='owner';finish();if(allowed)onPlans();});
 return dialog;
}

// Read-only payment instructions. Upload/submission is a separate, unported flow;
// never present a payment or activation success from viewing/copying these fields.
export async function renderSubscriptionPlans({api,container,projectId,mode,isCurrent=()=>true,onBack}){
 const section=document.createElement('section');section.className='plans-screen subscription-screen';container.replaceChildren(section);
 const current=()=>isCurrent()&&section.isConnected&&container.contains(section);
 section.innerHTML=`<button data-plans-back class="outline">العودة للتطبيق</button><h2>أهلاً وسهلاً بك</h2><p class="muted">اختر الباقة المناسبة لاحتياجاتك<br>واستمتع باستخدام كامل المزايا مع النسخة المدفوعة</p><div class="plans-table" role="table" aria-label="مقارنة الخطط"><div class="plan-head" role="row"><b role="columnheader">وجه المقارنة</b><b role="columnheader">المجاني</b><b role="columnheader">المدفوع ♛</b></div>${SUBSCRIPTION_FEATURES.map(row=>`<div class="plan-row" role="row">${row.map(value=>`<span role="cell">${escape(value)}</span>`).join('')}</div>`).join('')}</div><div class="panel plan-price"><small>سعر الاشتراك الشهري</small><strong data-subscription-price>جارٍ التحميل…</strong><p class="muted">جميع المزايا الكاملة بدون قيود</p></div><p role="alert" data-settings-error></p><button data-settings-retry class="outline" hidden>إعادة تحميل بيانات الدفع</button><div data-payment-instructions></div>`;
 section.querySelector('[data-plans-back]').onclick=()=>{if(current())onBack?.();};
 if(mode==='owner'&&projectId){const requests=document.createElement('button');requests.type='button';requests.className='outline';requests.dataset.openSubscriptionRequests='';requests.textContent='حالة طلبات الاشتراك';section.querySelector('[data-payment-instructions]').before(requests);requests.onclick=()=>{if(current())openSubscriptionRequests({api,projectId,mode,owner:section,isCurrent:current});};}
 const error=section.querySelector('[data-settings-error]'),retry=section.querySelector('[data-settings-retry]'),price=section.querySelector('[data-subscription-price]'),host=section.querySelector('[data-payment-instructions]');
 let loading=false;
 const load=async()=>{
  if(!current()||loading)return;loading=true;retry.disabled=true;retry.hidden=true;error.textContent='';price.textContent='جارٍ التحميل…';host.replaceChildren();
  try{
   const settings=await api.subscriptionPaymentSettings();if(!current())return;
   price.textContent=subscriptionPrice(settings);
   if(mode!=='owner'){host.innerHTML='<p class="muted">معلومات الدفع وإرسال الطلب مخصصة لمالك المشروع.</p>';return;}
   const cards=[];
   if(settings.bank_name||settings.bank_account_number||settings.bank_iban)cards.push({name:settings.bank_name||'الحساب البنكي',fields:[['رقم الحساب',settings.bank_account_number],['IBAN',settings.bank_iban],['رقم الجوال',settings.bank_phone]]});
   if(settings.wallet_name||settings.wallet_phone)cards.push({name:settings.wallet_name||'المحفظة الإلكترونية',fields:[['رقم جوال المحفظة',settings.wallet_phone]]});
   const details=document.createElement('details');details.className='subscription-payment-accounts';details.innerHTML='<summary>عرض معلومات حسابات الدفع</summary><h3>ادفع للحساب التالي</h3>';host.append(details);
   for(const card of cards){
    const article=document.createElement('article');article.className='panel';article.innerHTML=`<h3>${escape(card.name)}</h3>`;details.append(article);
    for(const [title,value] of card.fields.filter(([,value])=>value)){
     const row=document.createElement('div');row.className='subscription-payment-detail';row.innerHTML=`<span>${escape(title)}</span><div><bdi dir="ltr">${escape(value)}</bdi><button type="button" class="outline">نسخ</button></div>`;article.append(row);
     const button=row.querySelector('button');button.onclick=async()=>{
      if(!current()||button.disabled)return;button.disabled=true;
      try{if(!navigator.clipboard?.writeText)throw Error('النسخ غير متاح؛ حدد الرقم الظاهر وانسخه يدويًا');await navigator.clipboard.writeText(value);if(current())notice.textContent='تم نسخ الرقم';}
      catch{if(current())notice.textContent='تعذر النسخ؛ حدد الرقم الظاهر وانسخه يدويًا';}
      finally{if(current())button.disabled=false;}
     };
    }
   }
   if(!cards.length)details.insertAdjacentHTML('beforeend','<p class="muted">لا توجد حسابات دفع منشورة حاليًا.</p>');
   const notice=document.createElement('p');notice.setAttribute('role','status');details.append(notice);
   const pending=document.createElement('p');pending.className='muted';pending.textContent='إرسال إثبات الدفع من الويب لم يُنقل بعد. استخدم تطبيق Android لإرسال الطلب؛ عرض البيانات أو نسخها لا يرسل طلبًا ولا يفعّل الاشتراك.';details.append(pending);
  }catch(value){if(current()){price.textContent='غير متوفر';error.textContent=value.message||'تعذر تحميل بيانات الدفع';retry.hidden=false;}}
  finally{loading=false;if(current())retry.disabled=false;}
 };
 retry.onclick=load;await load();return section;
}
