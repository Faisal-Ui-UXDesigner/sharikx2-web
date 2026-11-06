let active=null,timer=null,lastMessage='',lastAt=0;
/** One visible announcement; repeated clicks neither stack nor restart it. */
export function showToast(message){
 const text=String(message||'').trim();if(!text)return;
 const now=Date.now();if(active?.isConnected&&text===lastMessage&&now-lastAt<2500)return;
 if(timer)clearTimeout(timer);
 if(!active?.isConnected){active=document.createElement('div');active.className='app-toast';active.dataset.appToast='';active.setAttribute('role','status');active.setAttribute('aria-live','polite');document.body.append(active);}
 active.textContent=text;lastMessage=text;lastAt=now;
 timer=setTimeout(()=>{active?.remove();active=null;timer=null;},3500);
}
