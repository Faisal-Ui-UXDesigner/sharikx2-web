import {escape} from './ui.js';
import {openBarcodeScanner,normalizeBarcode} from './barcode-scanner.js';
export function productPayload(projectId,values,{id=null}={}){
 const name=String(values.name||'').trim(),barcode=String(values.barcode||'').trim(),category=String(values.category||'').trim(),unit=String(values.unit||'').trim();
 const pieces=Number(values.piecesPerUnit),sale=Number(values.salePrice),low=Number(values.lowStock||0);
 if(!name)throw new Error('أدخل اسم الصنف');
 if(!barcode)throw new Error('أدخل باركود الصنف');
 if(!category)throw new Error('أدخل تصنيف الصنف');
 if(!unit)throw new Error('أدخل وحدة الصنف');
 if(!Number.isInteger(pieces)||pieces<1)throw new Error('عدد القطع داخل الوحدة غير صحيح');
 if(!Number.isFinite(sale)||sale<=0)throw new Error('أدخل سعر البيع المتوقع');
 if(!Number.isFinite(low)||low<0)throw new Error('حد التنبيه غير صحيح');
 const payload={name,barcode,category,base_unit:'قطعة',purchase_unit:unit,pieces_per_purchase_unit:pieces,default_sale_price:sale/pieces,low_stock_level:low*pieces,notes:String(values.notes||'').trim()};
 if(!id)payload.project_id=projectId;
 return payload;
}
export function assertUniqueBarcode(rows,barcode,currentId=''){
 const normalized=String(barcode||'').trim();
 if(rows.some(row=>String(row.barcode||'').trim()===normalized&&String(row.id)!==String(currentId)))throw new Error('هذا الباركود مسجل لصنف آخر');
}
export function assertProductArchiveAllowed(mode,product){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 const pieces=Number(product?.pieces);
 if(!Number.isFinite(pieces)||pieces<0)throw new Error('تعذر التحقق من كمية المخزون');
 if(pieces>0)throw new Error('لا يمكن حذف صنف له كمية في المخزون؛ يجب تسوية الكمية أولاً');
}

export function productEditorValues(product){
 if(!product)return {unit:'قطعة',piecesPerUnit:1};
 return {
  name:product.name,barcode:product.barcode,category:product.category,
  unit:product.displayUnit,piecesPerUnit:product.piecesPerUnit,
  salePrice:Number(product.salePrice)*Number(product.piecesPerUnit||1),
  lowStock:Number(product.lowStockQuantity||0),notes:product.notes
 };
}

export function openProductEditor({api,projectId,mode,product=null,rows=[],onSaved,isCurrent=()=>true,categoryOptions=[],categoryLabels={}}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 const d=document.createElement('dialog');d.className='inventory-editor';
 const categoryMarkup=categoryOptions.length?'<select name="category" required><option value="" disabled>اختر التصنيف</option>'+categoryOptions.map(value=>`<option value="${escape(value)}">${escape(categoryLabels[value]||value)}</option>`).join('')+'</select>':'<input name="category" required maxlength="100">';
 d.innerHTML='<h2>'+(product?'تعديل الصنف':'إضافة صنف')+'</h2><form><fieldset><label>اسم الصنف<input name="name" required maxlength="150"></label><label>الباركود<div class="input-pair"><input name="barcode" required maxlength="100" inputmode="numeric"><button type="button" data-camera-scan class="outline">مسح</button></div></label><label>التصنيف'+categoryMarkup+'</label><label>وحدة الشراء<input name="unit" required maxlength="40"></label><label>عدد القطع داخل الوحدة<input name="piecesPerUnit" type="number" min="1" step="1" required></label><label>سعر البيع المتوقع للوحدة<input name="salePrice" type="number" min="0.01" step="0.01" required></label><label>حد تنبيه النقص<input name="lowStock" type="number" min="0" step="0.01"></label><label>ملاحظات<textarea name="notes" maxlength="500"></textarea></label></fieldset><p role="alert"></p><button class="primary">حفظ</button><button type="button" data-close class="outline">إلغاء</button></form>';
 document.body.append(d);d.showModal();
 const f=d.querySelector('form'),error=f.querySelector('[role=alert]'),button=f.querySelector('button');
 d.querySelector('[data-camera-scan]').onclick=()=>openBarcodeScanner({isCurrent:()=>d.isConnected&&isCurrent()&&!saving,onDetected:value=>{if(d.isConnected&&isCurrent()&&!saving)f.elements.barcode.value=normalizeBarcode(value);}});
 const normalized=productEditorValues(product);
 if(categoryOptions.length)f.elements.category.value='';
 for(const key of ['name','barcode','category','unit','piecesPerUnit','salePrice','lowStock','notes'])if(normalized[key]!=null)f.elements[key].value=normalized[key];
 let saving=false;
 const creationId=product?null:crypto.randomUUID();
 const close=()=>d.remove();
 d.querySelector('[data-close]').onclick=close;
 d.addEventListener('cancel',event=>{event.preventDefault();close();});
 f.onsubmit=async event=>{
  event.preventDefault();
  if(saving||!isCurrent())return;
  error.textContent='';
  try{
   const values=Object.fromEntries(new FormData(f));
   assertUniqueBarcode(rows,values.barcode,product?.id);
   const payload=productPayload(projectId,values,{id:product?.id});
   saving=true;
   f.querySelector('fieldset').disabled=true;
   button.disabled=true;
   if(product)await api.updateProduct(product.id,payload);
   else await api.createProduct({...payload,id:creationId});
  }catch(e){
   if(d.isConnected)error.textContent=e.message||'تعذر حفظ الصنف';
   return;
  }finally{
   saving=false;
   f.querySelector('fieldset').disabled=false;
   button.disabled=false;
  }
  close();
  if(isCurrent())onSaved?.();
 };
 return d;
}
