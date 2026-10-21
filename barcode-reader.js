// Camera ownership belongs to barcode-scanner; decoders never acquire media or send frames.
export const PRODUCT_BARCODE_FORMATS=Object.freeze(['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf']);
const ZXING_FORMATS=Object.freeze(['EAN_13','EAN_8','UPC_A','UPC_E','CODE_128','CODE_39','ITF']);
let libraryPromise;
async function loadLibrary(){
 libraryPromise??=import('./vendor/zxing.min.js').then(()=>{
  if(!globalThis.ZXing?.MultiFormatReader)throw new Error('Barcode reader unavailable');
  return globalThis.ZXing;
 });
 return libraryPromise;
}
export async function createBarcodeReader(){
 if(typeof globalThis.BarcodeDetector==='function'){
  const detector=new globalThis.BarcodeDetector({formats:[...PRODUCT_BARCODE_FORMATS]});
  return {interval:160,detect:source=>detector.detect(source)};
 }
 const zxing=await loadLibrary(),reader=new zxing.MultiFormatReader();
 const hints=new Map([[zxing.DecodeHintType.POSSIBLE_FORMATS,ZXING_FORMATS.map(name=>zxing.BarcodeFormat[name])]]);
 reader.setHints(hints);
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context)throw new Error('Canvas unavailable');
 return {interval:300,async detect(source){
  const width=source.videoWidth??source.width,height=source.videoHeight??source.height;
  if(!width||!height)return [];
  const scale=Math.min(1,960/Math.max(width,height));
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  context.drawImage(source,0,0,canvas.width,canvas.height);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  const luminance=new Uint8ClampedArray(canvas.width*canvas.height);
  for(let i=0;i<luminance.length;i++)luminance[i]=(pixels[i*4]+2*pixels[i*4+1]+pixels[i*4+2])/4;
  try{
   const bitmap=new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(luminance,canvas.width,canvas.height)));
   return [{rawValue:reader.decodeWithState(bitmap).getText()}];
  }catch(error){
   if(error instanceof zxing.NotFoundException||error instanceof zxing.ChecksumException||error instanceof zxing.FormatException)return [];
   throw error;
  }finally{reader.reset();}
 }};
}
