import {escape} from './ui.js';

// Android offers the first four accounts in their existing order. A saved draft
// may refer to a later account: keep that choice visible, never silently replace it.
export function salePaymentAccounts(accounts,selectedId=accounts?.[0]?.id??null){
 if(!Array.isArray(accounts))throw new Error('تعذر قراءة حسابات الاستلام');
 const ids=new Set(),rows=accounts.map(account=>{
  if(typeof account?.id!=='string'||!account.id.trim()||ids.has(account.id))throw new Error('تعذر قراءة حسابات الاستلام');
  ids.add(account.id);return Object.freeze({id:account.id,name:String(account.name??'')});
 });
 const visible=rows.slice(0,4),selected=rows.find(row=>row.id===selectedId);
 if(selected&&!visible.includes(selected))visible.push(selected);
 return Object.freeze(visible.map(row=>Object.freeze({...row,selected:row===selected})));
}

export function salePaymentAccountsMarkup(accounts,selectedId){
 const cards=salePaymentAccounts(accounts,selectedId);
 return cards.map(account=>`<label class="choice sale-payment-account"><input type="radio" name="account" value="${escape(account.id)}" required ${account.selected?'checked':''}><span>${escape(account.name)}</span></label>`).join('')||'<p class="muted small sale-no-accounts">لا توجد حسابات لاستلام المبلغ. يمكن تسجيل المبيعة كدين بعد اختيار المدين.</p>';
}

export function bindSalePaymentAccounts(container,accounts){
 // Detach from the summary response: restored choices must not depend on later mutations.
 const source=accounts.map(account=>({id:account.id,name:account.name}));
 let debt=false;
 const sync=()=>{
  container.setAttribute('aria-disabled',String(debt));
  for(const input of container.querySelectorAll('[name=account]')){input.disabled=debt;input.required=!debt;}
 };
 sync();
 return Object.freeze({
  setDebt:value=>{debt=!!value;sync();},
  select:(id=source[0]?.id??null)=>{container.innerHTML=salePaymentAccountsMarkup(source,id);sync();}
 });
}
