import test from 'node:test';
import assert from 'node:assert/strict';
import {homeStatistics} from '../home-statistics.js';
import {sharedReport} from '../shared-report.js';
import {reportPeriod} from '../reports.js';
import {decimalSum} from '../decimal-sum.js';

test('home and report agree on each day across sale/purchase returns, wages, writeoffs and supplier discounts',()=>{
 const source={sales:[{id:'sale',status:'completed',total:.9,cost_total:.4,created_at:'2026-10-12T21:30:00Z',completed_at:'2026-10-13T10:00:00Z',returns:[{id:'return',total:.3,created_at:'2026-10-14T10:00:00Z',items:[{cost_amount:.2}]}]}],purchases:[{id:'purchase',status:'received',total:200,purchased_at:'2026-10-13',returns:[{id:'pr',total:20,created_at:'2026-10-14'}],payments:[],credits:[]}],expenses:[{id:'expense',amount:.1,category:'operating_expense',occurred_at:'2026-10-13'},{id:'wage',amount:.2,category:'daily_wage',occurred_at:'2026-10-13'}],writeoffs:[{id:'loss',amount:.05,created_at:'2026-10-14'}],supplier_discounts:[{id:'discount',amount:.4,paid_at:'2026-10-13',payment_kind:'discount'}],discount_reversals:[{id:'pr',discount_reversal:.1,created_at:'2026-10-14'}]};
 for(const day of ['2026-10-12','2026-10-13','2026-10-14','2026-10-15']){
  const home=homeStatistics(source,{customer_debt:9,supplier_debt:4},day),report=sharedReport(source,reportPeriod(day)).summary;
  assert.equal(home.sales,report.sales,day);assert.equal(home.cost,report.cost,day);assert.equal(home.net,report.net,day);assert.equal(home.supplierDiscounts,report.supplierDiscounts,day);
  assert.equal(home.expenses,decimalSum([report.expenses,report.wages,report.writeoffs]),day);
 }
});
