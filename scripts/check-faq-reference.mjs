// Optional read-only comparison; the Android checkout is not required by npm run check.
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';import {FAQ_ENTRIES} from '../faq.js';
const reference=process.argv[2]?pathToFileURL(resolve(process.argv[2])):new URL('../../app/src/main/java/com/partner/accountant/MainActivity.java',import.meta.url);
const source=await readFile(reference,'utf8');
const block=source.slice(source.indexOf('private void showFaqPage()'));
const general=block.match(/String\[\]\[\] faqItems = \{([\s\S]*?)\n\s*\};/)?.[1],premium=block.match(/String\[\]\[\] premiumFaq = \{([\s\S]*?)\n\s*\};/)?.[1];
const pairs=value=>[...value.matchAll(/\{\s*"([^"\n]*)"\s*,\s*"([^"\n]*)"\s*\}/g)].map(match=>({question:match[1],answer:match[2]}));
let entries;
if(general&&premium)entries=[...pairs(general),...pairs(premium)];
else{
 // Current Android refactor moved the same ordered copy into FaqContent.
 const content=source.includes('final class FaqContent')?source:await readFile(new URL('FaqContent.java',reference),'utf8');
 const generalList=content.match(/List<Entry> FAQITEMS = [^\n]*\n([\s\S]*?)\n\s*\)\);/)?.[1],premiumList=content.match(/List<Entry> PREMIUMFAQ = [^\n]*\n([\s\S]*?)\n\s*\)\);/)?.[1];
 assert.ok(generalList&&premiumList,'Android FAQ collections were not found');
 const list=value=>[...value.matchAll(/new Entry\("([^"\n]*)",\s*"([^"\n]*)"\)/g)].map(match=>({question:match[1],answer:match[2]}));entries=[...list(generalList),...list(premiumList)];
}
assert.equal(entries.length,15);assert.deepEqual(FAQ_ENTRIES.map(({question,answer})=>({question,answer})),entries);
console.log('PASS: all 15 FAQ question/answer pairs match the current Android source exactly; no Android files were modified');
