// import './packages/reactive'
import {
  effect,
  reactive,
  readonly,
  shallowReactive,
} from "./packages/reactive";
const p = reactive(new Map([["key", 1]]));
let p1 = new Map([["key", 1]]);
effect(() => {
  for (const v of p.values()) {
    console.log(v);
  }
});
p.set("key1", 2);
// p.set("key2", 3);
// arr[1] = "bar";
// arr.length = 3;
