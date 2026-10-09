import {execFileSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const run=args=>execFileSync(process.execPath,args,{cwd:root,stdio:'inherit'});
const unitTests=(await readdir(new URL('../tests/',import.meta.url)))
 .filter(name=>name.endsWith('.test.mjs')).sort().map(name=>`tests/${name}`);

console.log('Checking JavaScript syntax');
for(const file of (await readdir(root)).filter(file=>file.endsWith('.js')))run(['--check',file]);
for(const folder of ['scripts','tests']){
 for(const file of (await readdir(new URL(`../${folder}/`,import.meta.url))).filter(file=>file.endsWith('.mjs')))run(['--check',`${folder}/${file}`]);
}
console.log('Running unit tests');
run(['--test',...unitTests]);
console.log('Running isolated browser regressions');
run(['tests/inventory-browser-smoke.mjs']);
run(['tests/report-browser-smoke.mjs']);
run(['tests/accounts-browser-smoke.mjs']);
run(['tests/supplier-old-debt-browser-smoke.mjs']);
run(['tests/customer-details-browser-smoke.mjs']);
run(['tests/debt-sale-browser-smoke.mjs']);
run(['tests/debt-payment-browser-smoke.mjs']);
run(['tests/supplier-payment-review-browser-smoke.mjs']);
run(['tests/return-browser-smoke.mjs']);
run(['tests/purchase-browser-smoke.mjs']);
run(['tests/currency-browser-smoke.mjs']);
run(['tests/theme-browser-smoke.mjs']);
run(['tests/cashier-catalog-browser-smoke.mjs']);
run(['tests/barcode-scanner-browser-smoke.mjs']);
run(['tests/measured-sale-browser-smoke.mjs']);
run(['tests/sale-pricing-browser-smoke.mjs']);
run(['tests/sale-recovery-browser-smoke.mjs']);
run(['tests/sale-drafts-browser-smoke.mjs']);
run(['tests/partners-browser-smoke.mjs']);
run(['tests/retention-browser-smoke.mjs']);
run(['tests/sale-review-browser-smoke.mjs']);
run(['tests/customer-create-browser-smoke.mjs']);
run(['tests/contact-browser-smoke.mjs']);
console.log('All local checks passed. No live project was modified.');
