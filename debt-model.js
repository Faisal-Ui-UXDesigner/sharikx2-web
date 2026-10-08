export const DEBT_SETTLED_THRESHOLD=0.009;
const invalid=()=>new Error('تعذر قراءة بيانات الديون');
const amount=value=>{if(value==null||typeof value==='boolean'||(typeof value!=='number'&&typeof value!=='string')||String(value).trim()==='')throw invalid();const number=Number(value);if(!Number.isFinite(number))throw invalid();return number;};
export function normalizeDebtSnapshot(snapshot,kind){
 if(!['customers','suppliers'].includes(kind))throw invalid();
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw new Error('تعذر قراءة بيانات الديون');
 const rows=snapshot[kind];if(!Array.isArray(rows))throw new Error('تعذر قراءة بيانات الديون');
 const totalKey=kind==='customers'?'customer_debt':'supplier_debt';
 const seen=new Set();
 const normalized=rows.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row)||!String(row.id||'').trim()||seen.has(String(row.id)))throw invalid();seen.add(String(row.id));return {...row,calculated_debt:Math.max(0,amount(row.calculated_debt))};});
 if(kind==='suppliers')normalized.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
 return {total:Math.max(0,amount(snapshot[totalKey])),rows:normalized};
}
export function debtPartition(rows,archived=false){return (Array.isArray(rows)?rows:[]).filter(row=>(Number(row.calculated_debt)<=DEBT_SETTLED_THRESHOLD)===Boolean(archived));}
export function debtSearch(rows,query=''){const text=String(query||'').trim().toLocaleLowerCase('ar');return (Array.isArray(rows)?rows:[]).filter(row=>`${row.name||''} ${row.phone||''}`.toLocaleLowerCase('ar').includes(text));}
