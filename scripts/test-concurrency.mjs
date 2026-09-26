// Destructive cleanup is limited to the fresh project created by this run.
// No existing project IDs or credentials are accepted by this harness.
import assert from 'node:assert/strict';
import {randomUUID,randomInt} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const url=process.env.SUPABASE_URL||'https://wygvznwsalwiclrztcdh.supabase.co';
let key=process.env.SUPABASE_ANON_KEY;
if(!key&&process.env.PUBLIC_KEY_REFERENCE){
 const source=await readFile(process.env.PUBLIC_KEY_REFERENCE,'utf8');
 key=source.match(/CLOUD_PUBLIC_KEY\s*=\s*"([^"]+)"/)?.[1];
}
if(!key)throw new Error('PUBLIC_KEY_REQUIRED');
if(key.startsWith('sb_secret_'))throw new Error('SECRET_KEY_REJECTED');
if(key.split('.').length===3&&JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!=='anon')throw new Error('NON_PUBLIC_KEY_REJECTED');
const results=[];let project=null,owner=null;
const phone='099'+String(randomInt(0,10000000)).padStart(7,'0'),password=String(randomInt(0,10000)).padStart(4,'0');
async function request(token,path,method='GET',body){
 assert.ok(path.startsWith('/auth/v1/')||/^\/rest\/v1\/(rpc\/)?[a-z0-9_]*sharikx2_/.test(path));
 const response=await fetch(url+path,{method,headers:{apikey:key,Authorization:`Bearer ${token||key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const e=new Error(data?.message||data?.error_description||`HTTP_${response.status}`);e.status=response.status;throw e;}
 return data;
}
const rpc=(token,name,body)=>request(token,`/rest/v1/rpc/${name}`,'POST',body);
const pass=name=>{results.push({name,result:'PASS'});console.log('PASS',name);};
async function denied(action){try{await action();}catch(e){assert.ok(/OWNER_REQUIRED|permission|row-level|access|PROJECT_ACCESS_DENIED/i.test(e.message));return;}throw new Error('VIEWER_WRITE_WAS_ALLOWED');}
async function simultaneous(first,second){const outcomes=await Promise.allSettled([first(),second()]);return outcomes;}
try{
 const identities=[];
 for(let i=0;i<3;i++){const auth=await request(null,'/auth/v1/signup','POST',{});assert.ok(auth.access_token);identities.push(auth.access_token);}
 const [a,b,viewer]=identities;owner=a;
 const marker='Web concurrency test '+randomUUID();
 project=await rpc(a,'create_sharikx2_project_v3',{p_name:marker,p_owner_phone:phone,p_owner_password:password,p_wallet_1_name:'Test wallet A',p_wallet_2_name:'Test wallet B'});
 assert.ok(project.id);
 const accountRows=await request(a,`/rest/v1/sharikx2_accounts?project_id=eq.${project.id}&select=*`);
 const account=accountRows.find(x=>x.account_type==='cash');assert.ok(account);
 await request(a,`/rest/v1/sharikx2_accounts?id=eq.${account.id}&project_id=eq.${project.id}`,'PATCH',{opening_balance:100});
 await rpc(b,'restore_sharikx2_owner_project_v2',{p_owner_phone:phone,p_owner_password:password});
 const after=await request(a,`/rest/v1/sharikx2_projects?id=eq.${project.id}&select=id,name,owner_id`);
 assert.equal(after[0].name,marker);
 await Promise.all([rpc(a,'get_sharikx2_financial_summary_v2',{p_project_id:project.id}),rpc(b,'get_sharikx2_financial_summary_v2',{p_project_id:project.id})]);
 const bwrite=await request(b,`/rest/v1/sharikx2_accounts?id=eq.${account.id}&project_id=eq.${project.id}`,'PATCH',{name:'Test cash'});assert.equal(bwrite.length,1);
 pass('both owner identities retain read/write access');
 const expenseId=randomUUID(),expense={p_project_id:project.id,p_category:'operating_expense',p_description:'Disposable duplicate test',p_amount:10,p_account_id:account.id,p_request_id:expenseId};
 const duplicate=await Promise.all([rpc(a,'confirm_sharikx2_expense_web_v1',expense),rpc(b,'confirm_sharikx2_expense_web_v1',expense)]);
 assert.equal(duplicate[0].id,duplicate[1].id);pass('concurrent identical expense creates one result');
 const spend=await simultaneous(()=>rpc(a,'confirm_sharikx2_expense_web_v1',{...expense,p_amount:60,p_request_id:randomUUID()}),()=>rpc(b,'confirm_sharikx2_expense_web_v1',{...expense,p_amount:60,p_request_id:randomUUID()}));
 assert.equal(spend.filter(x=>x.status==='fulfilled').length,1);assert.match(spend.find(x=>x.status==='rejected').reason.message,/INSUFFICIENT_ACCOUNT_BALANCE/);pass('concurrent overspending admits one request only');
 const [product]=await request(a,'/rest/v1/sharikx2_products','POST',{project_id:project.id,name:'Disposable last piece',barcode:randomUUID(),quantity_pieces:1,default_sale_price:10,weighted_unit_cost:4});
 const sale={p_project_id:project.id,p_items:[{product_id:product.id,quantity:1,unit_sale_price:10}],p_discount:0,p_customer_id:null,p_account_id:account.id,p_as_debt:false};
 const stock=await simultaneous(()=>rpc(a,'confirm_sharikx2_sale_web_v1',{...sale,p_request_id:randomUUID()}),()=>rpc(b,'confirm_sharikx2_sale_web_v1',{...sale,p_request_id:randomUUID()}));
 assert.equal(stock.filter(x=>x.status==='fulfilled').length,1);assert.match(stock.find(x=>x.status==='rejected').reason.message,/OUT_OF_STOCK/);pass('concurrent last-piece sales admit one sale only');
 // Viewer membership is inserted only in this new disposable fixture.
 // Anonymous token's subject is used locally, never printed or persisted.
 const viewerId=JSON.parse(Buffer.from(viewer.split('.')[1],'base64url')).sub;
 await request(a,'/rest/v1/sharikx2_members','POST',{project_id:project.id,user_id:viewerId,role:'viewer',display_name:'Disposable viewer'});
 // Free-plan viewer is denied reads; active paid fixture allows read-only access.
 await request(a,`/rest/v1/sharikx2_projects?id=eq.${project.id}`,'PATCH',{subscription_status:'active',subscription_expires_at:null});
 await rpc(viewer,'get_sharikx2_financial_summary_v2',{p_project_id:project.id});
 await denied(()=>rpc(viewer,'confirm_sharikx2_expense_web_v1',{...expense,p_request_id:randomUUID()}));
 const viewerPatch=await request(viewer,`/rest/v1/sharikx2_products?id=eq.${product.id}&project_id=eq.${project.id}`,'PATCH',{name:'Must not change'});
 assert.equal(viewerPatch.length,0);
 const [unchanged]=await request(a,`/rest/v1/sharikx2_products?id=eq.${product.id}&project_id=eq.${project.id}&select=name`);assert.equal(unchanged.name,'Disposable last piece');
 pass('authenticated viewer can read but cannot execute expense or update inventory');
 const summary=await rpc(a,'get_sharikx2_financial_summary_v2',{p_project_id:project.id});
 assert.equal(Number(summary.liquidity),40);assert.equal(Number(summary.inventory_cost),0);pass('final server balance and stock reconcile');
 const bank=accountRows.find(x=>x.account_type==='bank');assert.ok(bank);
 await request(a,`/rest/v1/sharikx2_accounts?id=eq.${bank.id}&project_id=eq.${project.id}`,'PATCH',{opening_balance:100});
 const expenseEntity=duplicate[0].id;
 const [original]=await request(a,`/rest/v1/sharikx2_expenses?id=eq.${expenseEntity}&project_id=eq.${project.id}&select=*`);
 const snapshot=x=>({account_id:x.account_id,amount:Number(x.amount),description:x.description??null,category:x.category??null});
 const mutation={p_project_id:project.id,p_expense_id:expenseEntity,p_action:'update',p_expected:snapshot(original),p_changes:{account_id:bank.id,amount:20,description:'Moved expense',category:original.category},p_request_id:randomUUID()};
 const edited=await Promise.all([rpc(a,'mutate_sharikx2_expense_web_v1',mutation),rpc(b,'mutate_sharikx2_expense_web_v1',mutation)]);assert.equal(edited[0].id,edited[1].id);
 const changedSummary=await rpc(a,'get_sharikx2_financial_summary_v2',{p_project_id:project.id});
 assert.equal(Number(changedSummary.accounts.find(x=>x.id===account.id).balance),50);
 assert.equal(Number(changedSummary.accounts.find(x=>x.id===bank.id).balance),80);
 pass('idempotent expense reassignment restores cash and debits bank once');
 await assert.rejects(rpc(b,'mutate_sharikx2_expense_web_v1',{...mutation,p_request_id:randomUUID()}),/STALE_EXPENSE/);
 pass('old expense snapshot is rejected');
 const [current]=await request(a,`/rest/v1/sharikx2_expenses?id=eq.${expenseEntity}&project_id=eq.${project.id}&select=*`);
 await denied(()=>rpc(viewer,'mutate_sharikx2_expense_web_v1',{...mutation,p_expected:snapshot(current),p_request_id:randomUUID()}));
 pass('viewer cannot mutate an expense');
 const deletion={...mutation,p_action:'delete',p_expected:snapshot(current),p_changes:{},p_request_id:randomUUID()};
 const removed=await Promise.all([rpc(a,'mutate_sharikx2_expense_web_v1',deletion),rpc(b,'mutate_sharikx2_expense_web_v1',deletion)]);assert.ok(removed.every(x=>x.deleted));
 const final=await rpc(a,'get_sharikx2_financial_summary_v2',{p_project_id:project.id});assert.equal(Number(final.accounts.find(x=>x.id===bank.id).balance),100);
 assert.equal((await request(a,`/rest/v1/sharikx2_expenses?id=eq.${expenseEntity}&project_id=eq.${project.id}&select=id`)).length,0);
 pass('idempotent expense deletion restores the charged account');
 const transfer={p_project_id:project.id,p_from_account_id:account.id,p_to_account_id:bank.id,p_amount:25,p_note:null,p_request_id:randomUUID()};
 const moved=await Promise.all([rpc(a,'transfer_sharikx2_account_web_v1',transfer),rpc(b,'transfer_sharikx2_account_web_v1',transfer)]);
 assert.equal(moved[0].id,moved[1].id);
 const afterTransfer=await rpc(a,'get_sharikx2_financial_summary_v2',{p_project_id:project.id});
 assert.equal(Number(afterTransfer.accounts.find(x=>x.id===account.id).balance),25);
 assert.equal(Number(afterTransfer.accounts.find(x=>x.id===bank.id).balance),125);
 pass('duplicate transfer debits and credits once');
 await assert.rejects(rpc(b,'transfer_sharikx2_account_web_v1',{...transfer,p_amount:20}),/REQUEST_PAYLOAD_CHANGED/);
 pass('transfer request ID cannot be reused with a different amount');
 await denied(()=>rpc(viewer,'transfer_sharikx2_account_web_v1',{...transfer,p_request_id:randomUUID()}));
 pass('viewer cannot transfer between accounts');
 const contest=await simultaneous(()=>rpc(a,'transfer_sharikx2_account_web_v1',{...transfer,p_amount:20,p_request_id:randomUUID()}),()=>rpc(b,'transfer_sharikx2_account_web_v1',{...transfer,p_amount:20,p_request_id:randomUUID()}));
 assert.equal(contest.filter(x=>x.status==='fulfilled').length,1);
 assert.match(contest.find(x=>x.status==='rejected').reason.message,/INSUFFICIENT_ACCOUNT_BALANCE/);
 const endBalances=await rpc(a,'get_sharikx2_financial_summary_v2',{p_project_id:project.id});
 assert.equal(Number(endBalances.accounts.find(x=>x.id===account.id).balance),5);
 assert.equal(Number(endBalances.accounts.find(x=>x.id===bank.id).balance),145);
 pass('concurrent transfers cannot overspend the source account');
 const [supplier]=await request(a,'/rest/v1/sharikx2_suppliers','POST',{project_id:project.id,name:'Disposable supplier',phone:'0591111111'});
 const purchaseId=randomUUID();const purchase={p_project_id:project.id,p_supplier_id:supplier.id,p_items:[{product_id:product.id,quantity_pieces:2,unit_cost:1.6}],p_payments:[{account_id:bank.id,amount:3.2}],p_invoice_number:null,p_note:'Web purchase test',p_request_id:purchaseId};
 const purchased=await Promise.all([rpc(a,'confirm_sharikx2_purchase_v3',purchase),rpc(b,'confirm_sharikx2_purchase_v3',purchase)]);
 assert.equal(purchased[0].id,purchased[1].id);assert.equal(Number(purchased[0].debt_amount),0);pass('duplicate purchase creates one invoice and one payment');
 await assert.rejects(rpc(b,'confirm_sharikx2_purchase_v3',{...purchase,p_note:'changed'}),/PURCHASE_REQUEST_CHANGED/);pass('purchase request ID cannot be reused with changed data');
 const [stockAfter]=await request(a,`/rest/v1/sharikx2_products?id=eq.${product.id}&project_id=eq.${project.id}&select=quantity_pieces`);assert.equal(Number(stockAfter.quantity_pieces),2);pass('purchase increases inventory once');
 const debtPurchase={...purchase,p_items:[{product_id:product.id,quantity_pieces:1,unit_cost:10}],p_payments:[],p_request_id:randomUUID(),p_note:'Web supplier debt test'};
 const debtInvoice=await rpc(a,'confirm_sharikx2_purchase_v3',debtPurchase);assert.equal(Number(debtInvoice.debt_amount),10);pass('unpaid purchase creates supplier debt');
 const supplierPay={p_project_id:project.id,p_supplier_id:supplier.id,p_sources:[{account_id:bank.id,amount:6},{account_id:account.id,amount:4}],p_note:'Web supplier payment test',p_request_id:randomUUID()};
 const supplierPayments=await Promise.all([rpc(a,'pay_sharikx2_supplier_web_v1',supplierPay),rpc(b,'pay_sharikx2_supplier_web_v1',supplierPay)]);
 assert.equal(supplierPayments[0].id,supplierPayments[1].id);assert.equal(Number(supplierPayments[0].remaining_debt),0);pass('split supplier payment settles debt once');
 await assert.rejects(rpc(b,'pay_sharikx2_supplier_web_v1',{...supplierPay,p_note:'changed'}),/REQUEST_PAYLOAD_CHANGED/);pass('supplier payment request ID cannot change payload');
 const [customer]=await request(a,'/rest/v1/sharikx2_customers','POST',{project_id:project.id,name:'Disposable customer',phone:'0592222222'});
 const debtSale={p_project_id:project.id,p_items:[{product_id:product.id,quantity:1,unit_sale_price:10}],p_discount:0,p_customer_id:customer.id,p_account_id:null,p_as_debt:true,p_request_id:randomUUID()};
 const debtSaleResult=await rpc(a,'confirm_sharikx2_sale_web_v1',debtSale);assert.equal(Number(debtSaleResult.debt_amount),10);pass('debt sale creates customer balance');
 const collect={p_project_id:project.id,p_customer_id:customer.id,p_amount:10,p_account_id:account.id,p_note:'Web customer collection test',p_request_id:randomUUID()};const collected=await Promise.all([rpc(a,'collect_sharikx2_customer_debt_web_v1',collect),rpc(b,'collect_sharikx2_customer_debt_web_v1',collect)]);assert.equal(collected[0].id,collected[1].id);assert.equal(Number(collected[0].amount),10);pass('duplicate customer collection creates one payment');
 await assert.rejects(rpc(b,'collect_sharikx2_customer_debt_web_v1',{...collect,p_amount:5}),/REQUEST_PAYLOAD_CHANGED/);pass('customer collection request ID cannot change amount');
}catch(error){results.push({name:'integration',result:'FAIL',reason:error.message});console.error('FAIL',error.message);process.exitCode=1;}
finally{
 if(project?.id&&owner){
  try{const deleted=await rpc(owner,'delete_sharikx2_project_v1',{p_project_id:project.id,p_owner_phone:phone,p_owner_password:password});assert.equal(deleted.status,'deleted');pass('fresh disposable project cleaned up');}
  catch(error){results.push({name:'cleanup',result:'FAIL',projectId:project.id,reason:error.message});console.error('CLEANUP_FAILED',project.id,error.message);process.exitCode=1;}
 }
 await writeFile('integration-results.json',JSON.stringify({at:new Date().toISOString(),results},null,2));
}
