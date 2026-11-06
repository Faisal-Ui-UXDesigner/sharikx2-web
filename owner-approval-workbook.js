import {approvalDetails,approvalNumber} from './owner-approval-history.js';

const xml=value=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'�').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const text=value=>({value,type:'String'}),numeric=value=>({value:approvalNumber(value),type:'Number'});
const pair=(label,value)=>[text(label),text(value)];
const rows=value=>{if(!Array.isArray(value))throw Error('تفاصيل التصدير المحفوظة غير مكتملة');return value;};
const fields=spec=>spec.split('|').map(column=>column.split(':'));
// Identical saved fields/order to Android OwnerApprovalWorkbook. No live reads,
// derived profit, current partner-name substitution, or legacy allocation engine.
export function ownerApprovalWorkbook(event,{projectId,currency}){
 const details=approvalDetails(event),saved=details.event,snapshot=saved.snapshot,result=snapshot.result,sheets=[];
 if(saved.project_id!=null&&saved.project_id!==projectId)throw Error('الاعتماد لا يخص المحل الحالي');
 const sheet=(name,data)=>sheets.push({name,rows:data});
 const numbers=(source,columns)=>columns.filter(([key])=>source[key]!=null).map(([key,label])=>[text(label),numeric(source[key])]);
 const table=(name,data,columns)=>{
  const records=rows(data),list=[columns.map(([,label])=>text(label))];
  for(const row of records){if(!row||typeof row!=='object'||Array.isArray(row))throw Error('سجل تصدير غير صالح');
   list.push(columns.map(([key,,type])=>row[key]==null?text('غير محفوظ'):type==='number'?numeric(row[key]):text(row[key])));}
  if(!records.length)list.push(pair('السجلات','لا توجد سجلات في هذه الفترة'));sheet(name,list);
 };
 sheet('ملخص الاعتماد',[pair('العملة',currency),pair('تاريخ الاعتماد',details.at),pair('وقت القطع',details.cutoff??'غير محفوظ'),pair('معرف الاعتماد',saved.request_id),pair('ملاحظة','هذا الملف يعرض نتيجة الاعتماد المحفوظة، وليس الأرصدة الحالية. تصديره لا ينشئ اعتماداً جديداً.'),...numbers(result,[['retained','حصة المحل المتجمعة']])]);
 sheet('أرصدة الشركاء',details.partners.flatMap(partner=>[pair('الشريك',partner.name),...partner.values.map(row=>[text(row.label),numeric(row.amount)])]));
 const raw=JSON.stringify(saved),chunks=[];
 for(let offset=0,part=1;offset<raw.length;part++){
  let end=Math.min(offset+30000,raw.length);const code=raw.charCodeAt(end-1);if(end<raw.length&&code>=0xd800&&code<=0xdbff)end++;
  chunks.push(pair(`جزء ${part}`,raw.slice(offset,end)));offset=end;
 }
 sheet('لقطة الخادم',chunks);
 const source=snapshot.export_data;
 if(source==null)sheet('اكتمال البيانات',[pair('سجل قديم','تفاصيل البضاعة والمصاريف والحسابات لم تحفظ مع هذا الاعتماد. لا نستبدلها بالأرصدة الحالية.'),pair('المتاح','نتيجة الاعتماد الأصلية وأرصدة الشركاء ولقطة الخادم محفوظة في الأوراق السابقة.')]);
 else{
  if(source.version!==1||source.project_id!==projectId||source.state?.project_id!==projectId||source.cutoff_at!==details.cutoff||!snapshot.review.plan)throw Error('مصدر التصدير لا يطابق المحل أو وقت الاعتماد');
  const state=source.state;
  sheet('لوحة المعلومات',[pair('الفترة حتى',source.cutoff_at),pair('وقت القطع السابق',source.previous_cutoff_at??'من بداية التسجيل'),...numbers(snapshot.review.plan,fields('gross_profit:ربح العمليات|distribution_basis:المتاح للتوزيع|retained_change:تغير حصة المحل|reserved_profit:الربح المحجوز|net_value:صافي قيمة المشروع'))]);
  table('الحسابات',state.profit?.summary?.accounts,fields('id:معرف الحساب|name:الحساب|balance:الرصيد:number'));
  table('البضاعة',rows(state.stock?.products).map(row=>row.product),fields('name:الصنف|barcode:الباركود|base_unit:الوحدة|quantity_pieces:الكمية:number|weighted_unit_cost:تكلفة الوحدة:number|default_sale_price:سعر البيع:number'));
  table('ذمم الشركاء',result.partners,fields('id:معرف الشريك|loss_debt:دين الخسارة:number|cash_debt:دين نقدي:number|loan_payable:قرض مستحق للشريك:number|reserved_profit:ربح محجوز:number'));
  table('سجل المصاريف',source.expenses,fields('occurred_at:الوقت|category:النوع|description:الوصف|amount:المبلغ:number|account_id:معرف الحساب'));
  table('المبيعات',source.sales,fields('sale_number:رقم المبيعة|completed_at:الوقت|total:الإجمالي عند اللقطة:number|paid_amount:المدفوع:number|debt_amount:الدين المتبقي:number|cost_total:التكلفة:number|status:الحالة'));
  table('مدفوعات المبيعات',rows(source.sales).flatMap(sale=>sale.payments==null?[]:rows(sale.payments).map(payment=>({...payment,sale_number:sale.sale_number??''}))),fields('sale_number:المبيعة|account_id:معرف الحساب|amount:الدفعة الأصلية:number|reference_id:معرف المبيعة'));
  table('فواتير الشراء',source.purchases,fields('invoice_number:الفاتورة|purchased_at:الوقت|supplier_id:معرف المورد|total:الإجمالي:number|paid_amount:المدفوع:number|debt_amount:المتبقي:number'));
  table('أصناف المبيعات',source.sale_items,fields('sale_id:معرف المبيعة|product_name:الصنف|barcode:الباركود|quantity:الكمية:number|unit_sale_price:سعر الوحدة:number|unit_cost_snapshot:تكلفة الوحدة:number|line_total:الإجمالي:number'));
  table('أصناف المشتريات',source.purchase_items,fields('purchase_id:معرف الفاتورة|product_id:معرف الصنف|quantity_pieces:الكمية:number|unit_cost:تكلفة الوحدة:number|line_total:الإجمالي:number'));
  table('المرتجعات',source.sale_returns,fields('created_at:الوقت|sale_id:معرف المبيعة|total:قيمة المرتجع:number|reason:السبب'));
  table('التفاصيل اليومية',[...rows(source.sales).map(sale=>({at:sale.completed_at??'',kind:'مبيعة',amount:sale.total,id:sale.id})),...rows(source.expenses).map(expense=>({at:expense.occurred_at??'',kind:expense.category??'',amount:expense.amount,id:expense.id}))],fields('at:وقت العملية|kind:النوع|amount:المبلغ:number|id:معرف العملية'));
  table('حركة الفلوس',source.movements,fields('created_at:الوقت|account_id:معرف الحساب|direction:الاتجاه|amount:المبلغ:number|movement_type:النوع|reference_id:معرف المرجع'));
  table('المسحوبات',rows(source.partner_events).filter(row=>['profit_withdrawal','capital_return','exit_payment','cash_borrowing'].includes(row.kind)).map(row=>{
   const values=row.snapshot?.review?.values;if(!values)throw Error('لقطة حركة الشريك غير مكتملة');return {...row,...(values.amount==null?{}:{amount:values.amount})};
  }),fields('occurred_at:الوقت|partner_id:معرف الشريك|kind:نوع الحركة|amount:المبلغ:number'));
  if(snapshot.debt_writeoffs!=null)table('شطب الديون',snapshot.debt_writeoffs,fields('created_at:الوقت|customer_id:معرف الزبون|sale_id:المبيعة إن وجدت|amount:الخسارة:number|reason:السبب'));
  if(snapshot.debt_actions!=null)table('إجراءات الديون',snapshot.debt_actions,fields('created_at:الوقت|kind:الإجراء|from_name:من الزبون|to_name:إلى الزبون|amount:المبلغ:number|reason:السبب'));
  sheet('مصدر الحسابات',[pair('مصدر القيم','لقطة محفوظة مع الاعتماد، وليست استعلاماً عن البيانات الحالية.'),pair('النتائج المالية','خطة ونتيجة الخادم؛ لا تطبق معادلات توزيع النظام القديم على المشاريع الجديدة.'),pair('التفاصيل اليومية','سجل تفصيلي للقيم المحفوظة وليس إعادة احتساب أرباح يومية. المبيعات تعرض قيمتها عند اللقطة بعد أي مرتجع سابق.'),pair('الأرقام الناقصة','غير محفوظ تعني أن الحقل غير موجود؛ لا تعني صفراً.')]);
 }
 const content='<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Calibri" ss:Size="11"/></Style></Styles>'+sheets.map(sheet=>`<Worksheet ss:Name="${xml(sheet.name)}"><Table>${sheet.rows.map(row=>'<Row>'+row.map(cell=>`<Cell><Data ss:Type="${cell.type}">${xml(cell.value)}</Data></Cell>`).join('')+'</Row>').join('')}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/><DoNotDisplayGridlines/></WorksheetOptions></Worksheet>`).join('')+'</Workbook>';
 return Object.freeze({content,type:'application/vnd.ms-excel',filename:`SharikX2-approval-${saved.request_id.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)}.xls`,sheetNames:Object.freeze(sheets.map(sheet=>sheet.name))});
}
