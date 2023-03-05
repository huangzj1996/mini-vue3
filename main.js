// import './packages/reactive'
import {
  effect,
  reactive,
  ref,
  toRef,
  readonly,
  shallowReactive,
} from "./packages/reactive";
const obj = reactive({ foo: 1, bar: 2 });
const reffoo = toRef(obj, "foo");
reffoo.value = 100;
console.log(reffoo);
// p.set("key2", 3);
// arr[1] = "bar";
// arr.length = 3;
