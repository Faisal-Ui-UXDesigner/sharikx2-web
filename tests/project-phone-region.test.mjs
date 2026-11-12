import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPhone} from '../project-phone.js';
import {createPhoneRegion} from '../project-phone-region.js';
import {Api} from '../api.js';

test('regional local lengths preserve leading zeros and reject country prefixes or missing trunk digits',()=>{
 for(const [country,phone] of [['PS','0591234567'],['EG','01012345678'],['JO','0791234567'],['US','2025550123'],['GB','07700900123']])assert.equal(projectPhone(phone,country),phone);
 for(const [country,phone] of [['PS','059123456'],['PS','05912345678'],['EG','1012345678'],['EG','010123456789'],['US','202555012'],['ZZ','0591234567'],['EG','+201012345678']])assert.throws(()=>projectPhone(phone,country));
 assert.equal(projectPhone('٠١٠١٢٣٤٥٦٧٨','EG'),'01012345678');
});
test('IP lookup is coalesced and requests country only without credentials or referrer',async()=>{
 let calls=0;
 const region=createPhoneRegion({fetch:async(url,options)=>{calls++;assert.equal(url,'https://ipapi.co/country/');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');return {ok:true,text:async()=> 'PS\n'};}});
 assert.deepEqual(await Promise.all([region.ensure(),region.ensure()]),['PS','PS']);assert.equal(calls,1);assert.deepEqual(region.get(),{country:'PS',source:'ip'});
});
test('manual choice wins over an older IP reply; lookup errors and timeouts never guess Palestine',async()=>{
 let resolve;
 const region=createPhoneRegion({fetch:()=>new Promise(done=>resolve=done)});
 const lookup=region.ensure();await Promise.resolve();region.choose('EG');resolve({ok:true,text:async()=> 'PS'});
 assert.equal(await lookup,'EG');assert.deepEqual(region.get(),{country:'EG',source:'manual'});
 for(const fetch of [async()=>{throw Error('offline');},async()=>({ok:false}),async()=>({ok:true,text:async()=>'<html>'}),()=>new Promise(()=>{})]){
  const failed=createPhoneRegion({fetch,timeoutMs:5});assert.equal(await failed.ensure(),null);assert.equal(failed.get().country,null);assert.equal(failed.choose('PS'),'PS');assert.equal(await failed.ensure(),'PS');
 }
});
test('creation and login API guards use the same explicitly selected country',async()=>{
 const api=new Api({url:'https://fixture.invalid',publicKey:''}),requests=[];api.rpc=async(name,args)=>requests.push({name,args});
 await api.restore('٠١٠١٢٣٤٥٦٧٨','1234','EG');await api.createProject('محل','01012345678','1234','EG');
 assert.equal(requests[0].args.p_owner_phone,'01012345678');assert.equal(requests[1].args.p_owner_phone,'01012345678');
 assert.throws(()=>api.restore('01012345678','1234','PS'),/10 أرقام/);assert.equal(requests.length,2);
});
