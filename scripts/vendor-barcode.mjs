import {mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),target=new URL('vendor/',root);
await mkdir(target,{recursive:true});
for(const [source,destination] of [['umd/index.min.js','zxing.min.js'],['LICENSE','zxing-LICENSE.txt']]){
 await copyFile(new URL(`node_modules/@zxing/library/${source}`,root),new URL(destination,target));
}
await copyFile(new URL('node_modules/ts-custom-error/LICENSE',root),new URL('ts-custom-error-LICENSE.txt',target));
await copyFile(new URL('node_modules/@zxing/text-encoding/LICENSE.md',root),new URL('text-encoding-LICENSE.txt',target));
