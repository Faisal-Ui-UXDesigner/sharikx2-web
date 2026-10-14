import {FAQ_ENTRIES,FAQ_WEB_NOTICE,createFaqState} from './faq.js';
export function renderFaq({container,isCurrent=()=>true,onBack}){
 if(!isCurrent())return;
 const page=document.createElement('section');page.className='faq-screen';
 const header=document.createElement('div');header.className='row';const back=document.createElement('button');back.type='button';back.dataset.faqBack='';back.className='outline';back.textContent='رجوع إلى الإعدادات';const title=document.createElement('h2');title.textContent='الأسئلة الشائعة';header.append(title,back);page.append(header);
 const notice=document.createElement('p');notice.className='panel muted small';notice.dataset.faqNotice='';notice.textContent=FAQ_WEB_NOTICE;page.append(notice);
 const state=createFaqState();let premiumHeading=false;
 for(const entry of FAQ_ENTRIES){
  if(entry.premium&&!premiumHeading){const heading=document.createElement('h3');heading.className='faq-premium-heading';heading.textContent='مزايا الخطة المدفوعة';page.append(heading);premiumHeading=true;}
  const card=document.createElement('article');card.className='panel faq-card';const button=document.createElement('button');button.type='button';button.dataset.faqQuestion=entry.id;button.className='faq-question';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',`faq-answer-${entry.id}`);
  if(entry.premium){const badge=document.createElement('span');badge.className='badge faq-premium-badge';badge.textContent='الخطة المدفوعة';button.append(badge);}
  const text=document.createElement('span');text.className='faq-question-text';text.textContent=entry.question;const arrow=document.createElement('span');arrow.dataset.faqArrow='';arrow.setAttribute('aria-hidden','true');arrow.textContent='⌄';button.append(text,arrow);
  const answer=document.createElement('div');answer.id=`faq-answer-${entry.id}`;answer.className='faq-answer muted';answer.hidden=true;answer.textContent=entry.answer;card.append(button,answer);page.append(card);
 }
 const footer=document.createElement('section');footer.className='panel faq-help';const help=document.createElement('p');help.textContent='لم تجد إجابة لسؤالك؟ تواصل معنا من خلال الدعم الفني وسنساعدك في أقرب وقت.';const support=document.createElement('button');support.type='button';support.className='outline';support.textContent='التواصل مع الدعم الفني';support.disabled=true;support.dataset.faqSupport='';const limitation=document.createElement('p');limitation.className='muted small';limitation.textContent='إرسال طلب دعم من نسخة الويب غير متاح في هذه المرحلة. استخدم قسم الدعم في تطبيق الأندرويد.';footer.append(help,support,limitation);page.append(footer);
 const current=()=>page.isConnected&&isCurrent();back.onclick=()=>{if(current())onBack?.();};
 page.onclick=event=>{const button=event.target.closest('[data-faq-question]');if(!button||!page.contains(button)||!current())return;const expanded=state.toggle(button.dataset.faqQuestion);button.setAttribute('aria-expanded',String(expanded));button.querySelector('[data-faq-arrow]').textContent=expanded?'⌃':'⌄';button.nextElementSibling.hidden=!expanded;};
 container.replaceChildren(page);return page;
}
