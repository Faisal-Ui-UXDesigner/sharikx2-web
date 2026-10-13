// Android SubscriptionRules.hasActive: active, and either no expiry or not expired.
export function hasActiveSubscription(project, now = Date.now()) {
  const value = project?.subscription_expires_at;
  const expires = typeof value === 'number' ? value : Date.parse(value || '') || 0;
  return project?.subscription_status === 'active' && (expires <= 0 || now < expires);
}

// Android SubscriptionRules uses a 30-day trial; this is UI eligibility, not a server grant.
export function isTrialExpired(project,now=Date.now()){
 if(!Number.isFinite(now))throw new Error('وقت التحقق غير صالح');
 const time=value=>{
  if(value===undefined||value===null||value==='')return 0;
  const result=typeof value==='number'?value:Date.parse(value);
  if(!Number.isFinite(result))throw new Error('تاريخ الاشتراك غير صالح');return result;
 };
 if(project?.subscription_status==='active'){const expires=time(project.subscription_expires_at);return expires>0&&now>=expires;}
 const started=time(project?.trial_started_at_ms??project?.trial_started_at),start=started>0?started:now;
 return now>=start+30*24*60*60*1000;
}

export function canWithdrawProfits(project,now=Date.now()){
 if(!project||project.subscription_status==='suspended')return false;
 // V2 join responses do not always contain the Android device's trial start.
 // Never restart an unknown trial from the time this web page was opened.
 if(project.subscription_status!=='active'){
  const started=project.trial_started_at_ms??project.trial_started_at;
  if(started===undefined||started===null||started===''||started===0)return false;
  if((typeof started==='number'?started:Date.parse(started))<=0)return false;
 }
 return !isTrialExpired(project,now);
}
