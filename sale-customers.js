import {createCustomerCatalog,loadCustomerCatalog} from './customer-catalog.js';
import {openCustomer} from './customer.js';
export function bindSaleCustomers({api,projectId,container,select,mode,storage,isCurrent,canEdit,onEditing,onError}){
 let catalog=createCustomerCatalog([],projectId),loading=false,creating=false;
 const search=document.createElement('label');search.textContent='بحث في الزبائن بالاسم أو الجوال';const input=document.createElement('input');input.type='search';input.dataset.customerSearch='';search.append(input);select.closest('label').before(search);
 const status=container.querySelector('[data-customer-status]'),load=container.querySelector('[data-customers-more]'),add=document.createElement('button');add.type='button';add.className='outline';add.dataset.addSaleCustomer='';add.textContent='إضافة زبون';container.append(add);
 const current=()=>container.isConnected&&isCurrent();
 const editable=()=>current()&&canEdit()&&!creating;
 const draw=()=>{
  const selected=select.value,visible=catalog.search(input.value),rows=[...visible];
  if(selected&&!rows.some(row=>row.id===selected)&&catalog.get(selected))rows.unshift(catalog.get(selected));
  select.replaceChildren(new Option('زبون غير محدد',''),...rows.map(row=>new Option(`${row.name} — ${row.phone||'بدون رقم'}`,row.id)));
  select.value=catalog.get(selected)?selected:'';
  status.textContent=input.value.trim()?`نتائج البحث: ${visible.length} — يبقى الزبون المختار محفوظًا`:`عدد الزبائن المحملين: ${catalog.customers.length}`;
 };
 const register=customer=>{const rows=catalog.customers.filter(row=>row.id!==customer.id);catalog=createCustomerCatalog([...rows,customer],projectId);draw();};
 input.oninput=()=>{if(editable())draw();};
 load.textContent='تحميل جميع الزبائن';
 load.onclick=async()=>{
  if(loading||!editable())return;loading=true;load.disabled=true;load.textContent='جارٍ تحميل جميع الزبائن…';onError(null);
  try{const next=await loadCustomerCatalog(api,projectId,editable);if(!editable())return;const rows=new Map(catalog.customers.map(row=>[row.id,row]));next.customers.forEach(row=>rows.set(row.id,row));catalog=createCustomerCatalog([...rows.values()],projectId);draw();load.hidden=true;}
  catch(e){if(editable())onError(e);}
  finally{loading=false;load.disabled=false;load.textContent='تحميل جميع الزبائن';}
 };
 add.onclick=()=>{
  if(!editable()||document.querySelector('dialog.customer-create'))return;
  creating=true;onEditing(true);
  const finish=()=>{creating=false;onEditing(false);};
  try{const child=openCustomer({api,projectId,mode,storage,isCurrent:()=>current()&&canEdit(),onClose:finish,onSaved:customer=>{if(!editable())return;register(customer);select.value=customer.id;status.textContent='تم اختيار الزبون المضاف';}});if(!child)finish();}
  catch(e){finish();if(current())onError(e);}
 };
 return Object.freeze({register,get:id=>catalog.get(id)});
}
