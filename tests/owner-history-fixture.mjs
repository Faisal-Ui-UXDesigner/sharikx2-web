export const projectId='11111111-1111-4111-8111-111111111111';
export function historyFixture(){
 const sales=Array.from({length:25},(_,index)=>({id:`sale-${index}`,project_id:projectId,sale_number:index+1,total:'5.01',paid_amount:'3.01',debt_amount:'2',status:'partially_paid',created_at:index===24?'2026-10-01T10:00:00Z':'2026-11-06T10:00:00Z',customer:{name:`زبون ${index+1}`,phone:index===24?'0599999999':'0590000000'}}));
 const expense={id:'expense',project_id:projectId,amount:'1.25',description:'كهرباء <آمن>',occurred_at:'2026-11-06T11:00:00Z',created_at:'2026-11-06T11:00:00Z',category:'operating_expense',account:{name:'كاش'}};
 const purchase={id:'purchase',project_id:projectId,invoice_number:77,total:'0.13',paid_amount:'0.10',debt_amount:'0.03',status:'received',created_at:'2026-11-06T12:00:00Z',purchased_at:'2026-11-06T12:00:00Z',supplier:{name:'مورد & آمن',phone:'0597777777'},
  items:[{id:'pi',purchase_id:'purchase',quantity_pieces:'0.125',unit_cost:'1.0050',line_total:'0.13',product:{name:'اسم الصنف الحالي',base_unit:'كغم'}}],payments:[{amount:'0.10',account:{name:'كاش'}}]};
 const detail={...sales[0],items:[{id:'si',product_name:'اسم الصنف وقت البيع',quantity:'1.005',unit_sale_price:'1.00',line_total:'1.01'}],returns:[{id:'r',sale_id:'sale-0',total:'0.50',created_at:'2026-11-06T11:00:00Z',items:[{sale_item_id:'si',quantity:'0.50',refund_amount:'0.50'}]}]};
 const payments=[{id:'movement',project_id:projectId,reference_type:'sale',reference_id:'sale-0',direction:'in',amount:'3.51',account:{name:'البنك الأصلي'}}];
 return {sales,expenses:[expense],purchases:[purchase],detail,payments};
}
