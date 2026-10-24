import {escape} from './ui.js';
import {icon} from './icons.js';
import {subscriptionStatus} from './subscription-details.js';

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
 const phone=project.owner_phone?` <span>▪ جوال <bdi dir="ltr">${escape(project.owner_phone)}</bdi></span>`:'';
 return `<div class="workspace native-app" data-screen="${escape(screen)}"><header class="app-header"><div class="project-heading"><h1>${escape(project.name)}<span class="project-pencil" aria-hidden="true">${icon('edit',20)}</span></h1><small><bdi dir="ltr">#${escape(project.project_number||'')}</bdi>${phone}</small><div class="plan-line"><button data-plan class="plan-info">${escape(planLabel)} ${icon('info',21)}</button>${subscribe?'<button data-subscribe class="subscribe">اشترك الآن</button>':''}</div></div><div class="header-tools"><button data-menu aria-label="القائمة الجانبية">${icon('menu',23)}</button><button data-notifications aria-label="الإشعارات">${icon('bell',26)}</button></div></header><section id="content"></section><nav aria-label="التنقل الرئيسي">${MAIN_PAGES.map(([id,title,symbol])=>`<button data-page="${id}" class="${screen===id?'selected':''} ${id==='cashier'?'cashier-nav':''}" aria-label="${title}" aria-current="${screen===id?'page':'false'}"><span class="nav-icon">${icon(symbol,id==='cashier'?24:23)}</span><span class="nav-label">${title}</span></button>`).join('')}</nav></div>`;
}
