const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const amount=value=>{if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw Error('تعذر قراءة أرصدة المشروع');return Number(value);};

// Authoritative ProjectFinancialSnapshot values. Never derive a second net by
// adding customer debt or inventory to an already-computed server total.
export function homeFinancialModel(summary,projectId){
 if(!object(summary)||!Array.isArray(summary.accounts))throw Error('تعذر قراءة حسابات المشروع');
 const seen=new Set();
 const accounts=summary.accounts.map(row=>{
  if(!object(row)||typeof row.id!=='string'||!row.id.trim()||seen.has(row.id)||(row.project_id!==undefined&&row.project_id!==projectId))throw Error('بيانات حساب الدفع غير صالحة');
  seen.add(row.id);return Object.freeze({id:row.id,name:String(row.name||'حساب'),balance:amount(row.balance)});
 });
 return Object.freeze({liquidity:amount(summary.liquidity),inventoryCost:amount(summary.inventory_cost),customerDebt:amount(summary.customer_debt),supplierDebt:amount(summary.supplier_debt),netProjectValue:amount(summary.net_project_value),accounts:Object.freeze(accounts),canTransfer:accounts.length>=2});
}
