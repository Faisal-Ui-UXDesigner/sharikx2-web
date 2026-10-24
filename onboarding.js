import {escape,money} from './ui.js';
import {mountOpeningDistribution} from './opening-distribution-ui.js';
import {createOnboardingCreation,recoverOnboardingSeed,initialFinanceState} from './onboarding-creation.js';
import {partnerDecimalSum} from './partner-history.js';
import {setupShares,appliedSetupShares,setupPartner,assertSetupPartnerCapacity} from './onboarding-rules.js';
import {partnerPercent} from './partner-display.js';

export function openOnboarding({app,api,onOpen,storage=window.sessionStorage}) {
  const draft={name:'',phone:'',password:'',partners:[],created:null};
  let page='welcome',step=1,busy=false;
  const creation=createOnboardingCreation({api,storage});
  const alert=message=>{const node=app.querySelector('[role=alert]');if(node)node.textContent=message;};
  const frame=(body)=>{app.innerHTML=`<section class="entry onboarding"><div class="brand"><img src="./icon.svg" alt=""><span>SharikX2</span></div>${body}</section>`;};
  function welcome(){if(busy)return;page='welcome';frame(`<p class="eyebrow">مشروعك، أوضح وأسهل</p><h1>أهلًا وسهلًا بك</h1><p class="muted">حساباتك وبضاعتك ومبيعاتك في مكان واحد</p><div class="welcome-actions"><button class="primary" data-create>إنشاء مشروع جديد</button><button class="outline" data-login>الدخول إلى مشروع قائم</button><button class="outline" data-viewer>المشاهدة برقم المشاركة</button></div><p role="alert"></p>`);app.querySelector('[data-create]').onclick=()=>{try{const pending=creation.pending();if(pending){if(!pending.project)throw new Error('نتيجة الإنشاء غير مؤكدة؛ ادخل ببيانات المالك للتحقق دون إنشاء مشروع آخر');draft.partners=structuredClone(pending.state.partners);draft.created=pending.project;setup(3);}else setup(1);}catch(error){alert(error.message);}};app.querySelector('[data-login]').onclick=login;app.querySelector('[data-viewer]').onclick=viewer;}
  function login(){if(busy)return;page='login';frame(`<button class="back-link" data-back>‹ رجوع</button><h1>الدخول إلى المشروع</h1><p class="muted">أدخل بيانات المالك لاسترجاع المشروع على هذا الجهاز.</p><form class="panel" data-form><label>رقم جوال المشروع<input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" autocomplete="username" required placeholder="05xxxxxxxx"></label><label>كلمة مرور المشروع<input name="password" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="current-password" required placeholder="••••"></label><button class="primary">دخول</button><p role="alert"></p></form>`);app.querySelector('[data-back]').onclick=welcome;app.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;const form=e.target,values=new FormData(form),button=form.querySelector('button');busy=true;button.disabled=true;button.textContent='جارٍ الدخول…';try{const result=await api.restore(values.get('phone'),values.get('password'));const project=result.project||result;if(!project.id)throw new Error('تعذر قراءة بيانات المشروع');await recoverOnboardingSeed({api,storage,projectId:project.id,isCurrent:()=>form.isConnected&&page==='login'});if(form.isConnected&&page==='login')onOpen(project,'owner');}catch(error){alert(error.message);}finally{busy=false;button.disabled=false;button.textContent='دخول';}};}
  function viewer(){if(busy)return;page='viewer';frame(`<button class="back-link" data-back>‹ رجوع</button><h1>مشاهدة المشروع</h1><p class="muted">صلاحية المشاهدة لا تسمح بإجراء تغييرات.</p><form class="panel"><label>رقم المشاركة<input name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label><button class="primary">دخول</button><p role="alert"></p></form>`);app.querySelector('[data-back]').onclick=welcome;app.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;const button=e.target.querySelector('button');busy=true;button.disabled=true;button.textContent='جارٍ الدخول…';try{const result=await api.join(new FormData(e.target).get('pin'));const project=result.project||result;if(!project.id)throw new Error('تعذر قراءة المشروع');onOpen(project,'viewer');}catch(error){alert(error.message);}finally{busy=false;button.disabled=false;button.textContent='دخول';}};}
  function setup(next){page='setup';step=next;const headings=['','بيانات المشروع','الملاك والشركاء ورأس المال','نسب الأرباح','توزيع رأس المال'];frame(`${step===4?'':'<button class="back-link" data-back>‹ رجوع</button>'}<p class="eyebrow">الخطوة ${step} من ${draft.created?4:3}</p><h1>${headings[step]}</h1><div data-step></div><p role="alert"></p>`);app.querySelector('[data-back]')?.addEventListener('click',()=>{if(!busy){try{if(creation.pending())return alert('طلب التهيئة محفوظ؛ تحقق منه دون تغيير البيانات');}catch(error){return alert(error.message);}step===1?welcome():setup(step-1);}});const area=app.querySelector('[data-step]');if(step===1){area.innerHTML=`<p class="muted">أنشئ بيانات دخول المالك لاسترجاع المشروع على أي جهاز.</p><form class="panel"><label>اسم المشروع<input name="name" minlength="2" required value="${escape(draft.name)}"></label><label>رقم جوال المالك<input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required value="${escape(draft.phone)}"></label><label>رقم سري من 4 أرقام<input name="password" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label><label>تأكيد الرقم السري<input name="confirm" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label><button class="primary">التالي</button></form>`;area.querySelector('form').onsubmit=e=>{e.preventDefault();const v=new FormData(e.target);if(!e.target.checkValidity())return e.target.reportValidity();if(v.get('password')!==v.get('confirm'))return alert('الرقمان السريان غير متطابقين');draft.name=v.get('name').trim();draft.phone=v.get('phone');draft.password=v.get('password');setup(2);};}
    if(step===2){const total=partnerDecimalSum(draft.partners.map(p=>p.capital));area.innerHTML=`<p class="muted">أضف شريكًا واحدًا على الأقل. الخطة المجانية تتيح شريكين.</p><div class="panel"><small>إجمالي رأس المال</small><h2>${money(total,2)}</h2></div><div data-partners>${draft.partners.map((p,i)=>`<div class="panel partner-row"><div><b>${escape(p.name)}</b><p class="muted">رأس المال: ${money(p.capital,2)}</p></div><div><button type="button" data-edit="${i}" aria-label="تعديل ${escape(p.name)}">تعديل</button><button type="button" data-remove="${i}" aria-label="حذف ${escape(p.name)}">حذف</button></div></div>`).join('')}</div><button class="outline" data-add>+ إضافة شريك</button><button class="primary next-step" data-next>التالي</button>`;area.querySelector('[data-add]').onclick=()=>partnerForm();area.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>partnerForm(Number(b.dataset.edit)));area.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(draft.partners.length<=1)return alert('يجب بقاء مالك أو شريك واحد على الأقل');draft.partners.splice(Number(b.dataset.remove),1);setup(2);});area.querySelector('[data-next]').onclick=()=>{if(!draft.partners.length||total<=0)return alert('أضف شريكًا ورأس مال صحيحًا');setup(3);};}
    if(step===3){
      area.innerHTML=`<p class="muted">حدد نسبة ربح كل شريك؛ النسبة المتبقية تبقى في المشروع لإعادة التشغيل.</p><form><div class="panel"><small>النسبة التي تبقى للمشروع</small><h2 data-remainder>100%</h2></div>${draft.partners.map((p,i)=>`<label class="panel">${escape(p.name)}<input name="share-${i}" type="number" step="any" inputmode="decimal" placeholder="أدخل نسبة الربح" value="${p.share||''}"></label>`).join('')}<button class="primary" type="submit">إنشاء المشروع</button><button class="outline" type="button" data-recover>الدخول ببيانات المالك للتحقق</button><p role="alert"></p></form>`;
      const form=area.querySelector('form'),button=form.querySelector('.primary');
      const preview=()=>{try{const result=setupShares(draft.partners.map((_,i)=>form.elements[`share-${i}`].value));const node=area.querySelector('[data-remainder]');node.textContent=partnerPercent(result.remaining);node.classList.toggle('setup-invalid',!result.valid);node.setAttribute('aria-label',result.valid?'النسبة المتبقية للمشروع':'مجموع نسب الشركاء أكبر من 100%');}catch(error){alert(error.message);}};
      const lock=()=>{let pending;try{pending=creation.pending();}catch(error){alert(error.message);button.disabled=true;return;}
        form.querySelectorAll('input').forEach(input=>input.disabled=busy||!!pending);
        if(pending){
          pending.state.partners.forEach((partner,index)=>{const input=form.elements[`share-${index}`];if(input)input.value=partner.share||'';});
          const remainder=area.querySelector('[data-remainder]');remainder.textContent=partnerPercent(pending.state.reinvestmentShare);remainder.classList.remove('setup-invalid');remainder.setAttribute('aria-label','النسبة المحفوظة في الطلب الأصلي');
        }
        app.querySelector('[data-back]').disabled=busy||!!pending;
        form.querySelector('[data-recover]').disabled=busy;
        button.disabled=busy||pending?.phase==='creating';button.textContent=pending?'التحقق من التهيئة المحفوظة':'إنشاء المشروع';
      };
      form.oninput=preview;form.querySelector('[data-recover]').onclick=login;preview();lock();
      form.onsubmit=async e=>{
        e.preventDefault();if(busy)return;
        let state;
        try{
          const pending=creation.pending();
          if(!pending){if(!form.checkValidity())return form.reportValidity();const shares=appliedSetupShares(draft.partners.map((_,i)=>form.elements[`share-${i}`].value));const partners=draft.partners.map((p,i)=>({...p,share:shares[i]}));state=initialFinanceState(partners);draft.partners=state.partners;}
        }catch(error){return alert(error.message);}
        busy=true;lock();button.textContent='جارٍ التحقق وحفظ التهيئة…';
        try{
          const project=await creation.run({name:draft.name,phone:draft.phone,password:draft.password,state},()=>form.isConnected&&page==='setup'&&step===3);
          if(!form.isConnected)return;
          draft.created=project;draft.password='';setup(4);
        }catch(error){draft.password='';alert(`تعذر إكمال التهيئة: ${error.message}`);}
        finally{busy=false;if(form.isConnected)lock();}
      };
    }
    if(step===4)distribution(area);
  }
  function partnerForm(index){
    if(index===undefined)try{assertSetupPartnerCapacity(draft.partners.length);}catch(error){return alert(error.message);}
    const current=draft.partners[index]||{name:'',capital:''},dialog=document.createElement('dialog');
    dialog.innerHTML=`<form><h2>${index===undefined?'إضافة شريك':'تعديل الشريك'}</h2><label>اسم الشريك<input name="name" required value="${escape(current.name)}"></label><label>رأس المال<input name="capital" type="number" min="0.01" max="1000000000" step="0.01" inputmode="decimal" required value="${escape(current.capital)}"></label><p role="alert"></p><div class="actions"><button class="primary">اعتماد</button><button type="button" data-cancel>إلغاء</button></div></form>`;
    app.append(dialog);dialog.showModal();dialog.addEventListener('cancel',()=>dialog.remove());dialog.querySelector('[data-cancel]').onclick=()=>dialog.remove();
    dialog.querySelector('form').onsubmit=e=>{
      e.preventDefault();if(!dialog.isConnected||page!=='setup'||step!==2)return dialog.remove();
      if(!e.target.checkValidity())return e.target.reportValidity();
      try{
        if(index===undefined)assertSetupPartnerCapacity(draft.partners.length);
        const values=new FormData(e.target),partner=setupPartner({name:values.get('name'),capital:Number(values.get('capital'))},draft.partners[index]);
        if(index===undefined)draft.partners.push(partner);else draft.partners[index]=partner;
        dialog.remove();setup(2);
      }catch(error){dialog.querySelector('[role=alert]').textContent=error.message;}
    };
  }
  function distribution(area){mountOpeningDistribution({api,projectId:draft.created.id,container:area,storage,isCurrent:()=>area.isConnected&&page==='setup'&&step===4,onComplete:()=>onOpen(draft.created,'owner')});}
  welcome();
}
