const reads=new Set(['get_sharikx2_finance_state_v1','get_sharikx2_financial_summary_v2','get_sharikx2_financial_activity_v2','get_sharikx2_debt_balances_v2']);
const devices=new Set(['claim_sharikx2_device_control_v1','request_sharikx2_device_transfer_v1']);
function body(value){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;}catch{}throw new Error('تعذر تحديد نطاق طلب الكتابة');}
function equality(query,key){const values=query.getAll(key);if(values.length!==1||!values[0].startsWith('eq.')||!values[0].slice(3))throw new Error('طلب الكتابة لا يحدد مشروعًا واحدًا');return values[0].slice(3);}
// Explicit READ RPC allowlist: an unknown POST, even one named get_*, must
// not bypass device protection. Direct PATCH/POST share the same boundary.
export function deviceRequestScope(path,options={}){
 const method=(options.method||'GET').toUpperCase();
 const url=new URL(path,'https://isolated.invalid'),rpc=url.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/)?.[1];
 if(['GET','HEAD'].includes(method)){if(rpc&&!reads.has(rpc))throw new Error('لا يمكن تنفيذ خدمة كتابة بطريقة القراءة');return {kind:'read'};}
 if(rpc){
  if(method!=='POST')throw new Error('طريقة طلب الخدمة غير صالحة');
  if(reads.has(rpc))return {kind:'read'};
  const data=body(options.body);if(typeof data.p_project_id!=='string'||!data.p_project_id.trim())throw new Error('طلب الكتابة لا يحدد مشروعًا واحدًا');
  return {kind:devices.has(rpc)?'device':'write',projectId:data.p_project_id};
 }
 if(!['POST','PATCH','DELETE'].includes(method))throw new Error('طريقة الكتابة غير مدعومة');
 const projectId=method==='POST'?body(options.body).project_id:equality(url.searchParams,url.pathname==='/rest/v1/sharikx2_projects'?'id':'project_id');
 if(method==='PATCH'&&Object.hasOwn(body(options.body),'project_id')&&body(options.body).project_id!==projectId)throw new Error('لا يمكن نقل سجل إلى مشروع آخر');
 if(typeof projectId!=='string'||!projectId.trim())throw new Error('طلب الكتابة لا يحدد مشروعًا واحدًا');return {kind:'write',projectId};
}
export function deviceWriteError(message,code='DEVICE_READ_ONLY'){
 const error=new Error(message);error.code=code;error.notDispatched=true;return error;
}
