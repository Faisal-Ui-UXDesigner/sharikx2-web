// Opened-project helpers (2026-11-06):
// 1) remember the opened project in this tab so a reload returns to it (auth token is already per tab);
// 2) refuse NEW-model shops (accounting_version 2): this web app writes the legacy finance model;
// 3) register this browser as the FIRST controlling device automatically (same safe path as the
//    «تسجيل هذا المتصفح كأول جهاز مسؤول» button: never displaces another controller).
import {readDeviceIdentity} from './device-control.js';
import {createDeviceRegistration} from './device-registration.js';

const KEY = 'sharikx2-open-project-v1';

export function rememberProject(storage, project, role) {
  try { storage?.setItem(KEY, JSON.stringify({project, role})); } catch {}
}
export function forgetProject(storage) {
  try { storage?.removeItem(KEY); } catch {}
}
export function savedProject(storage) {
  try {
    const value = JSON.parse(storage?.getItem(KEY) || 'null');
    if (!value || typeof value.project?.id !== 'string' || !['owner', 'viewer'].includes(value.role)) return null;
    return value;
  } catch { return null; }
}

/** 2 for a new-model shop, otherwise null (legacy or unknown: the legacy screens stay the safe default). */
export async function projectAccountingVersion(api,projectId,role){
  if(role!=='owner')return null;
  try{const mode=await api.rpc('sharikx2_project_accounting_mode_v1',{p_project:projectId});return Number(mode?.accounting_version)===2?2:null;}
  catch(error){console.debug('[SharikX2] accounting mode unavailable',String(error?.message||error).slice(0,80));return null;}
}

/** Throws a user-facing message for new-model shops. Server errors (old server, owner on a second
 *  device before the server fix) do not block legacy shops: only an explicit version 2 does. */
export async function assertWebSupportedProject(api, projectId, role) {
  if (role !== 'owner') return;
  let mode = null;
  try { mode = await api.rpc('sharikx2_project_accounting_mode_v1', {p_project: projectId}); }
  catch (error) { console.debug('[SharikX2] accounting mode unavailable', String(error?.message || error).slice(0, 80)); return; }
  if (Number(mode?.accounting_version) === 2) {
    throw new Error('هذا المحل مسجّل بنظام التجهيز الجديد، وغير مدعوم في نسخة الويب بعد. افتحه من تطبيق SharikX2 على الجوال.');
  }
}

/** Shop number for the header (a shop just created on the web opens before it is known). */
export async function loadProjectNumber(api, projectId) {
  const rows = await api.request(`/rest/v1/sharikx2_projects?id=eq.${encodeURIComponent(projectId)}&select=project_number&limit=1`);
  return Array.isArray(rows) && rows[0]?.project_number ? String(rows[0].project_number) : '';
}

/** First-controller registration without the extra dialog. No-op when a controller already exists. */
export async function registerFirstDevice({api, projectId, role, isCurrent}) {
  if (role !== 'owner') return false;
  const identity = window.localStorage, journal = window.sessionStorage, scope = api.config.url;
  const deviceId = readDeviceIdentity(identity, scope, {create: true});
  const row = await api.deviceControl(projectId);
  if (row || !isCurrent()) return false;
  const registration = createDeviceRegistration({
    api, storage: journal, projectId, deviceId, mode: role, online: () => navigator.onLine !== false,
    assertIdentity: expected => { if (readDeviceIdentity(identity, scope) !== expected) throw new Error('تغيّرت هوية المتصفح'); },
  });
  await registration.run(isCurrent);
  return true;
}
