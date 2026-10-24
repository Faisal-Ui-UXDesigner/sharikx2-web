import {requireProductResult,productMatchesPayload} from './product-contract.js';
import {PAGE_SIZE,requirePage,collectPages} from './pagination.js';
import {projectCurrencyPayload,projectCurrencyResult} from './currency.js';
import {customerCreatePayload,requireCreatedCustomer} from './customer-contract.js';
import {supplierChanges,supplierUpdateResult} from './supplier-contract.js';
import {customerEditChanges,customerUpdateResult} from './customer-edit.js';
import {supplierCreatePayload,supplierCreateResult} from './supplier-create.js';
import {sharePin,sharingProjectResult,sharingSaveResult} from './project-sharing.js';
import {controlDeviceId,deviceControlRows,deviceControlPayload,readDeviceIdentity} from './device-control.js';
import {deviceRequestScope,deviceWriteError} from './device-write-gate.js';
import {supplierRefundSnapshot} from './supplier-refund.js';
import {downloadReceipt} from './receipt-api.js';
import {SUBSCRIPTION_SETTINGS_PATH,subscriptionPaymentSettings} from './subscription-details.js';
import {loadSubscriptionRequests} from './subscription-requests.js';
import {changeOwnerPassword} from './owner-password.js';
import {receiptOwner,receiptRecord,uploadReceiptObject,linkReceipt,paymentReceiptOwner,uploadPaymentReceipt,paymentReceiptRecord} from './receipt-upload-api.js';

function storedSession(value){
  if(typeof value?.access_token!=='string'||!value.access_token||typeof value.refresh_token!=='string'||!value.refresh_token||!Number.isFinite(value.expires_at)||value.expires_at<=0)return null;
  return {access_token:value.access_token,refresh_token:value.refresh_token,expires_at:value.expires_at};
}

export function assertIsolatedPath(path) {
  const endpoint = path.split('?')[0];
  if (!/^\/rest\/v1\/(sharikx2_[a-z0-9_]+|rpc\/[a-z0-9_]*sharikx2_[a-z0-9_]+)$/.test(endpoint)) throw new Error('BLOCKED_LEGACY_ENDPOINT');
}
export function netMonthlySales(rows) {
  return rows.filter(r => !['pending','cancelled'].includes(r.status)).reduce((sum,r) => sum + Number(r.total || 0),0);
}
export class Api {
  receiptBlob(options){return downloadReceipt(this,options);}
  receiptOwner(target){return receiptOwner(this,target);}
  receiptRecord(target){return receiptRecord(this,target);}
  uploadReceiptObject(intent,file){return uploadReceiptObject(this,intent,file);}
  linkReceipt(intent){return linkReceipt(this,intent);}
  paymentReceiptOwner(scope){return paymentReceiptOwner(this,scope);}
  uploadPaymentReceipt(intent,file){return uploadPaymentReceipt(this,intent,file);}
  paymentReceiptRecord(scope,id,amount){return paymentReceiptRecord(this,scope,id,amount);}
  async subscriptionPaymentSettings(){
    const generation=this.generation,rows=await this.request(SUBSCRIPTION_SETTINGS_PATH,{cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
    this.assertGeneration(generation);return subscriptionPaymentSettings(rows);
  }
  subscriptionRequests(projectId){return loadSubscriptionRequests(this,projectId);}
  changeOwnerPassword(projectId,current,next,confirmation){return changeOwnerPassword(this,projectId,current,next,confirmation);}
  constructor(config,storage=null) {
    this.config=config;this.auth=null;this.refreshing=null;this.generation=0;this.storage=storage;this.deviceContext=null;this.deviceEpoch=0;
    this.sessionKey=`sharikx2-auth:${config.url}`;
    try {this.auth=storedSession(JSON.parse(storage?.getItem(this.sessionKey)||'null'));}catch{}
  }
  clearSession(){this.generation++;this.auth=null;this.refreshing=null;this.clearDeviceContext();try{this.storage?.removeItem(this.sessionKey);}catch{}}
  clearDeviceContext(){this.deviceEpoch++;this.deviceContext=null;}
  setDeviceContext({projectId,mode,identityStorage}){
    if(typeof projectId!=='string'||!projectId.trim()||!['owner','viewer'].includes(mode))throw new Error('سياق حماية الجهاز غير صالح');
    this.deviceEpoch++;this.deviceContext=Object.freeze({projectId,mode,identityStorage});
  }
  assertDeviceEpoch(epoch,dispatched=false){if(epoch!==this.deviceEpoch){const error=deviceWriteError(dispatched?'تغيّر المشروع بعد الطلب؛ أعد التحقق من نتيجته الأصلية':'تغيّر المشروع أثناء التحقق؛ لم يُرسل طلب جديد','DEVICE_CONTEXT_CHANGED');if(dispatched)delete error.notDispatched;throw error;}}
  async assertDeviceWrite(projectId){
    const context=this.deviceContext,epoch=this.deviceEpoch,generation=this.generation;
    if(!context)return; // Onboarding/initial seed, before an opened project.
    if(context.mode!=='owner'||context.projectId!==projectId)throw deviceWriteError('التعديل متاح لمالك المشروع الحالي فقط');
    if(globalThis.navigator?.onLine===false)throw deviceWriteError('يلزم الاتصال بالإنترنت للتحقق من الجهاز المسؤول');
    const identity=()=>readDeviceIdentity(context.identityStorage,this.config.url),deviceId=identity();
    const row=await this.deviceControl(projectId);this.assertGeneration(generation);this.assertDeviceEpoch(epoch);
    if(!row||row.active_device_id!==deviceId)throw deviceWriteError('هذا المتصفح ليس الجهاز المسؤول؛ افتح حماية الجهاز لتسجيله أو طلب نقل التحكم');
    // Native claim renews ONLY an already matching controller here. First
    // registration requires an explicit action in the device dialog.
    if(identity()!==deviceId)throw deviceWriteError('تغيّرت هوية المتصفح قبل الحفظ');
    const ack=deviceControlPayload(await this.rpc('claim_sharikx2_device_control_v1',{p_project_id:projectId,p_device_id:deviceId,p_device_name:'متصفح SharikX2'}));
    this.assertGeneration(generation);this.assertDeviceEpoch(epoch);
    if(!ack.is_active||ack.generation!==row.generation||identity()!==deviceId)throw deviceWriteError('انتقل التحكم أثناء التحقق؛ لم يُرسل طلب الحفظ');
    return deviceId;
  }
  assertGeneration(generation){if(generation!==this.generation)throw new Error('SESSION_CLOSED');}
  async fetch(path, options={}, token=this.config.publicKey) {
    if (!this.config.publicKey) throw new Error('إعداد اتصال الويب غير مكتمل بعد');
    const started=performance.now();
    const response=await fetch(this.config.url+path,{...options,headers:{apikey:this.config.publicKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(25000)});
    const payload=await response.json().catch(()=>null);
    console.debug('[SharikX2 request]',path.split('?')[0],Math.round(performance.now()-started),response.status);
    if(!response.ok){const error=new Error(payload?.message||payload?.error_description||'تعذر الاتصال بالسيرفر');error.status=response.status;throw error;}
    return payload;
  }
  async session() {
    if(this.auth && this.auth.expires_at>Date.now()/1000+60) return this.auth.access_token;
    if(!this.refreshing){
      const pending=(async()=>{
        const generation=this.generation;
        const old=this.auth;
        const path=old?.refresh_token?'/auth/v1/token?grant_type=refresh_token':'/auth/v1/signup';
        const body=old?.refresh_token?{refresh_token:old.refresh_token}:{};
        const data=await this.fetch(path,{method:'POST',body:JSON.stringify(body)});
        this.assertGeneration(generation);
        const lifetime=Number(data?.expires_in??3600);
        if(typeof data?.access_token!=='string'||!data.access_token||typeof data.refresh_token!=='string'||!data.refresh_token||!Number.isFinite(lifetime)||lifetime<=0)throw new Error('INVALID_AUTH_RESPONSE');
        this.auth={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()/1000+lifetime};
        try{this.storage?.setItem(this.sessionKey,JSON.stringify(this.auth));}catch{}
        return data.access_token;
      })().finally(()=>{if(this.refreshing===pending)this.refreshing=null;});
      this.refreshing=pending;
    }
    return this.refreshing;
  }
  async request(path,options={}) {
    assertIsolatedPath(path);
    options={...options,headers:options.headers?{...options.headers}:undefined};
    if(options.body!==undefined&&typeof options.body!=='string')throw new Error('طلب الشبكة يجب أن يكون ملتقطًا كنص ثابت');
    const generation=this.generation,deviceEpoch=this.deviceEpoch;let writeIdentity;
    if(this.deviceContext){
      const scope=deviceRequestScope(path,options);
      if(scope.kind!=='read'){
        if(this.deviceContext.mode!=='owner'||scope.projectId!==this.deviceContext.projectId)throw deviceWriteError('طلب التعديل لا يخص مشروع المالك الحالي');
        if(scope.kind==='write')writeIdentity=await this.assertDeviceWrite(scope.projectId);
      }
    }
    this.assertGeneration(generation);this.assertDeviceEpoch(deviceEpoch);
    const token=await this.session();
    this.assertGeneration(generation);
    this.assertDeviceEpoch(deviceEpoch);
    if(writeIdentity&&readDeviceIdentity(this.deviceContext.identityStorage,this.config.url)!==writeIdentity)throw deviceWriteError('تغيّرت هوية المتصفح قبل إرسال الحفظ');
    const result=await this.fetch(path,options,token);
    this.assertGeneration(generation);
    this.assertDeviceEpoch(deviceEpoch,true);
    return result;
  }
  rpc(name,body) {return this.request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(body)});}
  restore(phone,password) {return this.rpc('restore_sharikx2_owner_project_v2',{p_owner_phone:phone,p_owner_password:password});}
  createProject(name,phone,password) {return this.rpc('create_sharikx2_project_v3',{p_name:name,p_owner_phone:phone,p_owner_password:password,p_wallet_1_name:'بال باي',p_wallet_2_name:'جوال باي'});}
  saveFinanceState(id,state,revision=0) {return this.rpc('save_sharikx2_finance_state_v1',{p_project_id:id,p_state:state,p_expected_revision:revision});}
  transferOpening(id,from,to,amount) {return this.rpc('transfer_sharikx2_account_v2',{p_project_id:id,p_from_account_id:from,p_to_account_id:to,p_amount:amount,p_note:'توزيع رأس المال الافتتاحي'});}
  join(pin) {return this.rpc('join_sharikx2_project_v1',{p_share_pin:pin});}
  async deviceControl(projectId){
    if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');const generation=this.generation;
    const query=new URLSearchParams({project_id:`eq.${projectId}`,select:'project_id,active_device_id,active_device_name,generation,last_seen_at,requested_device_id,requested_device_name,requested_at',limit:'2'});
    const rows=await this.request(`/rest/v1/sharikx2_device_control?${query}`);this.assertGeneration(generation);return deviceControlRows(rows,projectId);
  }
  async requestDeviceTransfer(projectId,deviceId,deviceName){
    if(typeof projectId!=='string'||!projectId.trim()||typeof deviceName!=='string'||!deviceName.trim()||deviceName.length>120)throw new Error('بيانات طلب الجهاز غير صالحة');
    const captured=controlDeviceId(deviceId),generation=this.generation;
    const result=await this.rpc('request_sharikx2_device_transfer_v1',{p_project_id:projectId,p_device_id:captured,p_device_name:deviceName});this.assertGeneration(generation);return deviceControlPayload(result);
  }
  async claimDeviceControl(projectId,deviceId){
    if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');const captured=controlDeviceId(deviceId),generation=this.generation;
    const result=await this.rpc('claim_sharikx2_device_control_v1',{p_project_id:projectId,p_device_id:captured,p_device_name:'متصفح SharikX2'});this.assertGeneration(generation);return deviceControlPayload(result);
  }
  async sharingProject(projectId){
    if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');const generation=this.generation;
    const rows=await this.request(`/rest/v1/sharikx2_projects?id=eq.${encodeURIComponent(projectId)}&select=id,name,share_pin,subscription_status,subscription_expires_at,archived_at&limit=1`);this.assertGeneration(generation);return sharingProjectResult(rows,projectId);
  }
  async setSharingPin(projectId,pin){
    if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');const captured=sharePin(pin),generation=this.generation;
    const result=await this.rpc('set_sharikx2_share_pin_v1',{p_project_id:projectId,p_share_pin:captured});this.assertGeneration(generation);return sharingSaveResult(result,projectId,captured);
  }
  summary(id) {return this.rpc('get_sharikx2_financial_summary_v2',{p_project_id:id});}
  financialActivity(id,from=null,to=null) {return this.rpc('get_sharikx2_financial_activity_v2',{p_project_id:id,p_from:from,p_to:to});}
  financeState(id) {return this.rpc('get_sharikx2_finance_state_v1',{p_project_id:id});}
  async projectCreatedAt(projectId){
    if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');
    const generation=this.generation;
    const rows=await this.request(`/rest/v1/sharikx2_projects?id=eq.${encodeURIComponent(projectId)}&select=id,created_at&limit=1`);
    this.assertGeneration(generation);
    if(!Array.isArray(rows)||rows.length!==1||rows[0]?.id!==projectId||typeof rows[0].created_at!=='string'||!Number.isFinite(Date.parse(rows[0].created_at))||Date.parse(rows[0].created_at)<=0)throw new Error('تعذر قراءة تاريخ بداية المشروع');
    return rows[0].created_at;
  }
  async allRows(table,id,select='*',filters={}) {
    const generation=this.generation,queryFilters=Object.freeze({...filters});
    return collectPages(offset=>this.rows(table,id,select,offset,queryFilters),{assertCurrent:()=>this.assertGeneration(generation)});
  }
  async updateCurrency(id,value,expectedCurrency){
    const payload=projectCurrencyPayload(id,value);
    if(expectedCurrency!==undefined&&expectedCurrency!==null&&!/^[A-Za-z]{3}$/.test(String(expectedCurrency)))throw new Error('تعذر قراءة العملة الحالية؛ أعد تحميل المشروع');
    const predicate=expectedCurrency===undefined?'':expectedCurrency===null?'&currency=is.null':`&currency=eq.${encodeURIComponent(expectedCurrency)}`;
    const rows=await this.request(`/rest/v1/sharikx2_projects?id=eq.${encodeURIComponent(id)}${predicate}&select=id,currency`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
    return projectCurrencyResult(rows,id,payload.currency);
  }
  debts(id) {return this.rpc('get_sharikx2_debt_balances_v2',{p_project_id:id});}
  async supplierHistory(projectId,supplierId){
    if(typeof projectId!=='string'||!projectId||typeof supplierId!=='string'||!supplierId)throw new Error('بيانات المورد غير صالحة');
    const generation=this.generation;
    const history=await this.rpc('get_sharikx2_supplier_history_v1',{p_project_id:projectId,p_supplier_id:supplierId});
    this.assertGeneration(generation);
    if(!history||history.supplier?.id!==supplierId||history.supplier.project_id!==projectId||!Array.isArray(history.purchases))throw new Error('تعذر قراءة سجل المورد');
    // Native supplements the atomic ledger with initial payment/credit sources.
    // Reject changed identities; never combine a partial or new invoice set with old links.
    const sources=await this.allRows('purchases',projectId,'id,credit_applications:sharikx2_supplier_credit_applications(amount,created_at),payments:sharikx2_purchase_payments(amount,account:sharikx2_accounts(name))',{supplier_id:`eq.${supplierId}`});
    this.assertGeneration(generation);
    const byId=new Map();
    for(const row of sources){if(typeof row?.id!=='string'||byId.has(row.id)||!Array.isArray(row.payments)||!Array.isArray(row.credit_applications))throw new Error('تغير سجل فواتير المورد؛ أعد التحميل');byId.set(row.id,row);}
    if(byId.size!==history.purchases.length||new Set(history.purchases.map(row=>row?.id)).size!==history.purchases.length)throw new Error('تغير سجل فواتير المورد؛ أعد التحميل');
    const purchases=history.purchases.map(row=>{const source=byId.get(row?.id);if(!source)throw new Error('تغير سجل فواتير المورد؛ أعد التحميل');return {...row,payments:source.payments,credit_applications:source.credit_applications};});
    return {...history,purchases};
  }
  updateSupplier(projectId,id,changes) {const captured=supplierChanges(changes);return this.request(`/rest/v1/sharikx2_suppliers?id=eq.${encodeURIComponent(id)}&project_id=eq.${encodeURIComponent(projectId)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(captured)}).then(rows=>supplierUpdateResult(rows,projectId,id,captured));}
  archiveSupplier(projectId,id) {return this.updateSupplier(projectId,id,{active:false});}
  async createSupplier(projectId,supplier){
    const payload=supplierCreatePayload(projectId,supplier);
    try{return supplierCreateResult(await this.request('/rest/v1/sharikx2_suppliers',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)}),payload);}
    catch(error){if(error.status!==409)throw error;return supplierCreateResult(await this.rows('suppliers',projectId,'*',0,{id:`eq.${payload.id}`}),payload);}
  }
  async supplierRefundHistory(projectId,supplierId){
    if(typeof projectId!=='string'||!projectId.trim()||typeof supplierId!=='string'||!supplierId.trim())throw new Error('بيانات المورد غير صالحة');
    return this.allRows('supplier_credit_refunds',projectId,'id,project_id,supplier_id,account_id,amount,note,created_at,account:sharikx2_accounts(name)',{supplier_id:`eq.${supplierId}`});
  }
  async supplierRefundSnapshot(projectId,supplierId){
    if(typeof projectId!=='string'||!projectId.trim()||typeof supplierId!=='string'||!supplierId.trim())throw new Error('بيانات المورد غير صالحة');
    const generation=this.generation;
    const [credits,accounts]=await Promise.all([
      this.allRows('supplier_credits',projectId,'id,project_id,supplier_id,amount,remaining_amount',{supplier_id:`eq.${supplierId}`,remaining_amount:'gt.0'}),
      collectPages(offset=>{
        const query=new URLSearchParams({project_id:`eq.${projectId}`,active:'eq.true',select:'id,project_id,name,active',order:'account_type.asc,name.asc,id.asc',limit:String(PAGE_SIZE),offset:String(offset)});
        return this.request(`/rest/v1/sharikx2_accounts?${query}`);
      },{assertCurrent:()=>this.assertGeneration(generation)})
    ]);
    this.assertGeneration(generation);return supplierRefundSnapshot(projectId,supplierId,credits,accounts);
  }
  supplierCredits(projectId,supplierId) {
    const q=new URLSearchParams({project_id:`eq.${projectId}`,supplier_id:`eq.${supplierId}`,remaining_amount:'gt.0',select:'id,amount,remaining_amount,source_purchase_id,created_at',order:'created_at.asc,id.asc'});
    return this.request(`/rest/v1/sharikx2_supplier_credits?${q}`).catch(error=>{if(error.status===404)return [];throw error;});
  }
  async createCustomer(projectId,customer){
    const payload=customerCreatePayload(projectId,customer);
    try{return requireCreatedCustomer(await this.request('/rest/v1/sharikx2_customers',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)}),payload);}
    catch(error){if(error.status!==409)throw error;const existing=await this.rows('customers',projectId,'*',0,{id:`eq.${payload.id}`});return requireCreatedCustomer(existing,payload);}
  }
  updateCustomer(projectId,id,changes,expected){
    const captured=customerEditChanges(changes);let predicate='';
    if(expected!==undefined){if(typeof expected?.name!=='string'||(expected.phone!==null&&typeof expected.phone!=='string'))throw new Error('بيانات المقارنة للزبون غير صالحة');predicate=`&name=eq.${encodeURIComponent(expected.name)}&phone=${expected.phone===null?'is.null':`eq.${encodeURIComponent(expected.phone)}`}&active=eq.true`;}
    return this.request(`/rest/v1/sharikx2_customers?id=eq.${encodeURIComponent(id)}&project_id=eq.${encodeURIComponent(projectId)}${predicate}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(captured)}).then(rows=>customerUpdateResult(rows,projectId,id,captured));
  }
  rows(table,id,select='*',offset=0,filters={}) {
    if(!/^[a-z_]+$/.test(table)||!Number.isInteger(offset)||offset<0)throw new Error('INVALID_QUERY');
    const query=new URLSearchParams({project_id:`eq.${id}`,select,limit:String(PAGE_SIZE),offset:String(offset),order:['products','customers','suppliers'].includes(table)?'name.asc,id.asc':'created_at.desc,id.desc'});
    for(const [key,value] of Object.entries(filters)){if(!/^[a-z_]+$/.test(key)||['project_id','select','limit','offset','order'].includes(key))throw new Error('INVALID_FILTER');query.set(key,value);}
    return this.request(`/rest/v1/sharikx2_${table}?${query}`).then(rows=>{requirePage(rows);return table==='products'?rows.map(row=>({...row,unit:row.base_unit,sale_price:row.default_sale_price})):rows;});
  }
  sale(id,saleId) {return this.rows('sales',id,'*,customer:sharikx2_customers(name,phone),items:sharikx2_sale_items(*),returns:sharikx2_sale_returns(*,items:sharikx2_sale_return_items(*)),payment_account:sharikx2_accounts(name)',0,{id:`eq.${saleId}`}).then(rows=>{const sale=rows[0];if(!sale)return null;return {...sale,items:(sale.items||[]).map(x=>({...x,quantity_pieces:x.quantity,unit_price:x.unit_sale_price})),returns:(sale.returns||[]).map(r=>({...r,items:(r.items||[]).map(x=>({...x,quantity_pieces:x.quantity}))}))};});}
  async productPurchaseHistory(id,productId) {
    const generation=this.generation;
    return collectPages(offset=>{
      const query=new URLSearchParams({product_id:`eq.${productId}`,select:'id,quantity_pieces,unit_cost,line_total,purchase:sharikx2_purchases!inner(id,project_id,purchased_at,status,supplier:sharikx2_suppliers(name))','purchase.project_id':`eq.${id}`,order:'id.asc',limit:String(PAGE_SIZE),offset:String(offset)});
      return this.request(`/rest/v1/sharikx2_purchase_items?${query}`);
    },{assertCurrent:()=>this.assertGeneration(generation)});
  }
  async createProduct(product) {
    if(!product.id||!product.project_id)throw new Error('بيانات إنشاء الصنف غير مكتملة');
    // Capture the attempt before awaiting: callers cannot alter retry comparisons.
    const payload=JSON.parse(JSON.stringify(product));
    try{
      const rows=await this.request('/rest/v1/sharikx2_products',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
      return requireProductResult(rows,payload.id);
    }catch(error){
      if(error.status!==409)throw error;
      const rows=await this.rows('products',payload.project_id,'*',0,{id:`eq.${payload.id}`});
      if(rows.length===1&&productMatchesPayload(rows[0],payload))return rows[0];
      throw new Error('يوجد تعارض في بيانات الصنف أو الباركود؛ أعد تحميل البضاعة قبل الحفظ');
    }
  }
  async updateProduct(id,changes) {
    const scope=this.deviceContext?`&project_id=eq.${encodeURIComponent(this.deviceContext.projectId)}`:'';
    const rows=await this.request(`/rest/v1/sharikx2_products?id=eq.${encodeURIComponent(id)}${scope}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(changes)});
    return requireProductResult(rows,id);
  }
  async archiveProduct(id) {
    const scope=this.deviceContext?`&project_id=eq.${encodeURIComponent(this.deviceContext.projectId)}`:'';
    const rows=await this.request(`/rest/v1/sharikx2_products?id=eq.${encodeURIComponent(id)}${scope}&quantity_pieces=eq.0&active=eq.true`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({active:false})});
    if(!Array.isArray(rows)||rows.length===0)throw new Error('تعذر حذف الصنف؛ قد تكون كمية المخزون تغيرت. أعد تحميل البضاعة');
    const product=requireProductResult(rows,id);
    if(product.active!==false)throw new Error('تعذر تأكيد حذف الصنف؛ أعد تحميل البضاعة');
    return product;
  }
}
