import test from 'node:test';
import assert from 'node:assert/strict';
import {shellInsets,bindAppShellLayout} from '../app-shell-layout.js';

test('shell insets conservatively ceil measured dimensions without altering inputs',()=>{
 const source=Object.freeze({header:104.1,controls:199.01,navigation:71.5});
 const result=shellInsets(source);assert.deepEqual(result,{header:105,controls:200,navigation:72});assert.equal(Object.isFrozen(result),true);assert.equal(source.header,104.1);
});
test('shell missing optional sections have zero inset without a guessed control height',()=>{
 assert.deepEqual(shellInsets(),{header:0,controls:0,navigation:0});
 assert.deepEqual(shellInsets({header:150}),{header:150,controls:0,navigation:0});
});
test('nonfinite negative and nonnumeric layout dimensions are rejected',()=>{
 for(const key of ['header','controls','navigation'])for(const value of [-1,Infinity,NaN,'104',null])assert.throws(()=>shellInsets({[key]:value}));
});
test('unmounted shells need no DOM listeners or background work',()=>{
 for(const value of [null,undefined,{isConnected:false}]){const dispose=bindAppShellLayout(value);assert.equal(typeof dispose,'function');dispose();dispose();}
});
