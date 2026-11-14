# 平台适配器（adapters/）

每个平台一个独立文件，避免「通用脚本猜选择器」导致的填错/漏填。

## 结构

```js
module.exports = {
  id, name, hostText,
  titleSelectors: [],   // 标题候选（优先 data-testid/name/placeholder/aria-label）
  contentSelectors: [], // 正文候选（ProseMirror / Quill / CodeMirror / UEditor / contenteditable / textarea）
  coverSelectors: [],   // 封面上传 input[type=file]
  tagSelectors: [],     // 标签输入
  publishSelectors: [], // 只放平台特有文案/属性，禁止泛化 'button:has-text("发布")'
  publishTexts: [],     // 文案兜底（顺序即优先级）
  dialogTexts: [],      // 原创声明/同步/确认等弹窗按钮
  async afterFill(page, log) {},
  async handleDialogs(page, log) {},
  async preflight(page, log) {} // 发布前必填项检查，返回 {ok, issues}
};
```

## 已实现

csdn / baijia / juejin / cnblogs / wechat / zhihu / jianshu / segmentfault /
huaweicloud / tencentcloud / aliyun / c51cto / oschina / infoq

## 优先级

`adapters/<id>.js` 选择器 → `platforms.js` 平台配置 → automation 通用启发式。

微信公众号的正文位于 `#ueditor_0` iframe，标题在主文档；标题填充通过 `pickVisibleIn`
（主文档 + 所有 frame）自动覆盖嵌套结构。

## 测试

```bash
node tools/test-adapters.js
```

覆盖：注册表完整性、iframe 内标题注入、发布前检查、弹窗点击、标题长度截断。
