import { effect } from "./reactive";
// watch 函数接收两个参数，source是响应式数据，cb是回调函数
export default function watch(source, cb, options = {}) {
  // 定义getter
  let getter;
  // 如果source是函数，说明用户传递是getter，把函数赋值给getter
  if (typeof source == "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  // 定义新值和旧值
  let odlValue, newValue;
  // 储存用户注册的回调函数
  let cleanup;
  function onInvalidate(fn) {
    // 将过期回调存储到cleanup中
    cleanup = fn;
  }
  // 提取scheuler调度函数为一个独立的obj函数
  const job = () => {
    newValue = effectFn();
    // 在执行回调之前，先调用过期函数
    if (cleanup) {
      cleanup();
    }
    // 当数据变化时，调用回调函数cb，将onInvalidate作为回调函数的第三个参数，以便用户使用
    cb(odlValue, newValue, onInvalidate);
    odlValue = newValue;
  };
  // 使用effect注册副作用函数时，开启lazy选项，并把返回值存储到effectFn中以便后续手动调用
  const effectFn = effect(
    // 调用traverse递归地读取
    () => getter(),
    {
      lazy: true,
      scheduler() {
        if (options.flush == "post") {
          const p = Promise.resolve();
          p.then(job);
        } else {
          job();
        }
      },
    }
  );
  if (options.immediate) {
    // 当immediate为true的时候立即执行job，触发执行回调
    job();
  } else {
    odlValue = effectFn();
  }
}

function traverse(value, seen = new Set()) {
  // 如果是原始数据，或者已经读取过，那么什么都不做
  if (typeof value != "object" || value == null || seen.has(value)) return;
  // 将数据添加到seen中，代表遍历地读取过了，避免循环引用引起的死循环
  seen.add(value);
  // 暂不考虑数组等其他结构
  // 假设value是一个对象，使用for...in 读取对象的每一个值，并递归地调用traverse进行处理
  for (const k in value) {
    traverse(value[k], seen);
  }
  return value;
}
