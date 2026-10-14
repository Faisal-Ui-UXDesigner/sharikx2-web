export const PRODUCT_BARCODE_FORMATS=Object.freeze(['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf']);
export function normalizeBarcode(value){return String(value??'').trim();}
export function shouldAcceptScan(now,lastScanAt=0,locked=false){return !locked&&Number.isFinite(Number(now))&&Number(now)-Number(lastScanAt)>=1000;}
export function cameraSupported(){return typeof navigator!=='undefined'&&!!navigator.mediaDevices?.getUserMedia&&typeof window!=='undefined'&&'BarcodeDetector' in window;}
export async function openBarcodeScanner({container=document.body,onDetected,isCurrent=()=>true}){
 if(!isCurrent()||document.querySelector('dialog[data-barcode-scanner]'))return;
 const dialog=document.createElement('dialog');dialog.dataset.barcodeScanner='true';dialog.innerHTML='<h2>مسح الباركود</h2><video autoplay playsinline muted></video><p class="muted" data-scanner-status></p><label>أدخل الباركود يدويًا<input data-manual-barcode inputmode="numeric" autocomplete="off"></label><div class="actions"><button data-manual class="outline">استخدام الباركود</button><button data-close class="primary">إلغاء</button></div>';container.append(dialog);dialog.showModal();
 const video=dialog.querySelector('video'),status=dialog.querySelector('[data-scanner-status]');
 let stream=null,closed=false,lastScanAt=0,timer=null;
 const stopStream=()=>{stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;};
 const close=()=>{if(closed)return;closed=true;clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);stopStream();dialog.remove();};
 const current=()=>!closed&&dialog.isConnected&&isCurrent();
 const onVisibility=()=>{if(document.hidden)close();};
 const observer=new MutationObserver(()=>{if(!current())close();});observer.observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',onVisibility);
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',close);
 const emit=value=>{
  if(!current()){close();return false;}
  const normalized=normalizeBarcode(value);if(!normalized){status.textContent='أدخل رقم الباركود';return false;}
  if(!shouldAcceptScan(Date.now(),lastScanAt,closed))return false;
  lastScanAt=Date.now();close();onDetected?.(normalized);return true;
 };
 const manual=dialog.querySelector('[data-manual-barcode]');dialog.querySelector('[data-manual]').onclick=()=>emit(manual.value);
 manual.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();emit(manual.value);}};
 if(!cameraSupported()){status.textContent='المتصفح لا يدعم المسح بالكاميرا؛ استخدم الإدخال اليدوي.';video.hidden=true;return dialog;}
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(!current()){stopStream();close();return dialog;}
  video.srcObject=stream;
  const detector=new window.BarcodeDetector({formats:[...PRODUCT_BARCODE_FORMATS]});
  await video.play();if(!current()){close();return dialog;}
  status.textContent='وجّه الكاميرا نحو الباركود';
  const scan=async()=>{
   if(!current()){close();return;}
   try{const found=await detector.detect(video);if(!current()){close();return;}if(found?.[0]?.rawValue&&emit(found[0].rawValue))return;}catch{}
   if(current())timer=setTimeout(scan,160);else close();
  };
  scan();
 }catch{
  stopStream();if(!current()){close();return dialog;}
  status.textContent='تعذر تشغيل الكاميرا؛ استخدم الإدخال اليدوي.';video.hidden=true;
 }
 return dialog;
}
