export const PAGE_SIZE=20;

export function requirePage(page){
 if(!Array.isArray(page)||page.length>PAGE_SIZE||page.some(row=>!row||typeof row!=='object'||Array.isArray(row))){
  throw new Error('تعذر قراءة السجلات');
 }
 return page;
}

// Never return partial financial data. A repeated ID indicates a shifted or
// repeated page and requires a fresh load, not silent deduplication.
export async function collectPages(loadPage,{assertCurrent=()=>{}}={}){
 const result=[],identities=new Set();
 for(let offset=0;;offset+=PAGE_SIZE){
  assertCurrent();
  const page=requirePage(await loadPage(offset));
  assertCurrent();
  for(const row of page){
   if(row.id!=null){
    const id=String(row.id);
    if(identities.has(id))throw new Error('تغير ترتيب السجلات أثناء التحميل؛ أعد تحميل البيانات');
    identities.add(id);
   }
  }
  result.push(...page);
  if(page.length<PAGE_SIZE)return result;
 }
}
