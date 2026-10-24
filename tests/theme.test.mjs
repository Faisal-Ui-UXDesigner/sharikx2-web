import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THEME_PALETTES,THEME_STORAGE_KEY,themeMode,readTheme,saveTheme,createThemeController} from '../theme.js';

function fixture(value){
 const values=new Map(),writes=[],document={documentElement:{dataset:{},style:{setProperty:(key,value)=>values.set(key,value)}},querySelector:()=>({setAttribute:(key,value)=>values.set(key,value)})};
 const storage={getItem:()=>value,setItem:(key,value)=>writes.push([key,value])};
 return {document,storage,values,writes};
}
test('theme palettes retain exact immutable Android RGB tokens',()=>{
 const expected={dark:[[8,11,23],[17,22,42],[24,31,55],[247,248,252],[155,164,188],[67,211,137],[244,201,93],[255,107,120],[40,48,76],[13,18,36],[244,201,93],[24,28,48],[74,222,128]],light:[[239,242,246],[255,255,255],[244,246,249],[22,28,45],[91,101,122],[16,138,92],[194,142,29],[201,53,70],[216,222,232],[248,249,251],[31,39,72],[255,255,255],[21,128,61]]};
 for(const mode of ['dark','light']){
  assert.deepEqual(Object.values(THEME_PALETTES[mode]),expected[mode].map(rgb=>'#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('')));
  assert.equal(Object.isFrozen(THEME_PALETTES[mode]),true);
 }
 assert.equal(Object.isFrozen(THEME_PALETTES),true);
});
test('theme defaults to Android dark mode, not OS preference or malformed storage',()=>{
 for(const value of [undefined,null,'','DARK','LIGHT','system',true,{},'<img>'])assert.equal(themeMode(value),'dark');
 assert.equal(themeMode('light'),'light');assert.equal(readTheme(fixture('light').storage),'light');
 assert.equal(readTheme({getItem(){throw new Error('blocked');}}),'dark');assert.equal(readTheme(null),'dark');
});
test('theme save writes only a scoped preference and rejects invalid modes before storage',()=>{
 const f=fixture();assert.equal(saveTheme(f.storage,'light'),true);assert.deepEqual(f.writes,[[THEME_STORAGE_KEY,'light']]);
 for(const mode of ['system','__proto__',undefined,'LIGHT',{toString:()=> 'light'}])assert.throws(()=>saveTheme(f.storage,mode),/غير صالح/);
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
test('CSS default tokens match Android dark palette and all variable references are defined',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 for(const [key,value] of Object.entries(THEME_PALETTES.dark))assert.ok(css.includes(`--${key}:${value}`),key);
 for(const match of css.matchAll(/var\((--[\w-]+)\)/g))assert.ok(css.includes(`${match[1]}:`),match[1]);
 assert.equal(/#[a-f0-9]{6}\b/i.test(css.slice(css.indexOf('}')+1)),false,'shared UI colors must use tokens');
});
