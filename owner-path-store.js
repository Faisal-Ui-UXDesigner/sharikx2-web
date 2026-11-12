// New-model (accounting_version 2) server flows for the web, ported from the Android
// OwnerPathFlow / OpeningMoneyFlow / OpeningStockFlow / OpeningProjectCreation.
// Every financial value shown as a result comes from the server. A request identity is written to
// localStorage BEFORE it is sent, so a lost reply is checked (status) instead of being sent twice.
import {readDeviceIdentity} from './device-control.js';
import {projectPhone} from './project-phone.js';
import {readOwnerJournal as local,writeOwnerJournal as persist,removeOwnerJournal} from './owner-path-storage.js';

const uuid=()=>globalThis.crypto.randomUUID();
export const FREE_PRODUCTS=50;

export function deviceId(api,storage=window.localStorage){return readDeviceIdentity(storage,api.config.url,{create:true});}

/** Exact decimal input: Arabic digits accepted, never rounded, never turned into zero. */
export function number(raw,scale,cap,optional=false){
  const text=String(raw??'').trim();
  if(!text){if(optional)return '';throw new Error('VALUE_REQUIRED');}
  const value=text.replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace('٫','.');
  if(!new RegExp(`^[0-9]+(?:\\.[0-9]{1,${scale}})?$`).test(value))throw new Error('INVALID_NUMBER');
  const clean=value.replace(/^0+(?=\d)/,'');
  if(Number(clean)>=Number(cap))throw new Error('INVALID_NUMBER');
  return clean;
}

function scoped(value,project){
  if(!value||value.project_id!==project||Number(value.accounting_version)!==2)throw new Error('وصلت بيانات لا تخص هذا المحل. أعد التحميل.');
  return structuredClone(value);
}

/** Owner path: setup sections, partners, lock, sale, purchase, finance. */
export function createOwnerPath({api,project,device,storage=window.localStorage}){
  const key=`owner-path-v2:${project}`;let state=null;
  const call=(action,payload)=>api.rpc('sharikx2_owner_path_v1',{p_project:project,p_device:device,p_action:action,p_payload:payload});
  const read=()=>local(storage,key),write=value=>persist(storage,key,value);
  async function contacts(value){
    const get=table=>api.request(`/rest/v1/${table}?project_id=eq.${encodeURIComponent(project)}&select=id,name&order=name.asc`).catch(()=>null);
    const [customers,suppliers]=await Promise.all([get('sharikx2_customers'),get('sharikx2_suppliers')]);
    if(Array.isArray(customers))value.operating_customers=customers;if(Array.isArray(suppliers))value.operating_suppliers=suppliers;
    return value;
  }
  function snapshot(){if(!state)throw new Error('STATE_REQUIRED');const result=structuredClone(state),saved=read();if(saved.pending)result.pending=saved.pending;return result;}
  async function load(){state=await contacts(scoped(await call('state',{}),project));const saved=read();saved.cached=state;write(saved);return snapshot();}
  function draft(name,value){const saved=read();if(value===undefined)return structuredClone(saved[`draft:${name}`]||{});saved[`draft:${name}`]=value;write(saved);}
  function accept(saved,request,receipt){
    scoped(receipt,project);
    if(receipt.request_id!==request||receipt.status!=='confirmed')throw new Error('نتيجة الطلب غير مؤكدة. تحقق منها قبل المتابعة.');
    saved.receipt=receipt;delete saved.pending;
    if(receipt.action==='sale'){saved['draft:cart']={items:[]};delete saved['draft:payment'];}
    if(receipt.action==='purchase')delete saved['draft:purchase'];
    write(saved);
  }
  async function send(pending){
    if(!pending||typeof pending.action!=='string'||!pending.payload?.request_id)throw new Error('سجل الطلب غير مكتمل؛ تحقق منه قبل المتابعة');
    if(pending.device!==device)throw new Error('هذا الطلب بدأ من متصفح آخر');
    const payload=structuredClone(pending.payload),result=scoped(await call(pending.action,payload),project);
    if(result.request_id!==payload.request_id)throw new Error('تغيّرت نتيجة الطلب. أعد التحميل.');
    const saved=read();
    if(['prepare_lock','prepare_finance'].includes(pending.action)){
      if(result.status==='confirmed'){accept(saved,payload.request_id,result);return result;}
      if(!result.review_token)throw new Error('REVIEW_REQUIRED');
      saved.pending={...pending,preview:result};write(saved);return result;
    }
    accept(saved,payload.request_id,result);return result;
  }
  async function begin(action,payload){
    if(!state)throw new Error('STATE_REQUIRED');
    const saved=read();if(saved.pending)throw new Error('تحقق من نتيجة الطلب السابق أولاً');
    payload=structuredClone(payload);payload.revision=state.revision;payload.request_id=uuid();
    saved.pending={action,payload,device};write(saved); // stored BEFORE dispatch
    return send(saved.pending);
  }
  async function resolve(kind){
    const saved=read(),pending=saved.pending,request=pending.payload.request_id;
    const result=await call(kind,kind==='status'?{request_id:request}:{request_id:request});
    if(result.status==='confirmed')accept(read(),request,result.receipt);
    else if(kind==='status'&&result.status==='prepared'){const preview=scoped(result.preview,project);const next=read();next.pending={...pending,preview};write(next);}
    else if(result.status==='cancelled'){const next=read();delete next.pending;write(next);}
    else if(kind==='cancel')throw new Error('نتيجة الإلغاء غير مؤكدة. تحقق مرة ثانية.');
    return result;
  }
  async function commit(action){
    const pending=read().pending;if(!pending?.preview)throw new Error('REVIEW_REQUIRED');
    const request=pending.payload.request_id;
    const result=scoped(await call(action,{request_id:request,review_token:pending.preview.review_token}),project);
    accept(read(),request,result);return result;
  }
  return {
    load,snapshot,draft,
    cached(){state=scoped(read().cached,project);return {...snapshot(),local_only:true};},
    command:(action,values)=>begin(action,{values:structuredClone(values)}),
    prepareLock(agreed,missingGoods){
      if(Object.keys(local(storage,`opening-stock-v2:${project}`).saves||{}).length||local(storage,`opening-stock-v2:${project}`).pending||local(storage,`opening-money-v2:${project}`).pending)
        throw new Error('عندك حفظ غير مكتمل في الفلوس أو البضاعة. افتحه وتحقق منه أولاً.');
      return begin('prepare_lock',{partners_agreed:agreed,ack_missing_goods:missingGoods});
    },
    retry:()=>send(read().pending),
    status:()=>resolve('status'),
    cancel:()=>resolve('cancel'),
    commitLock:()=>commit('commit_lock'),
    commitFinance:()=>commit('commit_finance'),
    heldSales:()=>structuredClone(read().held_sales||[]),
    holdSale(){const saved=read();const cart=saved['draft:cart'];if(!cart?.items?.length)return;(saved.held_sales??=[]).push({id:uuid(),cart,payment:saved['draft:payment']||{}});delete saved['draft:cart'];delete saved['draft:payment'];write(saved);},
    resumeHeldSale(id){const saved=read(),rows=saved.held_sales||[],chosen=rows.find(r=>r.id===id);if(!chosen)return;saved.held_sales=rows.filter(r=>r.id!==id);
      if(saved['draft:cart']?.items?.length)saved.held_sales.push({id:uuid(),cart:saved['draft:cart'],payment:saved['draft:payment']||{}});
      saved['draft:cart']=chosen.cart;saved['draft:payment']=chosen.payment;write(saved);},
    deleteHeldSale(id){const saved=read();saved.held_sales=(saved.held_sales||[]).filter(r=>r.id!==id);write(saved);},
  };
}

/** Opening money (Figma 04): server draft → server review → commit with the reviewed token. */
export function createOpeningMoney({api,project,device,storage=window.localStorage}){
  const key=`opening-money-v2:${project}`,read=()=>local(storage,key),write=v=>persist(storage,key,v);
  const rpc=(name,body={})=>api.rpc(name,{...body,p_project:project,p_device:device});
  let state=null;
  const checked=value=>{const v=scoped(value,project);if(!Array.isArray(v.accounts)||v.revision===undefined||!v.source_token)throw new Error('بيانات الفلوس غير مكتملة');return v;};
  const review=(value,request)=>{const v=scoped(value,project);if(v.request_id!==request||!/^[a-f0-9]{64}$/.test(v.review_token||''))throw new Error('تغيّرت المراجعة. أعد المحاولة.');return v;};
  function accept(request,receipt){review(receipt,request);if(receipt.status!=='confirmed')throw new Error('التأكيد غير مكتمل');const saved=read();saved.receipt=receipt;delete saved.pending;write(saved);}
  return {
    async load(){
      state=checked(await rpc('sharikx2_opening_money_state_v1'));const pending=read().pending;
      if(pending){const s=await rpc('sharikx2_opening_money_request_status_v1',{p_request:pending.request_id});
        if(s.status==='confirmed')accept(pending.request_id,s.receipt);
        else if(s.status==='prepared'){const saved=read();saved.pending.preview=review(s.preview,pending.request_id);write(saved);}
        else if(s.status==='cancelled'){const saved=read();delete saved.pending;write(saved);}
        if(s.status==='confirmed')state=checked(await rpc('sharikx2_opening_money_state_v1'));}
      return {...structuredClone(state),pending:read().pending||null};
    },
    async save(values){
      if(read().pending)throw new Error('تحقق من نتيجة المراجعة السابقة أولاً');
      state=checked(await rpc('sharikx2_save_opening_money_draft_v1',{p_revision:state.revision,p_source_token:state.source_token,p_values:values}));
      return structuredClone(state);
    },
    async prepare(){
      const saved=read();
      if(!saved.pending){saved.pending={request_id:uuid(),revision:state.revision,device_id:device};write(saved);}
      const pending=read().pending,request=pending.request_id;
      const s=await rpc('sharikx2_opening_money_request_status_v1',{p_request:request});
      if(s.status==='confirmed'){accept(request,s.receipt);return {status:'confirmed'};}
      if(s.status!=='prepared'&&s.status!=='not_found')throw new Error('تحقق من نتيجة الطلب السابق أولاً');
      const preview=review(s.status==='prepared'?s.preview:await rpc('sharikx2_prepare_opening_money_v1',{p_revision:pending.revision,p_request:request}),request);
      const next=read();next.pending.preview=preview;write(next);return preview;
    },
    async commit(token){
      const pending=read().pending;if(!pending?.preview||pending.preview.review_token!==token)throw new Error('راجع الأرقام مرة ثانية');
      const receipt=await rpc('sharikx2_commit_opening_money_v1',{p_request:pending.request_id,p_review_token:token});accept(pending.request_id,receipt);return receipt;
    },
    async cancel(){
      const pending=read().pending;if(!pending)return;
      const r=await rpc('sharikx2_cancel_opening_money_v1',{p_request:pending.request_id});
      if(r.status==='confirmed')accept(pending.request_id,r.receipt);
      else if(r.status==='cancelled'){const saved=read();delete saved.pending;write(saved);}
      else throw new Error('نتيجة الإلغاء غير مؤكدة. تحقق مرة ثانية.');
    },
  };
}

/** Opening goods (Figma 07–10): save each product, then server review and confirm of the selected ones. */
export function createOpeningStock({api,project,device,storage=window.localStorage}){
  const key=`opening-stock-v2:${project}`,read=()=>local(storage,key),write=v=>persist(storage,key,v);
  const call=(action,payload)=>api.rpc('sharikx2_opening_stock_v1',{p_project:project,p_device:device,p_action:action,p_payload:payload});
  let state=null;
  const checked=value=>{const v=scoped(value,project);if(!Array.isArray(v.products)||typeof v.opening_locked!=='boolean')throw new Error('بيانات البضاعة غير مكتملة');return v;};
  const review=(value,request)=>{const v=scoped(value,project);if(v.request_id!==request||!/^[a-f0-9]{64}$/.test(v.review_token||'')||!Array.isArray(v.lines))throw new Error('تغيّرت المراجعة. أعد المحاولة.');return v;};
  function accept(receipt){const saved=read();review(receipt,saved.pending.request_id);if(receipt.status!=='confirmed')throw new Error('التأكيد غير مكتمل');saved.receipt=receipt;delete saved.pending;write(saved);}
  const snapshot=()=>({...structuredClone(state),pending:read().pending||null,saves:read().saves||{}});
  return {
    snapshot,
    async load(){
      const pending=read().pending;
      if(pending){const r=await call('status',{request_id:pending.request_id});
        if(r.status==='confirmed')accept(r.receipt);
        else if(r.status==='cancelled'){const saved=read();delete saved.pending;write(saved);}
        else if(r.status==='prepared'){const saved=read();saved.pending.preview=review(r.preview,pending.request_id);write(saved);}}
      state=checked(await call('state',{}));return snapshot();
    },
    /** Save one product. The attempt (with its request id) is kept until the server answers. */
    async save(values,source,countedAt){
      if(state.opening_locked)throw new Error('أرقام البداية مثبتة. البضاعة السابقة تحتاج تصحيحاً.');
      if(read().pending)throw new Error('تحقق من نتيجة المراجعة السابقة أولاً');
      const saved=read();saved.saves??={};
      const attempt=saved.saves[values.product_id]||{request_id:uuid(),revision:state.revision,values,source_token:source,counted_at:countedAt};
      saved.saves[values.product_id]=attempt;write(saved);
      state=checked(await call('save',attempt));
      const done=read();delete done.saves[values.product_id];write(done);return snapshot();
    },
    async dropSave(id){
      const saved=read(),attempt=saved.saves?.[id];if(!attempt)return snapshot();
      const r=await call('cancel',{request_id:attempt.request_id});
      if(!['confirmed','cancelled'].includes(r.status))throw new Error('نتيجة الحفظ غير مؤكدة. حاول مرة ثانية.');
      const next=read();delete next.saves[id];write(next);state=checked(await call('state',{}));return snapshot();
    },
    async prepare(ids){
      const saved=read();
      if(!saved.pending){if(!ids.length)throw new Error('اختر صنفاً واحداً على الأقل');saved.pending={request_id:uuid(),revision:state.revision,product_ids:ids,device_id:device};write(saved);}
      const pending=read().pending,request=pending.request_id;
      const s=await call('status',{request_id:request});
      if(s.status==='confirmed'){accept(s.receipt);return {status:'confirmed'};}
      if(s.status!=='prepared'&&s.status!=='not_found')throw new Error('تم إلغاء الطلب السابق. أعد التحديد.');
      const preview=review(s.status==='prepared'?s.preview:await call('prepare',{request_id:request,revision:pending.revision,product_ids:pending.product_ids}),request);
      const next=read();next.pending.preview=preview;write(next);return preview;
    },
    async commit(token){
      const pending=read().pending;if(!pending?.preview||pending.preview.review_token!==token)throw new Error('راجع الأرقام مرة ثانية');
      const receipt=await call('commit',{request_id:pending.request_id,review_token:token});accept(receipt);return receipt;
    },
    async cancel(){
      const pending=read().pending;if(!pending)return;
      const r=await call('cancel',{request_id:pending.request_id});
      if(r.status==='confirmed')accept(r.receipt);
      else if(r.status==='cancelled'){const saved=read();delete saved.pending;write(saved);}
      else throw new Error('نتيجة الإلغاء غير مؤكدة. تحقق مرة ثانية.');
    },
  };
}

/** New shop creation: one durable request id; «not found» never creates a second shop id. */
export function createOpeningProject({api,storage=window.localStorage}){
  const device=deviceId(api,storage),key=`opening-creation-v2:${device}`;
  const read=()=>{const value=local(storage,key);return Object.keys(value).length?value:null;};
  const accept=(pending,receipt)=>{
    if(receipt?.status!=='created'||Number(receipt.accounting_version)!==2||receipt.request_id!==pending.request_id||receipt.project?.id!==receipt.project_id)
      throw new Error('نتيجة إنشاء المحل غير مؤكدة. حاول مرة ثانية بنفس البيانات.');
    removeOwnerJournal(storage,key);return receipt.project;
  };
  return {
    pending:()=>{const p=read();return p?{name:p.name,phone:p.phone}:null;},
    forget:()=>removeOwnerJournal(storage,key),
    async create(name,phone,pin){
      name=String(name||'').trim();phone=projectPhone(phone);
      if(name.length<2||!/^[0-9]{4}$/.test(pin||''))throw new Error('اكتب اسم المحل ورقم الجوال ورقماً سرياً من 4 أرقام');
      let pending=read();
      if(!pending){pending={request_id:uuid(),name,phone,device_id:device};persist(storage,key,pending);} // PIN is never stored
      else if(pending.name!==name||pending.phone!==phone)throw new Error(`عندك طلب إنشاء سابق باسم «${pending.name}». أكمله بنفس الاسم والرقم أولاً.`);
      const status=await api.rpc('sharikx2_opening_creation_status_v1',{p_request:pending.request_id,p_device:device});
      if(status?.status==='created')return accept(pending,status);
      if(status?.status!=='not_found')throw new Error('نتيجة إنشاء المحل غير مؤكدة. حاول مرة ثانية.');
      return accept(pending,await api.rpc('sharikx2_create_opening_project_v1',{p_request:pending.request_id,p_device:device,p_name:name,p_phone:phone,p_pin:pin}));
    },
  };
}
