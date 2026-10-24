import test from 'node:test';import assert from 'node:assert/strict';import {normalizeBarcode,shouldAcceptScan,PRODUCT_BARCODE_FORMATS} from '../barcode-scanner.js';
import {readFile} from 'node:fs/promises';
test('product barcode policy matches captured Android fixture (portable; not a device test)',async()=>{
 const fixture=JSON.parse(await readFile(new URL('fixtures/android-barcode-policy.json',import.meta.url),'utf8'));
 assert.deepEqual([...PRODUCT_BARCODE_FORMATS],fixture.formats);
 assert.equal(shouldAcceptScan(2000,2000-fixture.minimumIntervalMs,false),true);
 assert.equal(shouldAcceptScan(2000,2001-fixture.minimumIntervalMs,false),false);
});
test('barcode scanner normalizes values and throttles duplicate detections',()=>{assert.equal(normalizeBarcode('  0123  '),'0123');assert.equal(normalizeBarcode(null),'');assert.equal(shouldAcceptScan(2000,1000,false),true);assert.equal(shouldAcceptScan(2500,2000,false),false);assert.equal(shouldAcceptScan(2500,0,true),false);assert.ok(PRODUCT_BARCODE_FORMATS.includes('ean_13'));});
