import {escape,money} from './ui.js';
import {inventoryCardModel} from './inventory-card.js';
import {productListContent} from './product-list-ui.js';
const quantities=new Intl.NumberFormat('ar-u-nu-latn',{maximumFractionDigits:3});
const pinIcon='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 3 6 0-1 7 4 4H6l4-4-1-7Zm3 11v7"/></svg>';
export function inventoryCardMarkup(product,options={}){
 const card=inventoryCardModel(product,options);
 const pin=card.canPin?`<button type="button" class="inventory-pin${card.pinned?' inventory-pinned':''}" data-pin-id="${escape(card.id)}" aria-label="${card.pinLabel}" aria-pressed="${card.pinned}"${options.pinDisabled?' disabled':''}>${pinIcon}</button>`:
  card.pinned?`<span class="inventory-pin inventory-pinned" role="img" aria-label="صنف مثبت">${pinIcon}</span>`:'';
 return `<article class="panel inventory-card">${pin}<button type="button" class="inventory-card-open" data-product-id="${escape(card.id)}" aria-label="${escape('تفاصيل '+card.name)}">${productListContent({...product,name:card.name},{category:card.category,quantity:quantities.format(card.quantity),unit:card.unit,price:card.saleUnitPrice,nameClass:'inventory-card-name',categoryClass:'inventory-category-badge',metaClass:'inventory-card-description'})}${card.trending?'<span class="badge inventory-trending popularity-3">رائج</span>':''}${card.notes?`<span class="inventory-card-notes">${escape(card.notes)}</span>`:''}</button></article>`;
}
