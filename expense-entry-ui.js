import {escape,money,currency} from './ui.js';
import {currencySymbol} from './currency.js';
import {expenseEntryTypes,expenseEntryType} from './expense-entry.js';

export function expenseTypeMarkup(){
 return `<div class="expense-type-options">${expenseEntryTypes().map(type=>`<button type="button" data-expense-type="${type.category}">${type.label}</button>`).join('')}</div>`;
}
export function expenseEntryMarkup(accounts,category){
 const type=expenseEntryType(category);
 return `<form><fieldset><p class="expense-kind">نوع الحركة: ${type.label}</p><input type="hidden" name="category" value="${type.category}"><label>${type.description}<input name="description" maxlength="500" required placeholder="${type.description}"></label><label>${type.amount}<div class="money-input"><input name="amount" type="number" inputmode="decimal" dir="ltr" step="0.01" min="0.01" required placeholder="${type.amount}"><span>${escape(currencySymbol(currency()))}</span></div></label><h3>الدفع من حساب</h3><div class="account-choices" role="radiogroup" aria-label="الدفع من حساب">${accounts.map((account,index)=>`<label class="choice account-choice"><input type="radio" name="account" value="${escape(account.id)}" ${index===0?'checked':''} required><span>${escape(account.name)}<small class="muted">المتاح: ${money(Math.max(0,account.balance),2)}</small><small data-left="${escape(account.id)}" aria-live="polite"></small></span></label>`).join('')}</div>${accounts.length?'':'<p role="status" class="muted">لا يوجد حساب متاح لدفع المصروف. أضف حسابًا من الحسابات المالية أولًا.</p>'}<p class="expense-attachment muted small">صورة الفاتورة اختيارية. بعد حفظ المصروف، افتح تفاصيله من سجل العمليات واختر «إرفاق صورة للسجل المحفوظ». رفع الصورة لا يسجل مصروفًا آخر.</p></fieldset><p class="form-error" role="alert"></p><button class="primary" type="submit" ${accounts.length?'':'disabled'}>تأكيد</button></form>`;
}
