import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isAppleMobile} from '../pwa-install.js';
test('installation recognizes iPhone and desktop-UA iPad, not a touch Windows laptop',()=>{
 assert.equal(isAppleMobile({userAgent:'Mozilla iPhone'}),true);
 assert.equal(isAppleMobile({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}),true);
 assert.equal(isAppleMobile({userAgent:'Windows',platform:'Win32',maxTouchPoints:10}),false);
});
test('install icons have real PNG dimensions and Apple metadata uses the local icon',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../manifest.webmanifest',import.meta.url)));
 for(const size of [192,512]){
  const icon=manifest.icons.find(icon=>icon.sizes===`${size}x${size}`);
  const bytes=await readFile(new URL('../'+icon.src,import.meta.url));
  assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
 }
 const apple=await readFile(new URL('../assets/apple-touch-icon.png',import.meta.url));
 assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
 assert.match(await readFile(new URL('../index.html',import.meta.url),'utf8'),/rel="apple-touch-icon"/);
 assert.equal(manifest.theme_color,'#080b17');
});
