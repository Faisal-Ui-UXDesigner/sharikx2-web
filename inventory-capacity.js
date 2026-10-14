import {hasActiveSubscription} from './subscription.js';
export const FREE_INVENTORY_LIMIT=25;
export function inventoryCreationCapacity({count,project=null,projectId,now=Date.now()}){
 if(!Number.isSafeInteger(count)||count<0)throw new Error('تعذر التحقق من عدد الأصناف؛ أعد تحميل البضاعة');
 if(!Number.isFinite(now))throw new Error('وقت التحقق غير صالح');
 if(project&&project.id!==projectId)throw new Error('تغيّر المشروع أو تعذر التحقق من الاشتراك');
 const expires=project?.subscription_expires_at;
 if(project?.subscription_status==='active'&&expires!==undefined&&expires!==null&&expires!==''&&
  !(typeof expires==='number'?Number.isFinite(expires):typeof expires==='string'&&Number.isFinite(Date.parse(expires))))throw new Error('تاريخ الاشتراك غير صالح؛ أعد تحميل المشروع');
 const premium=hasActiveSubscription(project,now);
 return Object.freeze({count,limit:FREE_INVENTORY_LIMIT,premium,allowed:premium||count<FREE_INVENTORY_LIMIT,title:'أضف أصنافاً أكثر',message:'تسمح الخطة المجانية بـ 25 صنفاً. اشترك شهرياً لإضافة أصناف دون حد.'});
}
