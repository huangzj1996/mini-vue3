function createRenderer(options) {
  const { createElement, setElementText, insert, patchProps } = options;
  function patchElement(n1, n2) {}
  /**
   * 挂载
   * @param {*} vnode
   * @param {*} container
   */
  function mountElement(vnode, container) {
    console.log(vnode, container);
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
    insert(el, container, null);
  }
  /**
   * 挂载和更新
   * @param {vnode} n1 :旧vnode
   * @param {vnode} n2 :新vnode
   * @param {Element} container
   */
  function patch(n1, n2, container) {
    // 如果 n1 存在，则对比n1 和 n2 的类型
    if (n1 && n1.type !== n2.type) {
      // 如果新旧 vnode 类型不一样，则直接将旧 vnode 卸载
      unmount(n1);
      n1 = null;
    }
    // n1 和 n2 类型相同
    const { type } = n2;
    if (typeof type === "string") {
      // n1不存在，意味着挂载，使用mountElement函数完成挂载
      if (!n1) {
        mountElement(n2, container);
      } else {
        // n1存在，意味着更新
        patchElement(n1, n2);
      }
    } else if (typeof type === "object") {
    } else {
    }
  }
  // 卸载
  function unmount(vnode) {
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

export default createRenderer;
