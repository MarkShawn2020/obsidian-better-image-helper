在 Obsidian 的插件系统中，并没有一个专门“右击图片”就会触发的官方事件。通常你需要借助 **DOM 事件** 或者 **编辑器事件** 来捕获这个操作。下面整理了几个常见场景的方式，并说明它们各自的回调参数。

---

## 1. 编辑模式下右击图片默认行为

- **在 Source Mode（纯 Markdown 模式）下**：  
  图片在编辑器中其实是纯文本的 Markdown 语法（例如 `![](image.png)` ）。右击时，Obsidian 并不会把它当做 HTML `<img>` 标签处理，它只是文本；因此会出现普通的 CodeMirror 编辑器右键菜单，或者操作系统默认菜单，而不会有专门针对 `<img>` 的菜单。

- **在 Live Preview（实时预览）模式下**：  
  Obsidian 会把 `![](image.png)` 渲染为一个真正的 HTML `<img>` 元素，右击会触发浏览器上下文菜单（Electron 的 webview），也会出现 Obsidian 内置的一些常规项目，如复制链接、打开文件等。

- **在 Reading Mode（阅读模式）下**：  
  这并非“编辑模式”，但如果用户右击图片，会有内置的图片相关菜单选项，包括“在新标签页中打开图片”、“复制图片地址”、“复制图片”等。

因此，在“编辑模式”下如果是纯 Markdown，Obsidian 并没有提供“专门右击图片”的菜单，而是把它当作编辑器内的文本处理；只有在 Live Preview 时，图片才真的是 `<img>` 元素，右击会出现浏览器或 Obsidian 自带菜单。

---

## 2. 如何捕获这个事件

### 2.1 利用 `this.registerDomEvent` 监听 DOM 的 `contextmenu` 事件

如果你要在 Live Preview 或者 Reading Mode 下捕获对 `<img>` 的右击，可以通过插件的 `registerDomEvent` 去监听全局或指定容器内的 `contextmenu` 事件，然后判断事件触发的目标是否为 `<img>` 元素。示例：

```ts
// 在你的插件的 onload() 中
this.registerDomEvent(document, "contextmenu", (evt: MouseEvent) => {
  const target = evt.target as HTMLElement;
  if (target.tagName.toLowerCase() === "img") {
    // 这里就捕获到了对 <img> 元素的右击
    console.log("Right-click on image:", target);

    // 如果想阻止默认菜单并执行你自己的逻辑：
    evt.preventDefault();
    evt.stopPropagation();

    // 在这里你可以弹出自己的菜单，或者处理其他逻辑
    // ...
  }
});
```

- **回调参数**：  
  - `evt`：一个标准的 `MouseEvent` 对象，可以通过 `evt.target` 获取被点击的元素。
  - 没有其他特殊参数，Obsidian 不会额外注入更多信息。

通过这种方式，如果用户在 Live Preview 模式下右击图片，你就能拦截并执行自己的操作。  
但要注意，在 Source Mode（纯文本模式）下，点击的其实是文本，并非 `<img>`，不会命中 `<img>` 判断。

---

### 2.2 利用编辑器事件（CodeMirror）监听

Obsidian（除 1.0 之后的 Live Preview 以外）的大部分编辑模式是基于 CodeMirror。你也可以用插件 API 提供的 `registerEditorDomEvent` 来监听编辑器内部的 DOM 事件。示例：

```ts
this.registerEditorDomEvent(
  app.workspace.getActiveViewOfType(MarkdownView)?.editor,
  "contextmenu",
  (evt: MouseEvent) => {
    const target = evt.target as HTMLElement;
    // 在纯 Markdown 模式下，这里 target 通常是 <span>、<div> 或文本节点，不是 img
    // 你可以根据文本内容、光标位置等进行进一步判断
    console.log("contextmenu in the editor:", target);
  }
);
```

- **回调参数**：  
  - 同样是原生 `MouseEvent`。  
  - 因为是注册在编辑器 DOM 上，回调里并没有直接告诉你“这是哪一个 token 或文本”；你需要自己判断 `evt.target` 或者根据编辑器光标位置来推断是否是图片 Markdown 语法。

不过，由于在 Source Mode 下并没有真实的 `<img>` 标签，所以这一招只能用来判断是否对 `![](...)` 这样的 markdown 语法右击，而不会出现真正的图片菜单。要想判断是否是“图片”那一段 markdown，还需要自己检查点击位置的 Token（可能要结合 `editor.posAtCoords()` 或者查看 `evt.target` 的父元素等）。

---

### 2.3 Obsidian 的内置 “contextmenu” Hooks

Obsidian 并没有提供非常细分的 “右击图片就调用某个函数” 事件，但有一些菜单相关的钩子可以让你在出现菜单前进行修改或插入菜单项，例如：

```ts
this.registerEvent(
  this.app.workspace.on("editor-menu", (menu, editor, view) => {
    // 当用户在编辑器（CodeMirror）上触发右键时会触发这个回调
    // 这里你可以往 menu 里添加/修改菜单项
    // 但 editor-menu 并不会区分具体点到了图片还是文本，需要你自行判断选区或光标位置
  })
);
```

- **回调参数**：  
  - `menu`：Obsidian 的 `Menu` 对象，可用 `menu.addItem(...)` 等方法添加自定义菜单项。  
  - `editor`：CodeMirror 编辑器实例（或 CM6 的实例），你可以用它来判断当前选中的文本或光标位置。  
  - `view`：通常是 `MarkdownView`，代表当前激活的编辑器视图。

但是需要强调的是，这个事件主要是“针对编辑器内右键弹出的 Obsidian 菜单”，它不会区分你到底点到了什么元素，还需要你自己去检测当前光标附近的文本是不是 `![](image.jpg)` 这样的图片语法。

---

## 3. 小结

1. **在纯文本编辑模式**（Source Mode）下，图片只是普通的 Markdown 语法字符串，右击时并没有“图片”概念，只会出现编辑器自身或系统右键菜单。  
2. **在实时预览模式**（Live Preview）或 **阅读模式**（Reading Mode）下，`![](xxx)` 会被渲染成 `<img>`，此时你可以用 `this.registerDomEvent(..., "contextmenu", ...)` 检测到真正的 `<img>` 被右击，从而执行相应逻辑。  
3. 如果需要和 Obsidian 内置菜单交互，可以使用 `editor-menu` 之类的事件，在出现右键菜单前插入自定义菜单项，但要自己判断是否与图片相关。  

**回调的参数**大都基于标准 DOM 事件（`MouseEvent`），以及 Obsidian 提供的菜单对象、编辑器对象等，没有额外的“图片信息”字段。如果你要得知是哪个图片、图片路径是什么，需要在回调里自行根据 DOM、光标位置或 Markdown 文本解析来获取。