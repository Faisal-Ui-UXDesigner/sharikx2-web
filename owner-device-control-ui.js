import {escape} from './ui.js';
import {auditTimestamp} from './date-display.js';
import {deviceRequestFence} from './owner-device-control.js';
export function ownerDeviceBanner(info,{refresh=true}={}){
 if(!info?.is_active||!info.requested_device_id)return '';
 let valid=true;try{deviceRequestFence(info);}catch{valid=false;}
 return `<section class="op-banner warn owner-device-request"><b>جهاز آخر يطلب التحكم بالمحل</b><small>${escape(info.requested_device_name||'جهاز آخر')}. إذا وافقت، هذا الجهاز يتوقف عن تسجيل العمليات.</small>${info.requested_at?`<small>وقت الطلب: <bdi>${escape(auditTimestamp(info.requested_at))}</bdi></small>`:''}<div class="op-row"><button type="button" class="outline small" data-approve-device ${valid?'':'disabled'}>موافقة</button><button type="button" class="outline small" data-reject-device ${valid?'':'disabled'}>رفض الطلب</button>${refresh?'<button type="button" class="ghost small" data-refresh-device>تحديث الحالة</button>':''}</div></section>`;
}
export function ownerDeviceDetails(info,deviceId,pending){
 const controls=info?.is_active,mine=info?.requested_device_id===deviceId;
 return `<h2>جهاز واحد للتسجيل</h2><p class="muted">حتى لا تتسجل نفس المبيعة مرتين، جهاز واحد فقط يقدر يبيع ويعدّل في نفس الوقت.</p>
 <section class="op-card owner-device-current"><div class="op-row"><span><b>${controls?'يتحكم الآن':'جهاز آخر يتحكم الآن'}</b><small class="muted">${escape(info?.active_device_name||'غير متاح')}</small></span><b class="${controls?'ok':'warn'}">${controls?'هذا الجهاز':'ليس هذا الجهاز'}</b></div>${info?.last_seen_at?`<p class="muted small">آخر اتصال مسجل: <bdi>${escape(auditTimestamp(info.last_seen_at))}</bdi></p>`:''}<div class="op-row"><span>طلبات لم تتأكد نتيجتها على هذا الجهاز</span><b>${pending===null?'غير متاح':pending||'لا يوجد'}</b></div></section>
 ${mine?'<section class="op-banner warn"><b>طلبت التحكم بالمحل</b><small>بانتظار موافقة الجهاز الذي يتحكم الآن. اضغط تحديث الحالة بعد موافقته.</small></section>':controls?'<p class="muted small">للتسجيل من جهاز آخر، اطلب التحكم منه ووافق من هنا بعد التحقق من العمليات المحفوظة.</p>':''}${ownerDeviceBanner(info,{refresh:false})}`;
}
