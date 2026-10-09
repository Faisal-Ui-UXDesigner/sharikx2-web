// AppThemePalette: device-local appearance, unrelated to project financial state.
export const THEME_STORAGE_KEY='sharikx2-theme-v1';
export const THEME_PALETTES=Object.freeze({
 dark:Object.freeze({bg:'#080b17',panel:'#11162a',surface:'#181f37',text:'#f7f8fc',muted:'#9ba4bc',green:'#43d389',gold:'#f4c95d',red:'#ff6b78',border:'#28304c',field:'#0d1224',primary:'#f4c95d',onPrimary:'#181c30',profit:'#4ade80'}),
 light:Object.freeze({bg:'#eff2f6',panel:'#ffffff',surface:'#f4f6f9',text:'#161c2d',muted:'#5b657a',green:'#108a5c',gold:'#c28e1d',red:'#c93546',border:'#d8dee8',field:'#f8f9fb',primary:'#1f2748',onPrimary:'#ffffff',profit:'#15803d'})
});
export function themeMode(value){return value==='light'?'light':'dark';}
export function readTheme(storage){try{return themeMode(storage?.getItem(THEME_STORAGE_KEY));}catch{return 'dark';}}
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
