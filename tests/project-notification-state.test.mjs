import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationReadState} from '../project-notification-state.js';
import {notificationSignature} from '../project-notifications.js';
const row=Object.freeze({key:'subscription',severity:'warning',title:'الاشتراك أوشك على الانتهاء',message:'باقي 5 أيام',createdAt:1});

test('native unread signature ignores body and evaluation timestamp, not title/severity/order',()=>{
 const state=createNotificationReadState(),rows=Object.freeze([row]);
 assert.equal(state.hasUnread(rows),true);state.markSeen(notificationSignature(rows));
 assert.equal(state.hasUnread([{...row,message:'باقي 4 أيام',createdAt:2}]),false);
 assert.equal(state.hasUnread([{...row,title:'الاشتراك منتهي'}]),true);
 assert.equal(state.hasUnread([{...row,severity:'danger'}]),true);
 const other={key:'inventory_stale',severity:'warning',title:'لم تضف بضاعة بعد'};
 state.markSeen(notificationSignature([row,other]));assert.equal(state.hasUnread([other,row]),true);
 assert.equal(row.message,'باقي 5 أيام');assert.equal(Object.isFrozen(state),true);
});
test('empty notifications never unread, including after marking an empty rendered list',()=>{
 const state=createNotificationReadState();assert.equal(state.hasUnread([]),false);
 state.markSeen(notificationSignature([row]));assert.equal(state.hasUnread([]),false);
 state.markSeen('');assert.equal(state.hasUnread([row]),true);
});
test('new project/login/read-state cannot inherit another session marker',()=>{
 const first=createNotificationReadState(),second=createNotificationReadState();
 first.markSeen(notificationSignature([row]));assert.equal(first.hasUnread([row]),false);
 assert.equal(second.hasUnread([row]),true);assert.equal(createNotificationReadState().hasUnread([row]),true);
});
test('malformed seen callback is rejected without replacing the last good signature',()=>{
 const state=createNotificationReadState();state.markSeen(notificationSignature([row]));
 for(const value of [null,undefined,{},1])assert.throws(()=>state.markSeen(value),TypeError);
 assert.equal(state.hasUnread([row]),false);
});
