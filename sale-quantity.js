const measured=new Set(['كغم','كيلو','كيلوغرام','kg','غرام','جرام','g','لتر','liter','litre','مل','ملل','ml']);
const small=new Set(['غرام','جرام','g','مل','ملل','ml']);
const normalize=value=>String(value??'').trim().toLowerCase();
export function isMeasuredUnit(value){return measured.has(normalize(value));}
export function quantityChoices(unit){return (small.has(normalize(unit))?[[250,'250'],[500,'500'],[1000,'1000']]:[[.25,'ربع'],[.5,'نصف'],[1,'1']]).map(([quantity,label])=>Object.freeze({quantity,label}));}
function ticks(value){
 const number=Number(value);if(value===null||value===undefined||value===''||!Number.isFinite(number)||number<0||number>Number.MAX_SAFE_INTEGER/1000)throw new Error('الكمية غير صالحة');
 return Math.round((number+Number.EPSILON)*1000);
}
export function quantityStep(line){
 if(!isMeasuredUnit(line.unit))return 1;
 const saved=line.quantityStep??line.quantity;return ticks(saved)>0?ticks(saved)/1000:1;
}
export function setSaleQuantity(line,value){
 const quantity=ticks(value),stock=ticks(line.stock);
 if(quantity<=0)throw new Error('الكمية يجب أن تكون أكبر من صفر');
 if(quantity>stock)throw new Error('لا تكفي الكمية المتاحة');
 return {...line,quantity:quantity/1000,quantityStep:isMeasuredUnit(line.unit)?quantity/1000:1};
}
export function changeSaleQuantity(line,direction){
 if(direction!==1&&direction!==-1)throw new Error('خطوة الكمية غير صالحة');
 const next=ticks(line.quantity)+direction*ticks(quantityStep(line));
 if(next<=0)return null;
 if(next>ticks(line.stock))throw new Error('لا تكفي الكمية المتاحة');
 return {...line,quantity:next/1000,quantityStep:quantityStep(line)};
}
export function newSaleLine(product){
 const unit=String(product.purchase_unit??product.base_unit??'قطعة').trim()||'قطعة',stock=ticks(product.quantity_pieces)/1000;
 const quantity=isMeasuredUnit(unit)&&stock<1?stock:1;
 return setSaleQuantity({id:product.id,name:product.name,unit,stock,quantity,price:Number(product.default_sale_price),cost:Number(product.weighted_unit_cost)},quantity);
}
export function canAddSaleProduct(product,line=null){try{return !!(line?changeSaleQuantity(line,1):newSaleLine(product));}catch{return false;}}
