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
    try {const saved=JSON.parse(storage?.getItem(this.sessionKey)||'null');if(saved?.access_token&&saved?.refresh_token&&Number.isFinite(saved.expires_at))this.auth=saved;}catch{}
  }
  clearSession(){this.generation++;this.auth=null;try{this.storage?.removeItem(this.sessionKey);}catch{}}
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
    if(!this.refreshing) this.refreshing=(async()=>{
      const generation=this.generation;
      const old=this.auth;
      const data=await this.fetch(old?.refresh_token?'/auth/v1/token?grant_type=refresh_token':'/auth/v1/signup',{method:'POST',body:JSON.stringify(old?.refresh_token?{refresh_token:old.refresh_token}:{})});
      if(generation!==this.generation)throw new Error('SESSION_CLOSED');
      if(!data?.access_token||!data?.refresh_token)throw new Error('INVALID_AUTH_RESPONSE');
      this.auth={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()/1000+Number(data.expires_in||3600)};
      try{this.storage?.setItem(this.sessionKey,JSON.stringify(this.auth));}catch{}
      return data.access_token;
    })().finally(()=>this.refreshing=null);
    return this.refreshing;
  }
  async request(path,options={}) {assertIsolatedPath(path);return this.fetch(path,options,await this.session());}
  rpc(name,body) {return this.request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(body)});}
  restore(phone,password) {return this.rpc('restore_sharikx2_owner_project_v2',{p_owner_phone:phone,p_owner_password:password});}
  join(pin) {return this.rpc('join_sharikx2_project_v1',{p_share_pin:pin});}
  summary(id) {return this.rpc('get_sharikx2_financial_summary_v2',{p_project_id:id});}
  updateCurrency(id,value){return this.request(`/rest/v1/sharikx2_projects?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({currency:value})});}
  debts(id) {return this.rpc('get_sharikx2_debt_balances_v2',{p_project_id:id});}
  async createCustomer(projectId,customer){
    const payload={id:customer.id,project_id:projectId,name:customer.name,phone:customer.phone,opening_debt:0};
    try{return (await this.request('/rest/v1/sharikx2_customers',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)}))[0];}
    catch(error){if(error.status!==409)throw error;const existing=await this.rows('customers',projectId,'*',0,{id:`eq.${customer.id}`});if(existing[0]?.name===customer.name&&existing[0]?.phone===customer.phone)return existing[0];throw new Error('رقم الجوال مسجل لزبون آخر؛ اختره من القائمة');}
  }
  rows(table,id,select='*',offset=0,filters={}) {
    if(!/^[a-z_]+$/.test(table)||!Number.isInteger(offset)||offset<0)throw new Error('INVALID_QUERY');
    const query=new URLSearchParams({project_id:`eq.${id}`,select,limit:'20',offset:String(offset),order:['products','customers','suppliers'].includes(table)?'name.asc,id.asc':'created_at.desc,id.desc'});
    for(const [key,value] of Object.entries(filters)){if(!/^[a-z_]+$/.test(key)||['project_id','select','limit','offset','order'].includes(key))throw new Error('INVALID_FILTER');query.set(key,value);}
    return this.request(`/rest/v1/sharikx2_${table}?${query}`).then(rows=>table==='products'?rows.map(row=>({...row,unit:row.base_unit,sale_price:row.default_sale_price})):rows);
  }
  sale(id,saleId) {return this.rows('sales',id,'*,customer:sharikx2_customers(name,phone),items:sharikx2_sale_items(*),returns:sharikx2_sale_returns(*,items:sharikx2_sale_return_items(*)),payment_account:sharikx2_accounts(name)',0,{id:`eq.${saleId}`}).then(rows=>{const sale=rows[0];if(!sale)return null;return {...sale,items:(sale.items||[]).map(x=>({...x,quantity_pieces:x.quantity,unit_price:x.unit_sale_price})),returns:(sale.returns||[]).map(r=>({...r,items:(r.items||[]).map(x=>({...x,quantity_pieces:x.quantity}))}))};});}
}
