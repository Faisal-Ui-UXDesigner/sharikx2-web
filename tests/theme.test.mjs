import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THEME_PALETTES,THEME_STORAGE_KEY,themeMode,readTheme,saveTheme,createThemeController} from '../theme.js';

function fixture(value){
 const values=new Map(),writes=[],document={documentElement:{dataset:{},style:{setProperty:(key,value)=>values.set(key,value)}},querySelector:()=>({setAttribute:(key,value)=>values.set(key,value)})};
 const storage={getItem:()=>value,setItem:(key,value)=>writes.push([key,value])};
 return {document,storage,values,writes};
}
test('theme palettes retain current Android AppThemePalette immutable RGB tokens (2026-11-03)',()=>{
 const expected={dark:['0f0f11','1a1a1d','232327','ffffff','a1a1aa','34c77b','ff8a65','ff8a80','2e2e33','232327','ffffff','111111','34c77b'],light:['f8f8f9','ffffff','f2f2f4','111111','5f6368','0f6e3a','b8400f','b3261e','e4e4e8','f2f2f4','111111','ffffff','0f6e3a']};
 for(const mode of ['dark','light']){
  assert.deepEqual(Object.values(THEME_PALETTES[mode]).map(value=>value.toLowerCase()),expected[mode].map(rgb=>'#'+rgb));
  assert.equal(Object.isFrozen(THEME_PALETTES[mode]),true);
 }
 assert.equal(Object.isFrozen(THEME_PALETTES),true);
});
test('theme defaults to current Android light mode, not OS preference or malformed storage',()=>{
 for(const value of [undefined,null,'','DARK','LIGHT',true,{},'<img>'])assert.equal(themeMode(value),'light');
 assert.equal(themeMode('light'),'light');assert.equal(readTheme(fixture('light').storage),'light');
 assert.equal(themeMode('dark'),'dark');assert.equal(readTheme({getItem(){throw new Error('blocked');}}),'light');assert.equal(readTheme(null),'light');
});
test('theme save writes only a scoped preference and rejects invalid modes before storage',()=>{
 const f=fixture();assert.equal(saveTheme(f.storage,'light'),true);assert.deepEqual(f.writes,[[THEME_STORAGE_KEY,'light']]);
 for(const mode of ['__proto__',undefined,'LIGHT',{toString:()=> 'light'}])assert.throws(()=>saveTheme(f.storage,mode),/غير صالح/);
 assert.equal(f.writes.length,1);
});
test('unavailable preference storage is nonfatal and does not claim persistence',()=>{
 assert.equal(saveTheme(null,'light'),false);assert.equal(saveTheme({setItem(){throw new Error('quota');}},'light'),false);
});
test('controller restores all tokens and theme-color without writing on startup',()=>{
 const f=fixture('light'),controller=createThemeController(f);
 assert.equal(controller.get(),'light');assert.equal(f.document.documentElement.dataset.theme,'light');assert.equal(f.document.documentElement.style.colorScheme,'light');
 for(const [key,value] of Object.entries(THEME_PALETTES.light))assert.equal(f.values.get('--'+key),value);
 assert.equal(f.values.get('content'),THEME_PALETTES.light.bg);assert.deepEqual(f.writes,[]);
});
test('controller switches both modes, rejects invalid writes and preserves local mode on storage failure',()=>{
 const f=fixture(),controller=createThemeController(f);assert.deepEqual(controller.set('light'),{mode:'light',persisted:true});assert.deepEqual(controller.set('dark'),{mode:'dark',persisted:true});
 assert.throws(()=>controller.set('bad'),/غير صالح/);assert.equal(controller.get(),'dark');assert.equal(f.writes.length,2);
 f.storage.setItem=()=>{throw new Error('blocked');};assert.deepEqual(controller.set('light'),{mode:'light',persisted:false});assert.equal(f.values.get('--primary'),THEME_PALETTES.light.primary);
});
test('theme controller works without optional browser theme-color metadata',()=>{
 const f=fixture();f.document.querySelector=()=>null;assert.doesNotThrow(()=>createThemeController(f));
});
test('CSS effective defaults match current Android light palette and all variable references are defined',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 const defaults=[...css.matchAll(/:root\s*\{([^}]*)\}/g)].reduce((values,match)=>{
  for(const entry of match[1].split(';')){const index=entry.indexOf(':');if(index>0)values.set(entry.slice(0,index).trim(),entry.slice(index+1).trim());}return values;
 },new Map());
 for(const [key,value] of Object.entries(THEME_PALETTES.light))assert.equal(defaults.get('--'+key)?.toLowerCase(),value.toLowerCase(),key);
 assert.equal(defaults.get('color-scheme'),'light');
 for(const match of css.matchAll(/var\((--[\w-]+)\)/g))assert.ok(css.includes(`${match[1]}:`),match[1]);
 assert.equal(/#[a-f0-9]{6}\b/i.test(css.replace(/:root\s*\{[^}]*\}/g,'')),false,'shared UI colors must use tokens outside palette declarations');
});


test('explicit automatic appearance follows device changes without replacing the saved preference',()=>{
 const f=fixture('system'),media={matches:true,addEventListener(name,callback){this.changed=callback;}};
 const controller=createThemeController({...f,matchMedia:()=>media});
 assert.equal(controller.preference(),'system');assert.equal(controller.get(),'dark');assert.deepEqual(f.writes,[]);
 media.matches=false;media.changed();assert.equal(controller.get(),'light');assert.equal(f.document.documentElement.dataset.theme,'light');
 controller.set('dark');media.changed();assert.equal(controller.get(),'dark');
 controller.set('system');assert.equal(controller.preference(),'system');assert.equal(controller.get(),'light');assert.deepEqual(f.writes.at(-1),[THEME_STORAGE_KEY,'system']);
});
