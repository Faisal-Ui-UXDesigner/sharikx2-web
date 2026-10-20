import {supplierHistoryFixture} from './supplier-history-fixtures.mjs';
export function purchaseReturnReceiptFixture(){
 const history=supplierHistoryFixture();history.purchases[1].items=[{id:'line',purchase_id:'b',product_id:'product',quantity_pieces:1.5,line_total:3.5,product:{id:'product',project_id:'pr',name:'قهوة <img src=x> '+ 'اسم طويل '.repeat(5),base_unit:'كغم'}}];
 history.purchase_returns=[{id:'r',project_id:'pr',supplier_id:'s',purchase_id:'b',total:.31,credit_amount:.11,debt_reduction:.15,discount_reversal:.05,created_at:'2026-10-20T08:00:00Z',items:[{id:'ri1',return_id:'r',purchase_item_id:'line',product_id:'product',quantity_pieces:.125,refund_amount:.2,product:{id:'product',project_id:'pr',name:'قهوة <img src=x> '+ 'اسم طويل '.repeat(5),base_unit:' كغم '}},{id:'ri2',return_id:'r',purchase_item_id:'line',product_id:'product',quantity_pieces:.075,refund_amount:.11,product:null}]}];return history;
}
