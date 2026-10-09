// Matches Android ProjectCredentialsRules: preserve ASCII digits only.
export function normalizePhone(value){return String(value??'').replace(/[^0-9]/g,'');}
export function validPhone(value){return /^[0-9]{10}$/.test(normalizePhone(value));}
export function contactTarget(value){const phone=normalizePhone(value);return validPhone(phone)?`tel:${phone}`:null;}
export function matchesContactSearch(name,phone,query){
 const text=String(query??'').trim().toLocaleLowerCase('ar');
 if(`${name??''} ${phone??''}`.toLocaleLowerCase('ar').includes(text))return true;
 const digits=/^[0-9\s()+.\-]+$/.test(text)?normalizePhone(text):'';
 return !!digits&&normalizePhone(phone).includes(digits);
}
