import {mkdir,copyFile,writeFile} from 'node:fs/promises';
const key=process.env.SUPABASE_ANON_KEY||'';
if(key.startsWith('sb_secret_'))throw new Error('A secret key must never be included in a browser build');
if(key.split('.').length===3){const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));if(claims.role!=='anon')throw new Error('Only a public anon key is allowed');}
await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','app.js','api.js','ui.js','operations.js','expense.js','expense-mutation.js','sale.js','customer.js','activity.js','transfer.js','purchase.js','payment.js','collection.js','return.js','return-ui.js','icon.svg','manifest.webmanifest','service-worker.js'])await copyFile(file,`dist/${file}`);
await writeFile('dist/config.js',`window.SHARIKX2_CONFIG=${JSON.stringify({url:process.env.SUPABASE_URL||'https://wygvznwsalwiclrztcdh.supabase.co',publicKey:key,expenseMutations:process.env.ENABLE_EXPENSE_MUTATIONS!=='false',transfers:process.env.ENABLE_TRANSFERS==='true'})};\n`);
console.log(key?'Build ready for connection testing':'Preview build only: public Supabase configuration is not set');
