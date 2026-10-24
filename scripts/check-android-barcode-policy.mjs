// Explicit source check for the developer's adjacent Android checkout. Ordinary
// web unit tests use the captured fixture and remain runnable from a web-only clone.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture=JSON.parse(await readFile(new URL('../tests/fixtures/android-barcode-policy.json',import.meta.url)));
const source=await readFile(new URL(`../../${fixture.source}`,import.meta.url),'utf8');
assert.deepEqual([...source.matchAll(/BarcodeFormat\.([A-Z_0-9]+)/g)].map(match=>match[1].toLowerCase()),fixture.formats);
assert.match(source,new RegExp(`now - previousScanAt >= ${fixture.minimumIntervalMs}L`));
console.log('PASS: captured barcode formats and duplicate interval match adjacent Android source; Java was not executed');
