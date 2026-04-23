# Changelog

## 1.1.9

### Fixes

- **IME 输入法回车误触发保存**: 中文/日文等输入法在 composing 状态下按回车应仅用于确认候选词，不应触发 alt 保存。现对 alt 编辑 modal 与图片 caption 内联编辑两处回车绑定添加 `isComposing` / `keyCode === 229` 守卫。

## 1.1.8

### Fixes

- **Caption 误识别外链 URL 片段**: 修复 Obsidian 为无 alt 的外链图片（如 `![](http://...?imageMogr2/.../1000k!)`）自动填充 URL 片段到 img alt 时，被错误当作用户 caption 显示的问题。现在只要 alt 是 src 的子串就视为自动生成，不再注入 caption。

## 1.1.7

### Features

- **查看大图**: 在 Reading / Live Preview / Source Mode 的图片右键菜单与 Live Preview 双击均可打开大图预览模态窗口
- **图片 Caption**: 渲染模式下自动在图片下方显示 alt 作为 caption，点击可就地编辑并回写到源文件 (`![alt](src)` / `![[target|alt]]`)
- **大图模态内编辑 alt**: 编辑模式打开预览时，底部支持直接修改 alt（回车保存，Esc 取消）

### Dev

- `pnpm dev` 支持 `OBSIDIAN_VAULT_PATH` / `OBSIDIAN_PLUGIN_PATH` 环境变量，自动 rsync 构建产物到目标 vault 插件目录并写入 `.hotreload`，配合 pjeby 的 Hot Reload 插件实现保存即热更新
- 新增 `.env.example`；`esbuild.config.mjs` 内联 .env 解析（无需 dotenv 依赖）

## 1.1.6

- chore: init claude
- chore: ignore data.json

## 1.1.5

- Reduce console output and avoid `innerHTML` usage for plugin review

## 1.1.4

- Drop `v` prefix from release tags (Obsidian community plugin requirement)
