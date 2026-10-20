import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {PURCHASE_RETURN_RPC,purchaseReturnKey,purchaseReturnSnapshot,purchaseReturnDraft,purchaseReturnJournal,readPurchaseReturn,persistPurchaseReturn,clearPurchaseReturn,verifyPurchaseReturn} from './purchase-return.js';

export function openPurchaseReturn({api,projectId,supplier,purchaseId,mode,storage,owner,isCurrent=()=>true,onSaved,onRefund}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 const context=()=>isCurrent()&&(!owner||owner.isConnected&&owner.open);
 if(!context())return;if(globalThis.navigator?.onLine===false)throw new Error('الإرجاع يحتاج اتصالًا بالإنترنت');
 const key=purchaseReturnKey(projectId);
 if(typeof supplier?.id!=='string'||!supplier.id||typeof purchaseId!=='string'||!purchaseId||supplier.project_id!==undefined&&supplier.project_id!==projectId)throw new Error('بيانات الفاتورة غير صالحة');
 if([...document.querySelectorAll('[data-purchase-return-key]')].some(node=>node.dataset.purchaseReturnKey===key))return;
 let journal=null,blocked=false,initialError='';
 try{journal=readPurchaseReturn(storage,projectId);}catch(error){blocked=true;initialError=error.message;}
 if(journal&&(journal.snapshot.purchaseId!==purchaseId||journal.snapshot.supplierId!==supplier.id))throw new Error('هناك إرجاع لم يتأكد؛ افتح فاتورته الأصلية لدى '+journal.snapshot.supplierName);
 const dialog=document.createElement('dialog');dialog.className='purchase-return-dialog';dialog.dataset.purchaseReturnKey=key;dialog.setAttribute('aria-label','إرجاع أصناف فاتورة الشراء');
 dialog.innerHTML='<h2>إرجاع أصناف فاتورة الشراء</h2><p class="muted small">المتاح للإرجاع هو المتبقي من أصناف هذه الفاتورة بعد المرتجعات السابقة، وبحد أقصى المخزون المتوفر حاليًا.</p><form novalidate><fieldset data-return-lines></fieldset><p class="danger-text" data-return-total>إجمالي المرتجع: 0</p><p role="alert"></p><button type="button" data-retry-return hidden>إعادة تحميل الأصناف</button><div class="actions"><button type="submit" class="primary">تأكيد الإرجاع</button><button type="button" class="outline" data-close>إلغاء</button></div></form>';
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),submit=form.querySelector('[type=submit]'),cancel=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]'),retry=form.querySelector('[data-retry-return]'),total=form.querySelector('[data-return-total]');
 let snapshot=journal?.snapshot||null,operation=journal?createOperation(PURCHASE_RETURN_RPC,journal.payload,journal.requestId):null,busy=false,loading=false,ended=false,completed=false,inputs=[];
 const current=()=>!ended&&dialog.isConnected&&dialog.open&&context();
 const dispose=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const finish=refund=>{if(!current())return;dispose();if(context()){if(refund&&onRefund)onRefund();else onSaved?.();}};
 const close=()=>{if(busy)return;if(completed){finish(false);return;}dispose();};
 const observer=new MutationObserver(()=>{if(!current())dispose();});
 const status=()=>{fields.disabled=busy||loading||blocked||!!operation||!snapshot;submit.disabled=busy||loading||blocked||!operation&&!snapshot;cancel.disabled=busy;retry.disabled=busy||loading;submit.textContent=busy?'جارٍ تسجيل الإرجاع...':operation?'التحقق وإعادة المحاولة':'تأكيد الإرجاع';};
 const update=()=>{try{total.textContent='إجمالي المرتجع: '+money(purchaseReturnDraft(snapshot,inputs.map(input=>input.value)).previewTotal);}catch{total.textContent='إجمالي المرتجع: 0';}};
 const fill=()=>{
  fields.innerHTML=snapshot.lines.map((line,index)=>`<label>${escape(line.name)} — المتاح للإرجاع: ${escape(Math.min(line.remainingQuantity,line.stock))}<input data-return-quantity="${index}" type="number" min="0" step="0.001" placeholder="كمية الإرجاع"></label>`).join('');inputs=[...fields.querySelectorAll('input')];
  if(journal){const amounts=new Map(journal.payload.p_items.map(line=>[line.purchase_item_id,line.quantity_pieces]));snapshot.lines.forEach((line,index)=>inputs[index].value=amounts.get(line.id)||'');total.textContent='إجمالي المرتجع: '+money(journal.previewTotal);}
  inputs.forEach(input=>input.oninput=()=>{if(current()&&!operation&&!busy){error.textContent='';update();}});
 };
 const load=async()=>{
  if(!current()||loading||operation||blocked)return;loading=true;retry.hidden=true;error.textContent='جارٍ تحميل الأصناف والمرتجعات...';status();
  try{if(globalThis.navigator?.onLine===false)throw new Error('الإرجاع يحتاج اتصالًا بالإنترنت');const history=await api.supplierHistory(projectId,supplier.id);if(!current())return;snapshot=purchaseReturnSnapshot(history,projectId,supplier.id,purchaseId);fill();error.textContent='';}
  catch(errorValue){if(current()){snapshot=null;error.textContent=errorValue.message;retry.hidden=false;}}
  finally{loading=false;if(current())status();}
 };
 retry.onclick=load;cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=()=>{if(!busy)dispose();};
 error.textContent=initialError;if(snapshot)fill();status();
 form.onsubmit=async event=>{
  event.preventDefault();if(!current()||busy||loading||blocked||completed)return;let confirmed=false,result;
  try{
   if(globalThis.navigator?.onLine===false)throw new Error('الإرجاع يحتاج اتصالًا بالإنترنت');
   if(!operation){const draft=purchaseReturnDraft(snapshot,inputs.map(input=>input.value)),candidate=createOperation(PURCHASE_RETURN_RPC,draft.payload),saved=purchaseReturnJournal(draft,candidate.requestId);try{journal=persistPurchaseReturn(storage,projectId,saved);}catch(errorValue){blocked=true;throw errorValue;}operation=candidate;}
   busy=true;status();error.textContent='';result=await operation.run(api);
   try{verifyPurchaseReturn(result,journal);}catch(errorValue){operation=createOperation(PURCHASE_RETURN_RPC,journal.payload,journal.requestId);throw errorValue;}
   clearPurchaseReturn(storage,projectId,journal);confirmed=current();
  }catch(errorValue){error.textContent=(errorValue.message||'تعذر تأكيد الإرجاع')+(operation?' — أعد التحقق بنفس الطلب لتجنب تكرار الإرجاع':'');}
  finally{busy=false;status();}
  if(!confirmed)return;
  completed=true;
  if(Number(result.credit_added)>.009){
   form.innerHTML=`<h3 class="success-text">تم تسجيل رصيد لك بقيمة ${money(result.credit_added,2)}</h3><p>يمكنك إبقاء الرصيد للمشتريات القادمة، أو تسجيل المبلغ الذي استلمته فعليًا من المورد.</p><div class="actions"><button type="button" class="primary" data-refund>تسجيل مبلغ مسترد</button><button type="button" data-keep>إبقاء الرصيد</button></div>`;
   form.querySelector('[data-refund]').onclick=()=>finish(true);form.querySelector('[data-keep]').onclick=()=>finish(false);
  }else finish(false);
 };
 try{document.body.append(dialog);dialog.showModal();if(!current()){dispose();return;}observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});if(!journal&&!blocked)void load();}catch(errorValue){dispose();throw errorValue;}
 return dialog;
}
