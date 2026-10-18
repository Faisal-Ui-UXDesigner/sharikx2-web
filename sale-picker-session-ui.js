import {createSalePickerSession} from './sale-picker-session.js';

// Reuses the existing picker nodes/quantity engine. Only the owning sale edits
// its in-memory draft; this controller never reads APIs or persists anything.
export function bindSalePickerSession({owner,dialog,opener,isCurrent,readCart,restoreCart,onOpen,onLock,onError}){
 let session=null,observer=null;
 const current=()=>owner.isConnected&&owner.open&&dialog.isConnected&&isCurrent();
 function finish(commit=false){
  if(!session)return;
  const captured=session;session=null;observer?.disconnect();observer=null;
  try{if(commit&&current())captured.commit();else{const original=captured.cancel();if(original)restoreCart(original);}}
  catch(error){if(current())onError(error);}
  finally{if(dialog.open)dialog.close();onLock(false);if(current())opener.focus();}
 }
 const open=()=>{
  if(session||!current()||document.querySelector('.sale-product-picker-dialog[open]'))return;
  try{
   session=createSalePickerSession(readCart());onLock(true);onOpen();dialog.showModal();
   observer=new MutationObserver(()=>{if(!current())finish(false);});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  }catch(error){finish(false);if(current())onError(error);}
 };
 opener.onclick=open;
 dialog.querySelector('[data-apply-sale-picker]').onclick=()=>{if(current())finish(true);};
 dialog.querySelector('[data-cancel-sale-picker]').onclick=()=>finish(false);
 dialog.oncancel=event=>{event.preventDefault();event.stopPropagation();finish(false);};
 dialog.onclose=()=>{if(!dialog.open)finish(false);};
 return Object.freeze({get active(){return session!==null;},cancel:()=>finish(false)});
}
