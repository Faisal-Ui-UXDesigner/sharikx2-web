export function roundPartnerShares(raw,targetTotal){
 if(!Array.isArray(raw)||!Number.isFinite(targetTotal)||targetTotal<0||targetTotal>100||raw.some(value=>!Number.isFinite(value)||value<0||value>100)||raw.reduce((sum,value)=>sum+value,0)>100.0001)throw new Error('توزيع النسب غير صالح');
 if(!raw.length)return [];
 const rounded=raw.map(value=>Math.floor(Math.max(0,value)*10)),fractions=raw.map(value=>Math.max(0,value)*10-Math.floor(Math.max(0,value)*10));
 let remaining=Math.round(targetTotal*10)-rounded.reduce((sum,value)=>sum+value,0);
 while(remaining>0){let index=0;for(let i=1;i<fractions.length;i++)if(fractions[i]>fractions[index])index=i;rounded[index]++;fractions[index]=-1;remaining--;}
 while(remaining<0){let index=-1;for(let i=0;i<rounded.length;i++)if(rounded[i]>0&&(index<0||rounded[i]>rounded[index]))index=i;if(index<0)break;rounded[index]--;remaining++;}
 return rounded.map(value=>value/10);
}
export function activePartnerShares(partners){
 if(!Array.isArray(partners))throw new Error('بيانات الشركاء غير متاحة');
 const active=partners.filter(row=>row?.active!==false),ids=new Set();
 if(!active.length)throw new Error('لا يوجد شركاء حاليون');
 for(const row of active){if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.share!=='number'||!Number.isFinite(row.share)||row.share<0||row.share>100)throw new Error('بيانات نسب الشركاء غير صالحة');ids.add(row.id);}
 const total=active.reduce((sum,row)=>sum+row.share,0);if(total>100.0001)throw new Error('مجموع نسب الشركاء يتجاوز 100%');
 return {active,ids,total};
}
export function rebalancePartnerShares(partners,partnerId,value){
 const {active,ids,total}=activePartnerShares(partners);
 const targetTotal=(1000-Math.round(Math.max(0,100-total)*10))/10,targetShare=Math.round(Number(value)*10)/10;
 if(!Number.isFinite(targetShare)||targetShare<0||targetShare>targetTotal+.0001)throw new Error(`نسبة الشريك يجب أن تكون بين 0 و${targetTotal}`);
 if(!ids.has(partnerId))throw new Error('الشريك غير موجود');
 const others=active.filter(row=>row.id!==partnerId),remaining=Math.max(0,targetTotal-targetShare),otherTotal=others.reduce((sum,row)=>sum+row.share,0);
 if(!others.length&&remaining>.01)throw new Error(`الشريك الوحيد يجب أن تكون نسبته ${targetTotal}`);
 let assigned=0,count=0;
 const raw=active.map(row=>{if(row.id===partnerId)return targetShare;count++;const share=count===others.length?remaining-assigned:otherTotal>0?remaining*row.share/otherTotal:remaining/others.length;assigned+=Math.max(0,share);return Math.max(0,share);});
 const rounded=roundPartnerShares(raw,targetTotal),byId=new Map(active.map((row,index)=>[row.id,rounded[index]]));
 return partners.map(row=>row?.active===false?{...row}:{...row,share:byId.get(row.id)});
}
export function partnerSaveRevision(snapshot){
 if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0)throw new Error('إصدار بيانات الشركاء غير صالح؛ أعد التحميل');return snapshot.revision;
}
export function partnerSaveResult(result,revision){if(!Number.isSafeInteger(result?.revision)||result.revision!==revision+1)throw new Error('تعذر تأكيد حفظ بيانات الشركاء');return result;}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
export function partnerSaveMatches(snapshot,state,revision){return snapshot?.revision===revision+1&&JSON.stringify(canonical(snapshot.state))===JSON.stringify(canonical(state));}
