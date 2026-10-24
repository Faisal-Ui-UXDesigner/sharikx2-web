export function supplierHistoryFixture(){
 return {
  supplier:{id:'s',project_id:'pr',name:'مورد <img src=x>',phone:'0591234567',opening_debt:5.01,active:true},
  purchases:[
   {id:'a',project_id:'pr',supplier_id:'s',invoice_number:'104',total:104.01,paid_amount:100.01,debt_amount:4,status:'completed',created_at:'2026-10-15T08:00:00Z',payments:[{amount:100.01,account:{name:'البنك <script>'}}],credit_applications:[{amount:.25,created_at:'2026-10-15T08:00:00Z'}],items:[{purchase_id:'a',quantity_pieces:2.125,line_total:104.01,product:{name:'بسكويت <img src=x>',base_unit:'كغم'}}]},
   {id:'b',project_id:'pr',supplier_id:'s',invoice_number:'7',total:7,paid_amount:0,debt_amount:7,status:'partially_returned',created_at:'2026-10-15T09:00:00Z',payments:[],credit_applications:[],items:[]},
   {id:'c',project_id:'pr',supplier_id:'s',total:99,paid_amount:0,debt_amount:99,status:'cancelled',created_at:'2026-10-15T10:00:00Z',payments:[],credit_applications:[],items:[]}
  ],
  payments:[
   {id:'p',project_id:'pr',supplier_id:'s',amount:.31,payment_kind:'cash',paid_at:'2026-10-16T08:00:00Z',sources:[{amount:.1,account:{name:'نقد'}},{amount:.21,account:{name:'بنك'}}]},
   {id:'d',amount:.2,payment_kind:'discount',discount_actor_name:'المالك <img>',note:'تسوية <img>',paid_at:'2026-10-17T08:00:00Z',sources:[]},
   {id:'l',amount:.5,paid_at:'2026-10-18T08:00:00Z',sources:[{amount:.5,account:{name:'نقد'}}]}
  ],
  old_debts:[{id:'o',amount:5.01,description:'دين افتتاحي',created_at:'2026-10-14T08:00:00Z'}],
  credits:[{id:'credit',remaining_amount:.4}],
  purchase_returns:[{id:'r',purchase_id:'b',total:3,credit_amount:2}],
  allocation_snapshot:{version:1,allocations:[
   {id:'1',payment_id:'p',target_type:'purchase',purchase_id:'a',amount:.11,legacy:false},
   {id:'2',payment_id:'p',target_type:'purchase',purchase_id:'b',amount:.2,legacy:false},
   {id:'3',payment_id:'d',target_type:'purchase',purchase_id:'a',amount:.2,legacy:false},
   {id:'4',payment_id:'l',target_type:'old_debt',old_debt_id:'o',amount:.4,legacy:true},
   {id:'5',payment_id:'l',target_type:'unallocated',amount:.1,legacy:true}
  ]}
 };
}
