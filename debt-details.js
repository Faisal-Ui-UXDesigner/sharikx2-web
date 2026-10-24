export function debtMovementRows(kind,events=[],payments=[]){
 const eventLabel=kind==='customers'?'مبيعة بقيمة':'فاتورة شراء بقيمة';
 const rows=[...(Array.isArray(events)?events:[]).map(row=>({date:row?.created_at||row?.occurred_at,label:`${eventLabel} ${Number(row?.total)||0}`,status:row?.status||''})),...(Array.isArray(payments)?payments:[]).map(row=>({date:row?.created_at||row?.paid_at,label:`دفعة بقيمة ${Number(row?.amount)||0}`,status:row?.status||''}))];
 return rows.filter(row=>row.date||row.label).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
}

// Presentation only: invoice totals and payments are never re-summed into debt.
export function customerDebtTimeline(sales=[],payments=[]){
 if(!Array.isArray(sales)||!Array.isArray(payments))throw new Error('تعذر قراءة سجل الزبون');
 const number=value=>Number.isFinite(Number(value))?Number(value):0;
 const rows=sales.filter(row=>row&&typeof row==='object').map(row=>({
  date:row.created_at,label:`مبيعة #${row.sale_number??'—'} • ${number(row.total)}`,status:row.status||'',note:'',
  items:(Array.isArray(row.items)?row.items:[]).filter(Boolean).map(item=>({name:String(item.product_name||'صنف'),quantity:number(item.quantity??item.quantity_pieces),total:number(item.line_total)}))
 }));
 for(const row of payments.filter(row=>row&&typeof row==='object'))rows.push({date:row.created_at||row.paid_at,label:`تسديد دفعة ${number(row.amount)}`,status:'',note:String(row.note||'').trim(),items:[]});
 return rows.sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
}
