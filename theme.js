// AppThemePalette: device-local appearance, unrelated to project financial state.
export const THEME_STORAGE_KEY='sharikx2-theme-v1';
export const THEME_PALETTES=Object.freeze({
 // SharikX2 soft black/orange theme (Figma «Color» variables, 2026-11-03). `gold` is the single orange accent.
 dark:Object.freeze({bg:'#0F0F11',panel:'#1A1A1D',surface:'#232327',text:'#FFFFFF',muted:'#A1A1AA',green:'#34C77B',gold:'#FF8A65',red:'#FF8A80',border:'#2E2E33',field:'#232327',primary:'#FFFFFF',onPrimary:'#111111',profit:'#34C77B'}),
 light:Object.freeze({bg:'#F8F8F9',panel:'#FFFFFF',surface:'#F2F2F4',text:'#111111',muted:'#5F6368',green:'#0F6E3A',gold:'#B8400F',red:'#B3261E',border:'#E4E4E8',field:'#F2F2F4',primary:'#111111',onPrimary:'#FFFFFF',profit:'#0F6E3A'})
});
// Light is the default, as in the Android app (2026-11-05); a saved choice still wins.
export function themeMode(value){return value==='dark'?'dark':'light';}
export function readTheme(storage){try{return themeMode(storage?.getItem(THEME_STORAGE_KEY));}catch{return 'light';}}
export function saveTheme(storage,mode){
 if(typeof mode!=='string'||!Object.hasOwn(THEME_PALETTES,mode))throw new Error('مظهر التطبيق غير صالح');
 try{if(!storage)return false;storage.setItem(THEME_STORAGE_KEY,mode);return true;}catch{return false;}
}
export function createThemeController({document,storage}){
 let mode=readTheme(storage);
 function apply(){
  const root=document.documentElement;
  root.dataset.theme=mode;root.style.colorScheme=mode;
  for(const [key,value] of Object.entries(THEME_PALETTES[mode]))root.style.setProperty(`--${key}`,value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',THEME_PALETTES[mode].bg);
 }
 apply();
 return Object.freeze({get:()=>mode,set(value){
  if(typeof value!=='string'||!Object.hasOwn(THEME_PALETTES,value))throw new Error('مظهر التطبيق غير صالح');
  mode=value;apply();return {mode,persisted:saveTheme(storage,mode)};
 }});
}
