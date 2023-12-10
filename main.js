// import './packages/reactive'
// import {
//   effect,
//   reactive,
//   ref,
//   toRef,
//   readonly,
//   shallowReactive,
// } from "./packages/reactive";
// const obj = reactive({ foo: 1, bar: 2 });
// const reffoo = toRef(obj, "foo");
// reffoo.value = 100;
// console.log(reffoo);
// p.set("key2", 3);
// arr[1] = "bar";
// arr.length = 3;
import createRenderer from "./packages/renderer";

const el = document.querySelector("#app");
// const vnode = {
//   type: "h1",
//   props: {
//     class: "clas2",
//   },
//   children: [
//     {
//       type: "p",
//       children: "hello",
//     },
//   ],
// };
const oldVNode = {
  type: "div",
  children: [
    { type: "p", children: "1.1", key: 1 },
    { type: "p", children: "2", key: 2 },
    { type: "p", children: "3", key: 3 },
    { type: "p", children: "4", key: 4 },
    { type: "p", children: "6", key: 6 },
    { type: "p", children: "5", key: 5 },
  ],
};

const newVNode = {
  type: "div",
  children: [
    { type: "p", children: "1", key: 1 },
    { type: "p", children: "3", key: 3 },
    { type: "p", children: "4", key: 4 },
    { type: "p", children: "2", key: 2 },
    { type: "p", children: "7", key: 7 },
    { type: "p", children: "5", key: 5 },
  ],
};

const MyComponent = {
  // 可选
  name: "MyComponent",
  // 组件接收名为 title 的 props，并且该 props 的类型为 String
  props: {
    title: String,
  },
  // 组件的渲染函数，其返回值必须为虚拟 DOM
  render() {
    return {
      type: "div",
      children: `count is: ${this.title}`,
    };
  },
  data() {
    return {
      foo: "hello world",
    };
  },
};

const MyComponent2 = {
  // 可选
  name: "MyComponent2",
  // 组件接收名为 title 的 props，并且该 props 的类型为 String
  props: {
    title: String,
  },
  // 组件的渲染函数，其返回值必须为虚拟 DOM
  render() {
    return {
      type: "div",
      children: `count2 is: ${this.title}`,
    };
  },
  data() {
    return {
      foo: "hello world2",
    };
  },
};

const vnode = {
  type: MyComponent,
  props: {
    title: "www",
  },
};
// const button = {
//   type: "button",
//   props: {
//     disabled: '',
//   },
//   children: "hello",
// };
// const input = {
//   type: "input",
//   props: {
//     form: "form1",
//   },
//   children: "hello",
// };
function shouldSetAsProps(el, key, value) {
  // 特殊处理
  if (key === "form" && el.tagName === "INPUT") return false;
  // 用in 操作符判断key是否存在对应的DOM Properties
  return key in el;
}
const renderer = createRenderer({
  // 创建元素
  createElement(tag) {
    return document.createElement(tag);
  },
  // 设置文本节点
  setElementText(el, text) {
    el.textContent = text;
  },
  /**
   * 用于在给定的parent下添加指定元素
   * @param {Element} el
   * @param {Element} parent
   * @param {Element|null} anchor
   */
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor);
  },
  /**
   *
   * @param {Element} el
   * @param {string} key
   * @param {*} perValue
   * @param {*} nextValue
   */
  // 将属性设置相关操作封装到 patchProps 函数中，并作为渲染器选项传递
  patchProps(el, key, perValue, nextValue) {
    // 对于事件的处理
    if (/^on/.test(key)) {
      // 获取事件处理函数，如果没有则设置为空对象
      // 一个节点可以绑定多个事件处理函数，所以使用对象结构保存
      const invokers = el._vei || (el._vei = {});
      // 获取对应的事件处理函数
      let invoker = invokers[key];
      // 事件名称
      const name = key.slice(2).toLowerCase();
      if (nextValue) {
        // 添加/更新事件
        if (!invoker) {
          // 无对应的事件处理函数，则创建一个伪事件处理函数 invoker，在 invoker中调用 value属性（真正的事件处理函数）
          invoker = el._vei[key] = (e) => {
            // e.timeStamp： 事件调用的时间
            // invoker.attached：事件注册的时间
            // 事件调用事件小于事件注册时间，则不会调用真正的事件处理函数
            if (e.timeStamp < invoker.attached) return;
            if (Array.isArray(invoker.value)) {
              // 同一个事件名可以绑定多个事件
              // invoker.value为数组时循环调用
              invoker.value.forEach((fn) => fn(e));
            } else {
              invoker.value(e);
            }
          };
          // 把 真正的事件处理函数 存储到 invoker.value 属性
          invoker.value = nextValue;
          // 事件注册的时间
          invoker.attached = performance.now();
          el.addEventListener(name, invoker);
        } else {
          // 有对应的事件处理函数，更新事件
          invoker.value = nextValue;
        }
      } else if (invoker) {
        // 移除事件
        el.removeEventListener(name, invoker);
      }
    } else if (key === "class") {
      // 对class特殊处理
      // 使用 className 性能最好
      el.className = nextValue || "";
    } else if (shouldSetAsProps(el, key, nextValue)) {
      // 使用 shouldSetAsProps 函数判断是否应该作为 DOM Properties 设置
      // 获取该DOM Properties的类型
      const type = typeof el[key];
      //   如果是布尔值，并且value是空字符串，则将值矫正为true
      if (type === "boolean" && value === "") {
        el[key] = true;
      } else {
        el[key] = nextValue;
      }
    } else {
      // 如果要设置的属性没有对应的DOM Properties，则使用 setAttribute 函数设置属性
      el.setAttribute(key, nextValue);
    }
  },
  createText(text) {
    return document.createTextNode(text);
  },
  setText(el, text) {
    el.nodeValue = text;
  },
});
renderer.render(vnode, el);
// setTimeout(() => {
//   renderer.render(vnode1, el);
//   //   renderer.render(newVNode, el);
// }, 3000);
// renderer.render(null, el);
// function renderer(domstring, container) {
//   container.innerHTML = domstring;
// }
// const count = ref(1);

// effect(() => {
//   renderer.render(`<h1>${count.value}<h1>`, el);
// });

// count.value++;
