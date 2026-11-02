import test from 'node:test';
import assert from 'node:assert/strict';
import {parameterClicks} from '../site/knob.js';
const event=()=>({preventDefault(){},stopPropagation(){}});
test('double tap resets instead of opening picker; single tap still opens',async()=>{
 const element={};let opens=0,resets=0;
 parameterClicks(element,{single:()=>opens++,reset:()=>resets++});
 element.onclick(event());element.onclick(event());
 await new Promise(r=>setTimeout(r,350));assert.equal(opens,0);assert.equal(resets,1);
 element.onclick(event());await new Promise(r=>setTimeout(r,350));assert.equal(opens,1);
});
test('drag click does not open a picker or reset its value',async()=>{
 const element={};let calls=0;
 parameterClicks(element,{single:()=>calls++,reset:()=>calls++,skip:()=>true});
 element.onclick(event());element.onclick(event());await new Promise(r=>setTimeout(r,350));assert.equal(calls,0);
});
