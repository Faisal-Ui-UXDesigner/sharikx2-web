import {supplierHistoryFixture} from './supplier-history-fixtures.mjs';
export function purchaseReturnFixture(){
 const history=supplierHistoryFixture();history.purchases[0].items=[{id:'line',purchase_id:'a',product_id:'product',quantity_pieces:3,unit_cost:.335,line_total:1.01,product:{id:'product',project_id:'pr',name:'صنف <img src=x>',base_unit:'كغم',quantity_pieces:2}}];
 history.purchase_returns=[];return history;
}
