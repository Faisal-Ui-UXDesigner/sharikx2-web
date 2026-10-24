import {escape} from './ui.js';
import {inventoryCategoryBarModel} from './inventory-category-bar.js';
export function renderInventoryCategoryBar({container,categories,aliases={},selected='الكل',isCurrent,onSelect}){
 const model=inventoryCategoryBarModel(categories,aliases,selected);
 const scroll=container.scrollLeft;
 container.setAttribute('role','group');container.setAttribute('aria-label','تصنيفات البضاعة');
 container.innerHTML=model.tabs.map(tab=>`<button type="button" data-inventory-category="${escape(tab.key)}" aria-pressed="${tab.selected}" class="${tab.selected?'primary':''}">${escape(tab.label)}</button>`).join('');
 container.scrollLeft=scroll;
 let current=model.selected;
 const choose=button=>{
  if(!isCurrent()||!container.isConnected||button.dataset.inventoryCategory===current)return;
  current=button.dataset.inventoryCategory;
  for(const tab of container.querySelectorAll('[data-inventory-category]')){const active=tab===button;tab.classList.toggle('primary',active);tab.setAttribute('aria-pressed',String(active));}
  const position=container.scrollLeft;
  onSelect(current);container.scrollLeft=position;
 };
 container.onclick=event=>{const button=event.target.closest('[data-inventory-category]');if(button&&container.contains(button))choose(button);};
 container.onkeydown=event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!isCurrent())return;
  const buttons=[...container.querySelectorAll('[data-inventory-category]')],index=buttons.indexOf(event.target);if(index<0)return;
  event.preventDefault();
  const target=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowLeft'?1:-1)+buttons.length)%buttons.length;
  buttons[target].focus(); // Focus navigation does not change selection until Enter/Space.
 };
 return model.selected;
}
