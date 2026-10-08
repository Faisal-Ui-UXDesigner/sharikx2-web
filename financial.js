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
 const state=snapshot?.state&&typeof snapshot.state==='object'?snapshot.state:{};
 const current=Array.isArray(state.partners)?state.partners.filter(row=>row&&row.active!==false):[];
 const former=Array.isArray(state.partners)?state.partners.filter(row=>row?.active===false):[];
 const formerIds=new Set(former.filter(row=>row.id).map(row=>row.id));
 for(const row of Array.isArray(state.formerPartners)?state.formerPartners.filter(Boolean):[]){if(row.id&&formerIds.has(row.id))continue;former.push(row);if(row.id)formerIds.add(row.id);}
 const totalShare=current.reduce((sum,row)=>sum+Number(row.share||0),0);
 return {current,former,totalShare,projectShare:Math.max(0,100-totalShare),retentionShare:Math.max(0,100-totalShare),retentionCap:Number(state.reinvestmentCap??1000)};
}
