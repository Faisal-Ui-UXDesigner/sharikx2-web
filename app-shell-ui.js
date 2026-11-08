import {escape} from './ui.js';
import {icon} from './icons.js';
import {subscriptionStatus} from './subscription-details.js';
import {pageTitle,subscribeLabel} from './primary-page-ui.js';

export const MAIN_PAGES=Object.freeze([
 ['accounts','الحسابات','accounts'],['products','البضاعة','inventory'],
 ['cashier','الكاشير','cashier'],['partners','الشركاء','partners'],['reports','التقارير','reports']
].map(row=>Object.freeze(row)));

// Shared application chrome only. No reads, financial state or event handlers.
export function appShellMarkup({project,mode,screen}){
 // A persisted active status alone is not evidence of an unexpired plan.
 let plan=null;try{plan=subscriptionStatus(project);}catch{}
 const planLabel=mode==='viewer'?'مشاهدة فقط':!plan?'تعذر التحقق من الخطة':plan.active?'حساب مفعل':'خطة مجانية';
 const subscribe=mode==='owner'&&plan&&!plan.active;
 const heading=screen==='cashier'
  ?`<header class="app-header cashier-heading"><div class="project-heading"><h1>${escape(project.name)}</h1>${project.owner_phone?`<small dir="ltr">${escape(project.owner_phone)}</small>`:''}</div><div class="header-tools"><button data-notifications aria-label="الإشعارات">${icon('bell',24)}</button><button data-menu aria-label="القائمة الجانبية">${icon('menu',22)}</button></div><div class="plan-line"><button data-plan class="plan-info">${escape(planLabel)}</button>${subscribe?`<button data-subscribe class="subscription-cta">${subscribeLabel('اشترك الآن')}</button>`:''}</div></header>`
  :`<header class="app-header primary-heading">${pageTitle(({products:'البضاعة الحالية',settings:'الإعدادات',faq:'الأسئلة الشائعة',plans:'الاشتراك'})[screen]||MAIN_PAGES.find(([id])=>id===screen)?.[1]||'') }<div class="primary-heading-actions" data-heading-actions></div></header>`;
 return `<div class="workspace native-app" data-screen="${escape(screen)}">${heading}<section id="content"></section><nav aria-label="التنقل الرئيسي">${MAIN_PAGES.map(([id,title,symbol])=>`<button data-page="${id}" class="${screen===id?'selected':''} ${id==='cashier'?'cashier-nav':''}" aria-label="${title}" aria-current="${screen===id?'page':'false'}"><span class="nav-icon">${icon(symbol,id==='cashier'?24:23)}</span><span class="nav-label">${title}</span></button>`).join('')}</nav></div>`;
}
