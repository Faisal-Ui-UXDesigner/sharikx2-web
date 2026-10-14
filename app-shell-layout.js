// Layout-only state. No project data, network calls or persistent preferences.
export function shellInsets({header=0,controls=0,navigation=0}={}){
 for(const value of [header,controls,navigation])if(!Number.isFinite(value)||value<0)throw Error('أبعاد واجهة غير صالحة');
 return Object.freeze({header:Math.ceil(header),controls:Math.ceil(controls),navigation:Math.ceil(navigation)});
}

export function bindAppShellLayout(root){
 if(!root?.isConnected)return ()=>{};
 const header=root.querySelector('.app-header'),navigation=root.querySelector('nav');
 if(!header||!navigation)return ()=>{};
 const win=root.ownerDocument.defaultView;
 let disposed=false,frame=null,controls=null;
 const measure=()=>{
  frame=null;if(disposed||!root.isConnected)return;
  const next=root.querySelector('.inventory-sticky-controls');
  if(next!==controls){if(controls)resize?.unobserve(controls);controls=next;if(controls)resize?.observe(controls);}
  const insets=shellInsets({header:header.getBoundingClientRect().height,controls:controls?.getBoundingClientRect().height||0,navigation:navigation.getBoundingClientRect().height});
  for(const [key,value] of Object.entries(insets))root.style.setProperty(`--native-${key}-height`,`${value}px`);
 };
 const schedule=()=>{if(!disposed&&frame===null)frame=win.requestAnimationFrame(measure);};
 const resize=typeof win.ResizeObserver==='function'?new win.ResizeObserver(schedule):null;
 resize?.observe(header);resize?.observe(navigation);
 const mutation=new win.MutationObserver(schedule);mutation.observe(root,{childList:true,subtree:true});
 win.addEventListener('resize',schedule);measure();
 return ()=>{if(disposed)return;disposed=true;if(frame!==null)win.cancelAnimationFrame(frame);resize?.disconnect();mutation.disconnect();win.removeEventListener('resize',schedule);};
}
