import { effect, track, trigger } from "./reactive";
// 计算属性
export default function computed(getter) {
  // 缓存上次计算的值
  let value;
  // dirty标志，用来标识是否需要重新计算值，为true则意味着 “ 脏 ”，需要计算
  let dirty = true;
  // 把getter作为副作用函数，创建一个lazy的effect
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      if (!dirty) {
        dirty = true;
        // 当计算属性依赖的响应式数据变化时，手动调用trigger函数触发响应
        trigger(obj, "value");
      }
    },
  });
  const obj = {
    // 当读取value时才执行effectFn
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      // 当读取value时，手动调用track函数进行追踪
      track(obj, "value");
      return value;
    },
  };

  return obj;
}
