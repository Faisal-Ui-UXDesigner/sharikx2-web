const appearanceIcons={
 system:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 19h4"/>',
 light:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
 dark:'<path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>'
};
const appearanceIcon=mode=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${appearanceIcons[mode]}</svg>`;
export function renderThemeSettings({container,controller,isCurrent=()=>true}){
 if(!isCurrent())return;
 const panel=document.createElement('section');panel.className='panel theme-settings';
 panel.innerHTML=`<h2>المظهر</h2><div class="theme-switch" role="group" aria-label="مظهر التطبيق"><button type="button" data-theme-mode="system" aria-label="تلقائي، حسب مظهر الجهاز">${appearanceIcon('system')}<span>تلقائي</span></button><button type="button" data-theme-mode="light" aria-label="الوضع الفاتح">${appearanceIcon('light')}<span>فاتح</span></button><button type="button" data-theme-mode="dark" aria-label="الوضع الداكن">${appearanceIcon('dark')}<span>داكن</span></button></div><p role="status" aria-live="polite" data-theme-status></p>`;
 const draw=()=>{
  const mode=controller.preference?.()||controller.get();
  panel.querySelectorAll('[data-theme-mode]').forEach(button=>{const selected=button.dataset.themeMode===mode;button.setAttribute('aria-pressed',String(selected));button.classList.toggle('primary',selected);});
 };
 panel.onclick=event=>{
  const button=event.target.closest('[data-theme-mode]');if(!button||!panel.contains(button)||!panel.isConnected||!isCurrent())return;
  const result=controller.set(button.dataset.themeMode);draw();
  panel.querySelector('[data-theme-status]').textContent=result.persisted?'':'تم تطبيق المظهر؛ تعذر حفظ الاختيار لإعادة فتح المتصفح.';
 };
 container.append(panel);draw();return panel;
}
