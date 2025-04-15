# Obsidian Image OCR Plugin

图片 OCR 文字识别插件，在 Obsidian 中右键点击图片即可识别图片中的文字。

## 功能

- 在 Obsidian 中右键点击图片，快速识别图片中的文字
- 支持在阅读模式、编辑模式（Live Preview）和源码模式（Source Mode）下右键图片
- 使用阿里云 OCR API 进行识别，识别速度快，准确率高
- 识别结果会自动复制到剪贴板，并创建一个新的文档

## 安装

### 从 dist 文件夹安装

1. 下载或clone本仓库
2. 将整个 `dist` 文件夹复制到 Obsidian 插件目录：`.obsidian/plugins/obsidian-image-ocr/`
3. 在 Obsidian 设置 > 社区插件中启用插件

### 手动构建安装

1. 克隆仓库到本地
2. 运行 `pnpm install` 安装依赖
3. 运行 `pnpm run build` 构建插件
4. 将生成的 `dist` 目录复制到 Obsidian 插件目录：`.obsidian/plugins/obsidian-image-ocr/`
5. 在 Obsidian 设置中启用插件

## 使用

1. 在 Obsidian 插件目录下的 `.env` 文件中设置阿里云 OCR API 的 AccessKey：

```env
ALI_AK=您的阿里云AccessKey
ALI_SK=您的阿里云AccessSecret
```

2. 在 Obsidian 中右键点击图片，选择 "OCR 识别图片文字"
3. 等待识别完成，识别结果会自动复制到剪贴板
4. 同时会创建一个新的 Markdown 笔记，包含识别结果

## 支持的图片来源

- Obsidian 库中的本地图片
- 网络图片（HTTP/HTTPS URL）

## 注意事项

- 使用前需要设置阿里云 OCR API 的 AccessKey 和 Secret
- 本插件需要联网使用
- 如在使用过程中遇到问题，请查看控制台日志

## 许可证

MIT 