export const projectId='11111111-1111-4111-8111-111111111111';
export function approvalFixture({operational=true}={}){
 const at='2026-11-06T12:00:00.123456Z';
 const event={project_id:projectId,request_id:'22222222-2222-4222-8222-222222222222',kind:'approve',occurred_at:at,snapshot:{
  review:{cutoff_at:at,plan:{gross_profit:'3.00',distribution_basis:'3.00',retained_change:'0',reserved_profit:'0',net_value:'1051.50'}},
  partner_names:[{id:'p',name:'الاسم وقت الاعتماد'}],result:{retained:'0.00',partners:[{id:'p',capital:'1013.00',prior_profit:'0.00',loss_debt:'0',reserved_profit:'0'}]}
 }};
 if(operational)event.snapshot.export_data={version:1,project_id:projectId,cutoff_at:at,previous_cutoff_at:null,
  state:{project_id:projectId,profit:{summary:{accounts:[{id:'cash',name:'كاش',balance:'1011.50'}]}},stock:{products:[{product:{name:'صنف & <آمن>',barcode:'00123',base_unit:'كغم',quantity_pieces:'0.125',weighted_unit_cost:'1.0050',default_sale_price:'2.00'}}]}},
  sales:[{id:'s',sale_number:2,completed_at:at,total:'5.00',paid_amount:'3.00',debt_amount:'2.00',cost_total:'2.00',status:'credit',payments:[{account_id:'cash',amount:'2.00',reference_id:'s'},{account_id:'bank',amount:'1.00',reference_id:'s'}]}],
  expenses:[],purchases:[],sale_items:[],purchase_items:[],sale_returns:[],movements:[],partner_events:[]};
 return event;
}
export function ownerState(){return {project_id:projectId,accounting_version:2,revision:1,opening_locked:true,finance_bridge:1,approval_available:true,sections:{money:{status:'done'}},stock:{products:[]},
 profit:{summary:{net_project_value:'1051.50',liquidity:'1011.50',inventory_cost:'20',customer_debt:'26',supplier_debt:'6',accounts:[{id:'cash',name:'كاش',balance:'1011.50'}]}},
 partners:[{id:'p',name:'اسم اليوم لا يدخل التقرير'}],locked_snapshot:{partners:[{id:'p',name:'اسم البداية'}]},finance_events:[approvalFixture()]};}
