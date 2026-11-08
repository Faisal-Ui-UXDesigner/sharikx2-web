import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerInventoryPreferences} from '../owner-inventory-preferences.js';
import {deviceRequestScope} from '../device-write-gate.js';

test('owner inventory reads and saves the native preferences revision and RPC payload',async()=>{
 const calls=[];
 const api={rpc:async(name,args)=>{
  calls.push({name,args});
  return {project_id:'project',revision:7,settings:{custom:['مخصص'],hidden:[],names:[{key:'ألبان',name:'الألبان'}]}};
 }};
 const preferences=ownerInventoryPreferences(api,'project','device');
 const snapshot=await preferences.load();
 assert.equal(snapshot.revision,7);
 assert.deepEqual(snapshot.state.inventoryCustomCategories,['مخصص']);
 await preferences.save({customCategories:['مخصص'],hiddenCategories:[],aliases:{'ألبان':'الألبان'}},7);
 assert.deepEqual(calls,[
  {name:'get_sharikx2_inventory_preferences_v2',args:{p_project:'project'}},
  {name:'save_sharikx2_inventory_preferences_v2',args:{p_project:'project',p_device:'device',p_revision:7,
   p_settings:{custom:['مخصص'],hidden:[],names:[{key:'ألبان',name:'الألبان'}]}}}
 ]);
});

test('foreign or malformed inventory settings are rejected before use',async()=>{
 for(const response of [
  {project_id:'other',revision:1,settings:{custom:[],hidden:[],names:[]}},
  {project_id:'project',revision:-1,settings:{custom:[],hidden:[],names:[]}},
  {project_id:'project',revision:1,settings:{custom:[],hidden:[]}}
 ]){
  await assert.rejects(ownerInventoryPreferences({rpc:async()=>response},'project','device').load(),/تعذر قراءة/);
 }
});

test('inventory preferences read is allowlisted while its save retains the device write boundary',()=>{
 const path='/rest/v1/rpc/';
 assert.deepEqual(deviceRequestScope(path+'get_sharikx2_inventory_preferences_v2',{method:'POST',body:'{"p_project":"project"}'}),{kind:'read'});
 assert.deepEqual(deviceRequestScope(path+'save_sharikx2_inventory_preferences_v2',{method:'POST',body:'{"p_project":"project"}'}),{kind:'write',projectId:'project'});
 assert.throws(()=>deviceRequestScope(path+'save_sharikx2_inventory_preferences_v2',{method:'POST',body:'{}'}));
 assert.throws(()=>deviceRequestScope(path+'save_sharikx2_inventory_preferences_v2',{method:'GET'}));
});
