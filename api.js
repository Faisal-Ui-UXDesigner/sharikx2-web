import {requireProductResult,productMatchesPayload} from './product-contract.js';
import {PAGE_SIZE,requirePage,collectPages} from './pagination.js';
import {projectCurrencyPayload,projectCurrencyResult} from './currency.js';
import {customerCreatePayload,requireCreatedCustomer} from './customer-contract.js';

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
  constructor(config,storage=null) {
    this.config=config;this.auth=null;this.refreshing=null;this.generation=0;this.storage=storage;
    this.sessionKey=`sharikx2-auth:${config.url}`;
    try {this.auth=storedSession(JSON.parse(storage?.getItem(this.sessionKey)||'null'));}catch{}
  }
  clearSession(){this.generation++;this.auth=null;this.refreshing=null;try{this.storage?.removeItem(this.sessionKey);}catch{}}
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
    const generation=this.generation;
    const token=await this.session();
    this.assertGeneration(generation);
    const result=await this.fetch(path,options,token);
    this.assertGeneration(generation);
    return result;
  }
  rpc(name,body) {return this.request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(body)});}
  restore(phone,password) {return this.rpc('restore_sharikx2_owner_project_v2',{p_owner_phone:phone,p_owner_password:password});}
  createProject(name,phone,password) {return this.rpc('create_sharikx2_project_v3',{p_name:name,p_owner_phone:phone,p_owner_password:password,p_wallet_1_name:'بال باي',p_wallet_2_name:'جوال باي'});}
  saveFinanceState(id,state,revision=0) {return this.rpc('save_sharikx2_finance_state_v1',{p_project_id:id,p_state:state,p_expected_revision:revision});}
  transferOpening(id,from,to,amount) {return this.rpc('transfer_sharikx2_account_v2',{p_project_id:id,p_from_account_id:from,p_to_account_id:to,p_amount:amount,p_note:'توزيع رأس المال الافتتاحي'});}
  join(pin) {return this.rpc('join_sharikx2_project_v1',{p_share_pin:pin});}
  summary(id) {return this.rpc('get_sharikx2_financial_summary_v2',{p_project_id:id});}
  financialActivity(id,from=null,to=null) {return this.rpc('get_sharikx2_financial_activity_v2',{p_project_id:id,p_from:from,p_to:to});}
  financeState(id) {return this.rpc('get_sharikx2_finance_state_v1',{p_project_id:id});}
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
  updateSupplier(projectId,id,changes) {return this.request(`/rest/v1/sharikx2_suppliers?id=eq.${encodeURIComponent(id)}&project_id=eq.${encodeURIComponent(projectId)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(changes)}).then(rows=>{if(!Array.isArray(rows)||rows.length!==1||String(rows[0].id)!==String(id))throw new Error('تعذر تأكيد تعديل المورد');return rows[0];});}
  archiveSupplier(projectId,id) {return this.updateSupplier(projectId,id,{active:false});}
  supplierCredits(projectId,supplierId) {
    const q=new URLSearchParams({project_id:`eq.${projectId}`,supplier_id:`eq.${supplierId}`,remaining_amount:'gt.0',select:'id,amount,remaining_amount,source_purchase_id,created_at',order:'created_at.asc,id.asc'});
    return this.request(`/rest/v1/sharikx2_supplier_credits?${q}`).catch(error=>{if(error.status===404)return [];throw error;});
  }
  async createCustomer(projectId,customer){
    const payload=customerCreatePayload(projectId,customer);
    try{return requireCreatedCustomer(await this.request('/rest/v1/sharikx2_customers',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)}),payload);}
    catch(error){if(error.status!==409)throw error;const existing=await this.rows('customers',projectId,'*',0,{id:`eq.${payload.id}`});return requireCreatedCustomer(existing,payload);}
  }
  updateCustomer(projectId,id,changes){return this.request(`/rest/v1/sharikx2_customers?id=eq.${encodeURIComponent(id)}&project_id=eq.${encodeURIComponent(projectId)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(changes)}).then(rows=>{if(!Array.isArray(rows)||rows.length!==1||String(rows[0].id)!==String(id))throw new Error('تعذر تأكيد تعديل الزبون');return rows[0];});}
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
    const rows=await this.request(`/rest/v1/sharikx2_products?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(changes)});
    return requireProductResult(rows,id);
  }
  async archiveProduct(id) {
    const rows=await this.request(`/rest/v1/sharikx2_products?id=eq.${encodeURIComponent(id)}&quantity_pieces=eq.0&active=eq.true`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({active:false})});
    if(!Array.isArray(rows)||rows.length===0)throw new Error('تعذر حذف الصنف؛ قد تكون كمية المخزون تغيرت. أعد تحميل البضاعة');
    const product=requireProductResult(rows,id);
    if(product.active!==false)throw new Error('تعذر تأكيد حذف الصنف؛ أعد تحميل البضاعة');
    return product;
  }
}
