// A logical operation owns one request ID. Retry it, never regenerate it on timeout.
export function createOperation(rpc,payload,requestId=crypto.randomUUID()){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw new Error('INVALID_REQUEST_ID');
  const frozen=JSON.stringify({...payload,p_request_id:requestId});
  let running=null,result,completed=false;
  return {requestId,run(api){
    if(completed)return Promise.resolve(result);
    if(running)return running;
    running=api.rpc(rpc,JSON.parse(frozen)).then(value=>{result=value;completed=true;return value;}).finally(()=>{running=null;});
    return running;
  }};
}
