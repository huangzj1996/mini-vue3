// import effect from "./effect";
import watch from "./watch";
import computed from "./computed";
// 存储副作用函数的桶
const bucket = new WeakMap();
// 存储被注册的副作用函数
let activeEffect;
const effectStack = [];
const ITERATE_KEY = Symbol();
const MAX_KEY_ITERATE_KEY = Symbol();
// 触发的类型
const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};
export function effect(fn, options = {}) {
  function effectFn() {
    // 调用cleanup函数完成清除工作
    cleanup(effectFn);
    // 当调用effect注册副作用函数的时候，将副作用函数fn赋值给activeEffect
    activeEffect = effectFn;
    // 在调用副作用函数之前将副作用函数压入栈中
    effectStack.push(effectFn);
    // 执行副作用函数
    const res = fn();
    // 副作用函数执行完之后，将当前副作用函数弹出栈，并把activeEffect还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  }
  // 将options挂载到effectFn上
  effectFn.options = options;
  // 等于activeEffect.deps 用来存储所有与该副作用函数相关的依赖集合
  effectFn.deps = [];
  // 只有lazy为false的时候才执行
  if (!options.lazy) {
    // 执行副作用函数
    effectFn();
  }
  // 将副作用函数作为返回值
  return effectFn;
}

function cleanup(effectFn) {
  // 遍历effectFn.deps数组
  for (let i = 0; i < effectFn.deps.length; i++) {
    // deps是依赖集合
    const deps = effectFn.deps[i];
    // 将effectFn从依赖集合中移除
    deps.delete(effectFn);
  }
  // 最后需要重置effectFn.deps数组
  effectFn.deps.length = 0;
}

// 存储原始对象到代理对象的映射
const reactiveMap = new Map();
// 每次调用reactive时，都会创建新的代理对象
export function reactive(obj) {
  // 先判断map里面有没有已经保存的代理对象，如果有就直接返回
  const existionProxy = reactiveMap.get(obj);
  if (existionProxy) return existionProxy;
  // 若没有就创建新的代理对象
  const proxy = createReactive(obj);
  // 存储到map中
  reactiveMap.set(obj, proxy);
  return proxy;
}
export function shallowReactive(obj) {
  return createReactive(obj);
}
export function readonly(obj) {
  return createReactive(obj, false, true /*只读*/);
}
export function shallowReadonly(obj) {
  return createReactive(obj, true, true /*只读*/);
}
// 数组方法重写
const arrayInstrumentations = {};
["includes", "indexOf", "lastIndexOf"].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    // this 是代理对象，先在代理对象中查找，将结果存储到res中
    let res = originMethod.apply(this, args);
    if (res === false || res === -1) {
      // res为false说明没有找到，通过this.raw拿到原始数组，再去其中查找并更新
      res = originMethod.apply(this.raw, args);
    }
    // 返回最终结果
    return res;
  };
});
// 一个标记变量，表示数据是否需要跟踪，true表示需要跟踪
let shouldTrack = true;
["push", "pop", "shift", "unshift", "splice"].forEach((method) => {
  // 获取原始的方法
  const originMethod = Array.prototype[method];
  // 重写方法
  arrayInstrumentations[method] = function (...args) {
    // 重写前把shouldTrack设置为false，表示不跟踪
    shouldTrack = false;
    // this 是代理对象，先在代理对象中查找，将结果存储到res中
    let res = originMethod.apply(this, args);
    // 调用原始方法后，恢复原来的行为，允许跟踪
    shouldTrack = true;
    // 返回最终结果
    return res;
  };
});

// Set结构方法
// 将自定义的方法定义到该对象下
const mutableInstrumentations = {
  add(key) {
    // this指向的是代理对象，通过raw属性获取原始数据对象
    const target = this.raw;
    // 判断值是不是已经存在
    const hadKey = target.has(key);
    // 通过原始数据对象执行add方法添加具体值
    const res = target.add(key);
    // 不存在才会触发响应
    if (!hadKey) {
      // 通过trigger函数触发响应，并指定操作类型ADD
      trigger(target, key, TriggerType.ADD);
    }
    // 返回操作结果
    return res;
  },
  delete(key) {
    const target = this.raw;
    const hadKey = target.has(key);
    const res = target.delete(key);
    if (hadKey) {
      trigger(target, key, TriggerType.DELETE);
    }
    return res;
  },
  get(key) {
    // 获取原始对象
    const target = this.raw;
    // 判断读取的key是不是存在
    const had = target.has(key);
    // 跟踪依赖，建立响应联系
    track(target, key);
    // 如果存在，则返回结果，如果得到的结果res仍是可代理的数据
    // 则要返回使用reactive包装后的响应式数据
    if (had) {
      const res = target.get(key);
      return typeof res == "object" ? reactive(res) : res;
    }
  },
  set(key, value) {
    const target = this.raw;
    const had = target.has(key);
    // 获取旧值
    const oldValue = target.get(key);
    const rawValue = value.raw || value;
    target.set(key, rawValue);
    // 判读是否存在，不存在就是添加数据
    if (!had) {
      trigger(target, key, TriggerType.ADD);
    } else if (
      oldValue != value ||
      (oldValue === oldValue && value === value)
    ) {
      // 存在设置数据
      trigger(target, key, TriggerType.SET);
    }
  },
  forEach(callBack, thisArg) {
    // 把可代理数据转换成响应式数据
    const warp = (val) => (typeof val === "object" ? reactive(val) : val);
    const target = this.raw;
    track(target, ITERATE_KEY);
    target.forEach((v, k) => {
      // 手动调用，实现深层响应式
      callBack.call(thisArg, warp(v), warp(k), this);
    });
  },
  [Symbol.iterator]: iterationMethod,
  entries: iterationMethod,
  values: valuesIterationMethod,
  keys: keysIterationMethod,
};

function iterationMethod() {
  const target = this.raw;
  const itr = target[Symbol.iterator]();
  const warp = (val) =>
    typeof val === "object" && val !== null ? reactive(val) : val;
  track(target, ITERATE_KEY);
  return {
    next() {
      const { value, done } = itr.next();
      return {
        value: value ? [warp(value[0]), warp(value[1])] : value,
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}

function valuesIterationMethod() {
  const target = this.raw;
  const itr = target.values();
  const warp = (val) =>
    typeof val === "object" && val !== null ? reactive(val) : val;
  track(target, ITERATE_KEY);
  return {
    next() {
      const { value, done } = itr.next();
      return {
        value: value ? warp(value) : value,
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}
function keysIterationMethod() {
  const target = this.raw;
  const itr = target.keys();
  const warp = (val) =>
    typeof val === "object" && val !== null ? reactive(val) : val;
  track(target, MAX_KEY_ITERATE_KEY);
  return {
    next() {
      const { value, done } = itr.next();
      return {
        value: value ? warp(value) : value,
        done,
      };
    },
    [Symbol.iterator]() {
      return this;
    },
  };
}
// isShallow，表示是否为浅响应，默认false，即非浅响应
// isReadonly，表示是否为只读，默认false，即非只读
export function createReactive(data, isShallow = false, isReadonly = false) {
  return new Proxy(data, {
    // 拦截读取操作,接收第三个参数receiver
    get(target, key, receiver) {
      console.log("get:", key);
      // 如果读取的是'size'属性，通过设置第三个参数的receiver为原始对象，从而解决问题
      // 代理对象可以使用raw属性访问原始数据
      if (key === "raw") {
        return target;
      }
      if (key === "size") {
        track(target, ITERATE_KEY);
        return Reflect.get(target, key, target);
      }
      // 如果操作的目标对象时数组，并且key存在于arrayInstrumentations上，那么返回定义在arrayInstrumentations上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      // 非只读时（可以修改），并且key不为symbol类型，才需要建立响应联系
      if (!isReadonly && typeof key !== "symbol") {
        // 将副作用函数activeEffect添加到副作用函数桶中
        track(target, key);
      }

      // 返回属性值 使用Reflect.get返回读取到的属性值
      const res = Reflect.get(target, key, receiver);
      if (isShallow) {
        return res;
      }
      if (typeof res === "object" && res !== null) {
        // 如果数据为只读，则调用readonly对值进行包装
        return isReadonly ? readonly(res) : reactive(res);
      }
      return res;
      // 返回定义在mutableInstrumentations对象下的方法
      return mutableInstrumentations[key];
    },
    // 拦截设置操作
    set(target, key, newValue, receiver) {
      // 如果是只读，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性${key}是只读的`);
        return true;
      }
      // 获取旧值
      const oldValue = target[key];
      // 如果属性不存在，则说明是在添加新属性，否则是设置已有属性
      const type = Array.isArray(target)
        ? // 如果代理目标时数组，则检测被设置的索引值是否小于数组长度
          // 如果是，则视作set操作，否则是add操作
          Number(key) < target.length
          ? TriggerType.SET
          : TriggerType.ADD
        : Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      // 设置属性
      const res = Reflect.set(target, key, newValue, receiver);
      // 判断receiver是不是target的代理对象
      if (target === receiver.raw) {
        // 新值和旧值不相等的时候，并且都不是NAN的时候才触发
        if (
          oldValue !== newValue &&
          (oldValue === oldValue || newValue === newValue)
        ) {
          // 把副作用函数从桶中取出来并执行,第四个参数：触发响应的新值
          trigger(target, key, type, newValue);
        }
      }
      return res;
    },
    deleteProperty(target, key) {
      // 如果是只读，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性${key}是只读的`);
        return true;
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (res && hadKey) {
        trigger(target, key, TriggerType.DELETE);
      }
      return res;
    },
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      //判断目标对象是不是数组，如果是使用length属性作为key并建立响应联系，若不是将副作用函数和ITERATE_KEY关联
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
  });
}

// 封装一个ref函数
export function ref(val) {
  // 在ref函数内部创建包裹对象
  const wrapper = {
    value: val,
  };
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });
  return reactive(wrapper);
}
export function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key];
    },
    set value(val) {
      obj[key] = val;
    },
  };
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });
  return wrapper;
}
export function toRefs(obj) {
  const ret = {};
  for (const key in obj) {
    ret[key] = toRef(obj, key);
  }
  return ret;
}

export function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      return value.__v_isRef ? value.value : value;
    },
    set(target, key,newValue, receiver){
      const value = target[key]
      if(value.__v_isRef){
        value.value = newValue
        return true
      }
      return Reflect.set(target,key,newValue,receiver)
    }
  });
}
// 在get拦截函数内调用tract函数追踪变化
export function track(target, key) {
  console.log("track", target, key);
  // 没有activeEffect,禁止跟踪时 直接返回
  if (!activeEffect || !shouldTrack) return target[key];
  // 根据target 从桶中取出depsMap , 它是个map类型，结构key--->effects
  let depsMap = bucket.get(target);
  // 如果不存在depsMap，就新建一个map并与target相关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  //根据key从depsMap中取出deps，它是个Set类型
  // 里面存储这与key相关连的所有副作用函数
  let deps = depsMap.get(key);
  //   如果不存在deps，同时新建个Set并与之key关联
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  //   最后将激活的副作用函数添加到桶里
  deps.add(activeEffect);
  // deps就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到activeEffect.deps数组种
  activeEffect.deps.push(deps);
}

// 在set拦截函数中调用trigger函数触发变化
export function trigger(target, key, type, newVal) {
  console.log("trigger", key);
  // 根据target获取桶中的depsMap，它是key---->effects
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 根据key获取所有effects函数，并执行
  const effects = depsMap.get(key);
  const effectsToRun = new Set();
  // 将与key相关的副作用函数添加到effectsToRun
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn != activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  if (
    type === TriggerType.ADD ||
    type === TriggerType.DELETE ||
    // 即使是set类型操作，也会触发那些与ITERATE_KEY相关联的副作用函数重新执行
    (type === TriggerType.SET &&
      Object.prototype.toString.call(target) === "[object Map]")
  ) {
    // 获取与ITERATE_KEY相关的副作用函数，并执行
    const iterateEffects = depsMap.get(ITERATE_KEY);
    // 将与 ITERATE_KEY 相关的副作用函数添加到effectsToRun
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn != activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  if (
    (type === TriggerType.ADD || type === TriggerType.DELETE) &&
    Object.prototype.toString.call(target) === "[object Map]"
  ) {
    // 获取与MAX_KEY_ITERATE_KEY相关的副作用函数，并执行
    const iterateEffects = depsMap.get(MAX_KEY_ITERATE_KEY);
    // 将与 MAX_KEY_ITERATE_KEY 相关的副作用函数添加到effectsToRun
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn != activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  // 当操作类型为add并且对象是数组时，应该取出并执行那些与length属性相关联的副作用函数
  if (type === TriggerType.ADD && Array.isArray(target)) {
    // 获取与length相关的副作用函数，并执行
    const lengthEffects = depsMap.get("length");
    // 将与 length 相关的副作用函数添加到effectsToRun
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn != activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  // 如果操作目标是数组，并且修改了数组的length属性
  if (Array.isArray(target) && key === "length") {
    // 对于索引值大于等于新的length值得元素，
    // 需要把所有相关联的副作用函数取出并添加到effectsToRun中待执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach((effectFn) => {
          if (effectFn != activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
      }
    });
  }
  effectsToRun.forEach((effectFn) => {
    // 如果一个副作用函数存在调度器，则调用该调度器，并将副作用函数作为参数传递
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      // 否则直接执行副作用函数
      effectFn();
    }
  });
}

// 定义一个任务队列
const jobQueue = new Set();
// 使用promise.resolve()创建一个promise实例，用它将一个任务添加到微任务队列
const p = Promise.resolve();
console.log(bucket);
// 一个标志代表是否正在刷新队列
let isFlushing = false;
// 刷新工作区
function flushJob() {
  // 如果队列正在刷新就什么也不做
  if (isFlushing) return;
  // 设置为true代表正在刷新
  isFlushing = true;
  // 在微任务队列中刷新jobQueue队列
  p.then(() => {
    jobQueue.forEach((job) => job());
  }).finally(() => {
    // 结束后重置isFlushing
    isFlushing = false;
  });
}
