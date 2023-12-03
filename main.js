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
const { effect, ref } = VueReactivity;
const el = document.querySelector("#app");
const vnode = {
  type: "h1",
  props: {
    class: "clas2",
  },
  children: [
    {
      type: "p",
      children: "hello",
    },
  ],
};
// const button = {
//   type: "button",
//   props: {
//     disabled: '',
//   },
//   children: "hello",
// };
const input = {
  type: "input",
  props: {
    form: "form1",
  },
  children: "hello",
};
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
    if (/^on/.test(key)) {
      const invokers = el._vei || (el._vei = {});
      let invoker = invokers[key];
      const name = key.slice(2).toLowerCase();
      if (nextValue) {
        if (!invoker) {
          invoker = el._vei[key] = (e) => {
            if (e.timeStamp < invoker.attached) return;
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach((fn) => fn(e));
            } else {
              invoker.value(e);
            }
          };
          invoker.value = nextValue;
          invoker.attached = performance.now();
          el.addEventListener(name, invoker);
        } else {
          invoker.value = nextValue;
        }
      } else if (invoker) {
        el.removeEventListener(name, invoker);
      }
    } else if (key === "class") {
      // 对class特殊处理
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
});
renderer.render(vnode, el);
// renderer.render(null, el);
// function renderer(domstring, container) {
//   container.innerHTML = domstring;
// }
// const count = ref(1);

// effect(() => {
//   renderer.render(`<h1>${count.value}<h1>`, el);
// });

// count.value++;
