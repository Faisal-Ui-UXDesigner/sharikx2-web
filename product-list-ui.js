import {escape,money} from './ui.js';
/** Shared product identity/details for purchase, sale and inventory lists. */
export function productListContent(product,{category=product.category,quantity=product.quantity_pieces,unit=product.base_unit,price=product.default_sale_price,nameClass='',categoryClass='',metaClass='',priceDecimals=2}={}){
 const barcode=String(product.barcode||'');
 return `<span class="product-list-content"><span class="product-list-heading"><b class="product-list-name ${escape(nameClass)}">${escape(product.name||'صنف')}</b>${category?`<small class="product-list-category ${escape(categoryClass)}">${escape(category)}</small>`:''}</span><span class="product-list-meta ${escape(metaClass)}">${quantity!==undefined?`<span>الكمية: ${escape(quantity)} ${escape(unit||'')}</span>`:''}${price!==undefined?`<span>البيع: ${escape(money(price,priceDecimals))}</span>`:''}${barcode&&!barcode.startsWith('manual-')?`<span>باركود: <bdi dir="ltr">${escape(barcode)}</bdi></span>`:''}</span></span>`;
}
