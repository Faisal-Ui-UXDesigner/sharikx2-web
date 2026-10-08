export function renderThemeSettings({container,controller,isCurrent=()=>true}){
 if(!isCurrent())return;
 const panel=document.createElement('section');panel.className='panel theme-settings';
 panel.innerHTML='<div class="row"><div><h2>مظهر التطبيق</h2><p class="muted" data-theme-label></p></div><div class="theme-switch" role="group" aria-label="مظهر التطبيق"><button type="button" data-theme-mode="light" aria-label="الوضع الفاتح">☀</button><button type="button" data-theme-mode="dark" aria-label="الوضع الداكن">☾</button></div></div><p class="muted small">اختيار المظهر محفوظ في هذا المتصفح، ولا يغيّر بيانات المشروع.</p><p role="status" aria-live="polite" data-theme-status></p>';
 const draw=()=>{
  const mode=controller.get();panel.querySelector('[data-theme-label]').textContent=mode==='dark'?'الوضع الداكن':'الوضع الفاتح';
  panel.querySelectorAll('[data-theme-mode]').forEach(button=>{const selected=button.dataset.themeMode===mode;button.setAttribute('aria-pressed',String(selected));button.classList.toggle('primary',selected);});
 };
 panel.onclick=event=>{
  const button=event.target.closest('[data-theme-mode]');if(!button||!panel.contains(button)||!panel.isConnected||!isCurrent())return;
  const result=controller.set(button.dataset.themeMode);draw();
  panel.querySelector('[data-theme-status]').textContent=result.persisted?'':'تم تطبيق المظهر؛ تعذر حفظ الاختيار لإعادة فتح المتصفح.';
 };
 container.append(panel);draw();return panel;
}
