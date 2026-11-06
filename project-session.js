// Opened-project helpers (2026-11-06):
// 1) remember the opened project in this tab so a reload returns to it (auth token is already per tab);
// 2) select the server-confirmed accounting model; unknown is NEVER legacy;
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

/** Owners require explicit project-scoped server metadata. Viewer stays read-only. */
export async function projectAccountingVersion(api,projectId,role){
  if(role!=='owner')return null;
  try{
    const mode=await api.rpc('sharikx2_project_accounting_mode_v1',{p_project:projectId});
    if(mode?.project_id!==projectId||![1,2].includes(mode.accounting_version)||typeof mode.enabled!=='boolean')throw new Error('INVALID_ACCOUNTING_MODE');
    return mode.accounting_version;
  }catch(cause){throw new Error('تعذر التحقق من نظام حسابات هذا المحل. لن يُفتح النظام القديم تلقائياً. تحقق من الاتصال وأعد المحاولة.',{cause});}
}

/** Legacy-only callers must also fail closed when the model cannot be verified. */
export async function assertWebSupportedProject(api, projectId, role) {
  if (role !== 'owner') return;
  if (await projectAccountingVersion(api,projectId,role) === 2) {
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
