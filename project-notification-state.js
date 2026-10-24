import {notificationSignature} from './project-notifications.js';

// Deliberately ephemeral: create a new store for each opened login/project.
// No tokens, project data or read markers are persisted across accounts/reloads.
export function createNotificationReadState(){
 let seen='';
 return Object.freeze({
  hasUnread(rows){return rows.length>0&&notificationSignature(rows)!==seen;},
  markSeen(signature){if(typeof signature!=='string')throw new TypeError('INVALID_NOTIFICATION_SIGNATURE');seen=signature;}
 });
}
