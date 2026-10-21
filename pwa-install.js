export function isAppleMobile(navigatorLike){
 return /iPhone|iPad|iPod/.test(navigatorLike.userAgent||'')||(navigatorLike.platform==='MacIntel'&&navigatorLike.maxTouchPoints>1);
}
export function bindPwaInstall({root,host=window}){
 if(!root)return ()=>{};
 let prompt=null,disposed=false,guide=null,installedHere=false;
 const standalone=()=>host.matchMedia('(display-mode: standalone)').matches||host.navigator.standalone===true;
 const closeGuide=()=>{guide?.remove();guide=null;};
 const showGuide=()=>{
  if(guide?.isConnected)return;
  guide=document.createElement('dialog');guide.setAttribute('aria-labelledby','install-guide-title');
  guide.innerHTML='<h2 id="install-guide-title">تثبيت SharikX2 على iPhone أو iPad</h2><p>من قائمة المتصفح، افتح «مشاركة»، ثم «إضافة إلى الشاشة الرئيسية» وأكّد الإضافة. إذا لم يظهر الخيار، افتح رابط التطبيق في Safari وأعد المحاولة.</p><p class="muted">التثبيت لا ينقل صلاحية التحكم من جهاز آخر، ولا يتيح تسجيل العمليات المالية دون اتصال.</p><button class="primary" data-close-install>فهمت</button>';
  guide.querySelector('[data-close-install]').onclick=()=>guide.close();
  guide.addEventListener('close',closeGuide,{once:true});document.body.append(guide);guide.showModal();
 };
 const render=()=>{
  root.replaceChildren();if(disposed||installedHere||standalone()||(!prompt&&!isAppleMobile(host.navigator)))return;
  const button=document.createElement('button');button.type='button';button.className='outline';button.textContent='تثبيت التطبيق';
  button.onclick=async()=>{
   if(!prompt){showGuide();return;}
   const pending=prompt;prompt=null;button.disabled=true;
   try{await pending.prompt();await pending.userChoice;}catch{/* Browser may withdraw an install offer. */}
   finally{render();}
  };
  root.append(button);
 };
 const offered=event=>{event.preventDefault();prompt=event;render();};
 const installed=()=>{installedHere=true;prompt=null;closeGuide();root.replaceChildren();};
 host.addEventListener('beforeinstallprompt',offered);host.addEventListener('appinstalled',installed);render();
 return ()=>{disposed=true;host.removeEventListener('beforeinstallprompt',offered);host.removeEventListener('appinstalled',installed);closeGuide();root.replaceChildren();};
}
