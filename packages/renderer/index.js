const { effect, ref, reactive, shallowReactive } = VueReactivity;

function createRenderer(options) {
  const Text = Symbol();
  const Fragment = Symbol();
  const {
    createElement,
    setElementText,
    insert,
    patchProps,
    createText,
    setText,
  } = options;
  /**
   * n1,n2 type相同，并且都存在时调用，
   * 包含具体的逻辑，更新节点的props和子节点
   * @param {vnode} n1
   * @param {vnode} n2
   */
  function patchElement(n1, n2) {
    const el = (n2.el = n1.el);
    const newProps = n2.props;
    const oldProps = n1.props;
    // 1.更新props
    for (const key in newProps) {
      if (oldProps[key] !== newProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key]);
      }
    }
    for (const key in oldProps) {
      if (!(key in newProps)) {
        // 删除不在新节点的props属性
        patchProps(el, key, oldProps[key], null);
      }
    }
    // 2.更新子节点
    patchChildren(n1, n2, el);
  }
  /**
   * 更新子节点具体逻辑
   * @param {vnode} n1
   * @param {vnode} n2
   * @param {Element} container
   */
  function patchChildren(n1, n2, container) {
    if (typeof n2.children === "string") {
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c));
      }
      setElementText(container, n2.children);
    } else if (Array.isArray(n2.children)) {
      if (Array.isArray(n1.children)) {
        // diff算法
        patchKeyedChildren(n1, n2, container);
      } else {
        setElementText(container, "");
        n2.children.forEach((c) => patch(null, c, container));
      }
    } else {
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c));
      } else if (typeof n1.children === "string") {
        setElementText(container, "");
      }
    }
  }
  /**
   * diff算法具体代码
   * @param {vnode} n1
   * @param {vnode} n2
   * @param {Element} container
   */
  function patchKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 更新相同的前置节点
    // 指向新旧子节点的开头
    let j = 0;
    let oldVNode = oldChildren[j];
    let newVNode = newChildren[j];
    while (newVNode.key === oldVNode.key) {
      patch(oldVNode, newVNode, container);
      j++;
      oldVNode = oldChildren[j];
      newVNode = newChildren[j];
    }

    // 更新相同的后置节点
    let oldEnd = oldChildren.length - 1;
    let newEnd = newChildren.length - 1;
    oldVNode = oldChildren[oldEnd];
    newVNode = newChildren[newEnd];
    while (oldVNode.key === newVNode.key) {
      patch(oldVNode, newVNode, container);
      oldEnd--;
      newEnd--;
      oldVNode = oldChildren[oldEnd];
      newVNode = newChildren[newEnd];
    }

    // 预处理完毕后，如果满足如下条件，则说明从 j --> newEnd 之间的节点应作
    // 为新节点插入
    if (j > oldEnd && j <= newEnd) {
      // 锚点的索引
      const anchorIndex = newEnd + 1;
      // 锚点元素
      const anchor =
        anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;
      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor);
      }
    } else if (j > newEnd && j <= oldEnd) {
      // j -> oldEnd 之间的节点应该被卸载
      while (j <= oldEnd) {
        unmount(oldChildren[j++]);
      }
    } else {
      // 增加 else 分支来处理非理想情况
      const count = newEnd - j + 1;
      // 用来存储新的一组子节点在旧的子节点中位置的索引
      const source = new Array(count);
      source.fill(-1);
      // oldStart 和 newStart 分别为起始索引，即 j
      const oldStart = j;
      const newStart = j;
      let moved = false;
      let pos = 0;
      // 构建索引表
      // key: 新节点的key
      // value: 新节点的位置
      const keyIndex = {};
      for (let i = newStart; i <= newEnd; i++) {
        keyIndex[newChildren[i].key] = i;
      }
      // 新增 patched 变量，代表更新过的节点数量
      let patched = 0;
      // 遍历旧的一组子节点中剩余未处理的节点
      for (let i = oldStart; i <= oldEnd; i++) {
        oldVNode = oldChildren[i];
        // 如果更新过的节点数量小于等于需要更新的节点数量，则执行更新
        if (patched <= count) {
          const k = keyIndex[oldVNode.key];
          if (typeof k !== "undefined") {
            newVNode = newChildren[k];
            // 调用 patch 进行更新
            patch(oldVNode, newVNode, container);
            // 最后填充 source 数组
            source[k - newStart] = i;
            // 每更新一个节点，都将 patched 变量 +1
            patched++;
            if (k < pos) {
              moved = true;
            } else {
              pos = k;
            }
          } else {
            // 没找到
            unmount(oldVNode);
          }
        } else {
          // 如果更新过的节点数量大于需要更新的节点数量，则卸载多余的节点
          unmount(oldVNode);
        }
      }
      // 如果 moved 为真，则需要进行 DOM 移动操作
      if (moved) {
        // 计算最长递增子序列 存储的是位置索引
        const seq = lis(source);
        // s 指向最长递增子序列的最后一个元素
        let s = seq.length - 1;
        // i 指向新的一组子节点的最后一个元素
        let i = count - 1;
        for (i; i >= 0; i--) {
          if (source[i] == -1) {
            // 新增节点
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            const nextPos = pos + 1;
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null;
            patch(null, newVNode, container, anchor);
          } else if (i !== seq[s]) {
            // 如果节点的索引 i 不等于 seq[s] 的值，说明该节点需要移动
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            const nextPos = pos + 1;
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null;
            // 使用insert函数插入数据
            insert(newVNode.el, container, anchor);
          } else {
            // 当 i === seq[s] 时，说明该位置的节点不需要移动
            // 只需要让 s 指向下一个位置
            s--;
          }
        }
      } else {
      }
      console.log(source, keyIndex);
    }
  }
  /**
   * 挂载
   * @param {*} vnode
   * @param {*} container
   */
  function mountElement(vnode, container, anchor) {
    // 1.创建元素
    // 让vnode.el 引用真实DOM元素
    const el = (vnode.el = createElement(vnode.type));
    if (typeof vnode.children === "string") {
      // 2.设置文本节点
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      // 如果children是数组，遍历每个子节点，并调用patch函数挂载他们
      vnode.children.forEach((child) => {
        patch(null, child, el);
      });
    }
    // 如果存在props才处理
    if (vnode.props) {
      // 遍历props
      for (const key in vnode.props) {
        // 调用 patchProps 函数
        patchProps(el, key, null, vnode.props[key]);
      }
    }
    // 调用insert函数将元素插到容器内
    // 在插入节点时，将锚点元素透传给 insert 函数
    insert(el, container, anchor);
  }
  /**
   * 挂载和更新
   * @param {vnode} n1 :旧vnode
   * @param {vnode} n2 :新vnode
   * @param {Element} container
   */
  function patch(n1, n2, container, anchor) {
    // 如果 n1 存在，则对比n1 和 n2 的类型
    if (n1 && n1.type !== n2.type) {
      // 如果新旧 vnode 类型不一样，则直接将旧 vnode 卸载
      unmount(n1);
      n1 = null;
    }
    // n1 和 n2 类型相同
    const { type } = n2;
    // 标签
    if (typeof type === "string") {
      // n1不存在，意味着挂载，使用mountElement函数完成挂载
      if (!n1) {
        // 挂载时将锚点元素作为第三个参数传递给 mountElement 函数
        mountElement(n2, container, anchor);
      } else {
        // n1存在，意味着更新
        patchElement(n1, n2);
      }
    } else if (typeof type === "object") {
      // 组件
      if (!n1) {
        // 挂载组件
        mountComponent(n2, container, anchor);
      } else {
        // 更新组件
        patchComponent(n1, n2, anchor);
      }
    } else if (type === Text) {
      if (!n1) {
        const el = (n2.el = createText(n2.children));
        insert(el, container);
      } else {
        const el = (n2.el = n1.el);
        if (n1.children !== n2.children) {
          setText(el, n2.children);
        }
      }
    } else if (type === Fragment) {
      if (!n1) {
        n2.children.forEach((c) => patch(null, c, container));
      } else {
        patchChildren(n1, n2, container);
      }
    }
  }
  /**
   * 挂载组件
   * @param {*} vnode
   * @param {*} container
   * @param {*} anchor
   */
  function mountComponent(vnode, container, anchor) {
    console.log(vnode, container, anchor);
    // 获取组件内容
    const componentOptions = vnode.type;
    const {
      render,
      data,
      props: propsOption,
      beforeCreate,
      created,
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
    } = componentOptions;
    beforeCreate && beforeCreate();
    // 组件状态设置成响应式数据
    const state = reactive(data());
    // 调用 resolveProps 函数解析出最终的 props 数据与 attrs 数据
    const [props, attrs] = resolveProps(propsOption, vnode.props);

    // 组件实例
    const instance = {
      // 组件自身的状态数据，即 data
      state,
      // 将解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
      props: shallowReactive(props),
      // 一个布尔值，用来表示组件是否已经被挂载，初始值为 false
      isMounted: false,
      // 组件所渲染的内容，即子树（subTree）
      subTree: null,
    };
    // 将组件实例设置到 vnode 上，用于后续更新
    vnode.component = instance;
    created && created();

    effect(
      () => {
        // 调用组件的渲染函数，获得子树
        const subTree = render.call(state, state);
        // 检查组件是否已经被挂载

        if (!instance.isMounted) {
          beforeMount && beforeMount();
          // 初次挂载，调用 patch 函数第一个参数传递 null
          patch(null, subTree, container, anchor);
          // 重点：将组件实例的 isMounted 设置为 true，这样当更新发生时就不会再次进行挂载操作，
          // 而是会执行更新
          instance.isMounted = true;
          mounted && mounted();
        } else {
          beforeUpdate && beforeUpdate();
          // 当 isMounted 为 true 时，说明组件已经被挂载，只需要完成自更新即可，
          // 所以在调用 patch 函数时，第一个参数为组件上一次渲染的子树，
          // 意思是，使用新的子树与上一次渲染的子树进行打补丁操作
          patch(instance.subTree, subTree, container, anchor);
          updated && updated();
        }
        instance.subTree = subTree;
      },
      { scheduler: queueJob }
    );
  }
  function patchComponent(params) {}
  // 卸载
  function unmount(vnode) {
    if (vnode.type === Fragment) {
      vnode.children.forEach((c) => unmount(c));
      return;
    }
    // 获取卸载元素的父元素
    const parent = vnode.el.parentNode;
    // 调用 removeChild 移除元素
    if (parent) parent.removeChild(vnode.el);
  }
  /**
   * 渲染
   * @param {{type:string}} vnode
   * @param {Element} container
   */
  function render(vnode, container) {
    // console.log(vnode, container);
    if (vnode) {
      //新vnode存在，将其与旧vnode一起传递给patch函数，进行打补丁
      patch(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        // 旧vnode存在。新vnode不存在，说明是卸载操作
        // 调用 unmount 函数卸载 vnode
        unmount(container._vnode);
      }
    }
    // 把vnode存储到container._vnode中，即后续渲染中的旧vnode
    container._vnode = vnode;
  }
  function hydrate(vnode, container) {}
  return {
    render,
    hydrate,
  };
}
const queue = new Set();
let isFlushing = false;
const p = Promise.resolve();
function queueJob(job) {
  queue.add(job);
  if (!isFlushing) {
    isFlushing = true;
    p.then(() => {
      try {
        queue.forEach((job) => job());
      } finally {
        isFlushing = false;
        queue.clear();
      }
    });
  } else {
  }
}

function lis(nums) {
  // 保存的是位置
  let result = [],
    preIndex = [];
  for (let i = 0; i < nums.length; i++) {
    let last = nums[result[result.length - 1]],
      current = nums[i];
    if (current > last || last === undefined) {
      // 当前项大于最后一项
      preIndex[i] = result[result.length - 1];
      result.push(i);
    } else {
      // 当前项小于最后一项，二分查找+替换
      let start = 0,
        end = result.length - 1,
        middle;
      while (start < end) {
        // 重合就说明找到了 对应的值,时间复杂度O(logn)
        middle = Math.floor((start + end) / 2); // 找到中间位置的前一个
        if (nums[result[middle]] > current) {
          end = middle;
        } else {
          start = middle + 1;
        }
      }

      // 如果相同 或者 比当前的还大就不换了
      if (current < nums[result[start]]) {
        preIndex[i] = result[start - 1]; // 要将他替换的前一个记住
        result[start] = i;
      }
    }
  }
  // 利用前驱节点重新计算result
  let length = result.length, //总长度
    prev = result[length - 1]; // 最后一项
  while (length-- > 0) {
    // 根据前驱节点一个个向前查找
    result[length] = prev;
    prev = preIndex[result[length]];
  }
  console.log(result, preIndex);
  return result;
}
// resolveProps 函数用于解析组件 props 和 attrs 数据
function resolveProps(options, propsData) {
  const props = {};
  const attrs = {};
  // 遍历为组件传递的 props 数据
  for (const key in propsData) {
    // 如果为组件传递的 props 数据在组件自身的 props 选项中有定义，则将其视为合法的 props
    if (key in options) {
      props[key] = propsData[key];
    } else {
      attrs[key] = propsData[key];
    }
  }
  return [props, attrs];
}

export default createRenderer;
