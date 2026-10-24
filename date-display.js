export const PALESTINE_TIME_ZONE='Asia/Hebron';
const partsFormat=new Intl.DateTimeFormat('en-GB',{timeZone:PALESTINE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const calendar=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>0&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
function parts(epoch){return Object.fromEntries(partsFormat.formatToParts(new Date(epoch)).map(part=>[part.type,part.value]));}
const wall=p=>`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
// API offsets denote instants. Offset-free native audit dates denote Palestine
// wall time, not the viewer's OS zone. Reject calendar overflow and DST gaps.
// At a DST overlap choose the earlier instant deterministically for display.
export function auditInstant(value){
 if(value instanceof Date)return Number.isFinite(value.getTime())?value.getTime():null;
 if(typeof value==='number')return Number.isFinite(value)&&Number.isFinite(new Date(value).getTime())?value:null;
 if(typeof value!=='string')return null;
 const match=/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(value);
 if(!match||!calendar(match[1]))return null;
 const [,day,hour='00',minute='00',second='00',fraction='',zone]=match;
 if(Number(hour)>23||Number(minute)>59||Number(second)>59)return null;
 const local=`${day}T${hour}:${minute}:${second}`,milliseconds=Number((fraction.slice(1)+'000').slice(0,3));
 if(zone){
  if(zone!=='Z'){const z=zone.slice(1).replace(':','');if(Number(z.slice(0,2))>23||Number(z.slice(2))>59)return null;}
  const instant=Date.parse(local+fraction+zone);return Number.isFinite(instant)?instant:null;
 }
 const naive=Date.parse(local+'Z'),offsets=new Set();
 for(const delta of [-36,-12,0,12,36]){const probe=naive+delta*3600000;offsets.add(Date.parse(wall(parts(probe))+'Z')-probe);}
 const candidates=[...offsets].map(offset=>naive-offset).filter(epoch=>wall(parts(epoch))===local).sort((a,b)=>a-b);
 return candidates.length?candidates[0]+milliseconds:null;
}
const display=new Intl.DateTimeFormat('ar-u-nu-latn',{timeZone:PALESTINE_TIME_ZONE,weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function auditTimestamp(value){const instant=auditInstant(value);return instant===null?'تاريخ غير متوفر':display.format(new Date(instant));}
