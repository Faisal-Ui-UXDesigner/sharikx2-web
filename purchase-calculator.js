// QuantityCalculatorRules: exact decimal operations, DECIMAL128 division, final HALF_UP cents.
// Expressions are parsed as data. No eval, DOM, API, stock or invoice state.
const invalid=()=>Error('أدخل عملية صحيحة؛ القسمة على صفر غير مسموحة');
const pow=scale=>10n**BigInt(scale);
const absolute=value=>value<0n?-value:value;
const digitStarts=[0x30,0x660,0x6f0,0x7c0,0x966,0x9e6,0xa66,0xae6,0xb66,0xbe6,0xc66,0xce6,0xd66,0xde6,0xe50,0xed0,0xf20,0x1040,0x1090,0x17e0,0x1810,0x1946,0x19d0,0x1a80,0x1a90,0x1b50,0x1bb0,0x1c40,0x1c50,0xa620,0xa8d0,0xa900,0xa9d0,0xa9f0,0xaa50,0xabf0,0xff10];
function normalize(input){
 if(typeof input!=='string'||input.length>96)throw invalid();
 const whitespace=code=>(code>=9&&code<=13)||(code>=28&&code<=32)||code===0x1680||(code>=0x2000&&code<=0x2006)||(code>=0x2008&&code<=0x200a)||[0x2028,0x2029,0x205f,0x3000].includes(code);
 return [...input].filter(char=>!whitespace(char.charCodeAt(0))).map(char=>{
  const code=char.charCodeAt(0),start=digitStarts.find(start=>code>=start&&code<start+10);
  return start!==undefined?String(code-start):({'×':'*','÷':'/','−':'-','٫':'.'}[char]??char);
 }).join('');
}
function compact(n,scale){
 if(n===0n)return {n:0n,scale:0};
 while(scale>0&&n%10n===0n){n/=10n;scale--;}
 return {n,scale};
}
function add(left,right,subtract){
 const scale=Math.max(left.scale,right.scale);
 return compact(left.n*pow(scale-left.scale)+(subtract?-1n:1n)*right.n*pow(scale-right.scale),scale);
}
function roundedRatio(numerator,denominator,halfEven=false){
 const quotient=numerator/denominator,remainder=numerator%denominator;
 const up=remainder*2n>denominator||(remainder*2n===denominator&&(!halfEven||quotient%2n!==0n));
 return quotient+(up?1n:0n);
}
function divide(left,right){
 if(right.n===0n)throw invalid();
 const sign=(left.n<0n)!==(right.n<0n)?-1n:1n;
 let numerator=absolute(left.n)*pow(right.scale),denominator=absolute(right.n)*pow(left.scale);
 if(numerator===0n)return {n:0n,scale:0};
 let order=numerator.toString().length-denominator.toString().length;
 if(order>=0?numerator<denominator*pow(order):numerator*pow(-order)<denominator)order--;
 const scale=33-order;
 if(scale>=0)return compact(sign*roundedRatio(numerator*pow(scale),denominator,true),scale);
 return compact(sign*roundedRatio(numerator,denominator*pow(-scale),true)*pow(-scale),0);
}
function plain({n,scale}){
 const digits=absolute(n).toString().padStart(scale+1,'0');
 return (n<0n?'-':'')+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
}
export function evaluatePurchaseExpression(input){
 const source=normalize(input);let position=0;
 const number=()=>{
  const match=/^-?(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(position));
  if(!match)throw invalid();position+=match[0].length;
  const [whole,fraction='']=match[0].split('.');
  const negative=whole.startsWith('-'),digits=whole.replace('-','')+fraction;
  return compact((negative?-1n:1n)*BigInt(digits),fraction.length);
 };
 const term=()=>{
  let result=number();
  while(source[position]==='*'||source[position]==='/'){
   const operator=source[position++],right=number();
   result=operator==='*'?compact(result.n*right.n,result.scale+right.scale):divide(result,right);
  }
  return result;
 };
 let result=term();
 while(source[position]==='+'||source[position]==='-'){
  const operator=source[position++];result=add(result,term(),operator==='-');
 }
 if(position!==source.length)throw invalid();
 const numeric=Number(plain(result));if(!Number.isFinite(numeric)||(result.n!==0n&&numeric===0))throw invalid();
 if(result.scale>2)result=compact((result.n<0n?-1n:1n)*roundedRatio(absolute(result.n),pow(result.scale-2)),2);
 return plain(result);
}
export function calculatePurchaseExpression(input){
 const result=evaluatePurchaseExpression(input);
 if(Number(result)<=0)throw Error('أدخل عملية صحيحة بنتيجة أكبر من صفر');return result;
}
const targets=Object.freeze({
 quantity:Object.freeze({title:'حاسبة الكمية',action:'حساب الكمية',field:'الكمية'}),
 cost:Object.freeze({title:'حاسبة سعر الشراء',action:'حساب سعر الشراء',field:'السعر'})
});
export function purchaseCalculatorTarget(target){if(!Object.hasOwn(targets,target))throw invalid();return targets[target];}
