const MOVEMENT_LABELS=Object.freeze({
 sale:'مبيعة',purchase:'شراء بضاعة',expense:'مصروف',
 customer_debt_payment:'تحصيل دين زبون',supplier_payment:'دفعة مورد',
 sale_refund:'مرتجع مبيعة',account_transfer:'تحويل داخلي',capital:'رأس مال',withdrawal:'سحب'
});

export function palestineDate(value=Date.now()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hebron',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
export function financialPeriod(mode='month',today=palestineDate()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(today))throw new Error('تاريخ الفترة غير صحيح');
 if(mode==='today')return {from:today,to:today};
 if(mode==='all')return {from:null,to:null};
 return {from:`${today.slice(0,8)}01`,to:today};
}
export function movementLabel(type){return MOVEMENT_LABELS[type]||'حركة مالية';}
export function normalizePartnerSnapshot(snapshot){
 if(snapshot?.state!==undefined&&snapshot.state!==null&&(!snapshot.state||typeof snapshot.state!=='object'||Array.isArray(snapshot.state)))throw new Error('بيانات المشروع غير صالحة');
 const state=snapshot?.state&&typeof snapshot.state==='object'?snapshot.state:{};
 if((state.partners!==undefined&&!Array.isArray(state.partners))||(state.formerPartners!==undefined&&!Array.isArray(state.formerPartners)))throw new Error('بيانات الشركاء غير صالحة');
 const amount=(value,fallback=0,signed=false)=>{if(value===undefined)return fallback;if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||(!signed&&Number(value)<0))throw new Error('بيانات مبالغ الشركاء غير صالحة');return Number(value);};
 const currentIds=new Set();
 const current=Array.isArray(state.partners)?state.partners.filter(row=>row?.active!==false).map(row=>{if(!row||typeof row.id!=='string'||!row.id.trim()||currentIds.has(row.id)||typeof row.share!=='number'||!Number.isFinite(row.share)||row.share<0||row.share>100)throw new Error('بيانات نسب الشركاء غير صالحة');currentIds.add(row.id);return {...row,capital:amount(row.capital)};}):[];
 const archive=row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('بيانات الشركاء السابقين غير صالحة');return {...row,capital:amount(row.capital),settlementCapital:amount(row.settlementCapital,row.capital===undefined?0:amount(row.capital)),settlementBalance:amount(row.settlementBalance,0,true)};};
 const former=Array.isArray(state.partners)?state.partners.filter(row=>row?.active===false).map(archive):[];
 const formerIds=new Set(former.filter(row=>row.id).map(row=>row.id));
 for(const row of Array.isArray(state.formerPartners)?state.formerPartners.filter(Boolean):[]){if(row.id&&formerIds.has(row.id))continue;former.push(archive(row));if(row.id)formerIds.add(row.id);}
 const totalShare=current.reduce((sum,row)=>sum+Number(row.share||0),0);
 if(totalShare>100.0001)throw new Error('مجموع نسب الشركاء يتجاوز 100%');
 return {current,former,totalShare,projectShare:Math.max(0,100-totalShare),retentionShare:Math.max(0,100-totalShare),retentionCap:amount(state.reinvestmentCap??1000,1000)};
}
