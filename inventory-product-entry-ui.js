import {openBarcodeScanner} from './barcode-scanner.js';
import {openProductEditor,assertUniqueBarcode} from './inventory-mutation.js';
import {checkInventoryCreation} from './inventory-capacity-ui.js';
export function openInventoryProductEntry(options){
 const {container,mode,isCurrent,entryMode='manual',rows=[]}=options;
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||!container.isConnected)return null;
 const existing=container.querySelector('dialog.inventory-editor,dialog[data-barcode-scanner]');
 if(existing){existing.focus();return existing;}
 const authorizeCreate=()=>checkInventoryCreation({...options,getCount:()=>rows.length});
 if(!authorizeCreate())return null;
 if(entryMode==='manual'){container.querySelector('[data-product-entry-error]')?.remove();return openProductEditor({...options,product:null,entryMode,authorizeCreate});}
 if(entryMode!=='scan')throw new Error('طريقة إضافة الصنف غير صالحة');
 return openBarcodeScanner({container,isCurrent:()=>isCurrent()&&container.isConnected,onDetected:barcode=>{
  if(!isCurrent()||!container.isConnected)return;
  if(!authorizeCreate())return;
  try{assertUniqueBarcode(rows,barcode);}
  catch{
   let message=container.querySelector('[data-product-entry-error]');
   if(!message){message=document.createElement('p');message.dataset.productEntryError='true';message.setAttribute('role','alert');container.prepend(message);}
   message.textContent='هذا الصنف مسجل مسبقاً في البضاعة';return;
  }
  container.querySelector('[data-product-entry-error]')?.remove();
  openProductEditor({...options,product:null,entryMode,initialBarcode:barcode,authorizeCreate});
 }});
}
