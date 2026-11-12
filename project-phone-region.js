import {phoneCountry} from './project-phone.js';

// Country only: no GPS permission and no phone/project data in the lookup request.
export function createPhoneRegion({fetch=globalThis.fetch,timeoutMs=3500}={}){
 let country=null,source='unknown',pending=null,generation=0;
 return Object.freeze({
  get:()=>({country,source}),
  choose(value){const next=phoneCountry(value);if(!next)throw Error('اختر بلدًا صالحًا');generation++;country=next;source='manual';return country;},
  ensure(){
   if(country)return Promise.resolve(country);
   if(pending)return pending;
   const request=generation,controller=new AbortController();
   let timeout;
   pending=Promise.race([
    Promise.resolve().then(()=>fetch('https://ipapi.co/country/',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'})).then(async response=>{
     if(!response.ok)throw Error('Country lookup failed');
     const found=phoneCountry(await response.text());if(!found)throw Error('Invalid country');return found;
    }),
    new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(Error('Country lookup timeout'));},timeoutMs);})
   ]).then(found=>{if(request===generation){country=found;source='ip';}return country;},()=>country)
    .finally(()=>clearTimeout(timeout));
   return pending;
  }
 });
}
export const projectPhoneRegion=createPhoneRegion();
