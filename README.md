# Obsidian Image OCR Plugin

> English: This plugin provides OCR (Optical Character Recognition) for images in Obsidian. Right-click on any image to extract text using Alibaba Cloud OCR API. Supports various working modes and elegant result display.

# Obsidian Image OCR 插件

图片 OCR 文字识别插件，在 Obsidian 中右键点击图片即可识别图片中的文字，支持多种工作模式和优雅的结果展示。

![插件预览](https://example.com/preview.png)

## ✨ 功能特点

- **便捷识别**：在 Obsidian 中右键点击图片，快速识别图片中的文字
- **多模式支持**：
  - 阅读模式 (Reading Mode)
  - 编辑模式 (Live Preview)
  - 源码模式 (Source Mode) 下识别 Markdown 图片语法
  - 附件管理器中右键图片文件
- **高质量识别**：使用阿里云 OCR API 进行识别，识别速度快，准确率高
- **优雅展示**：
  - 识别结果以美观的模态窗口呈现
  - 支持实时编辑并提供字符/词数统计
  - 可直接复制文本或创建为新笔记
  - 显示图片预览，支持点击查看原图
- **灵活配置**：支持配置多种 OCR 服务及其参数

## 📥 安装

### 从 Obsidian 社区插件库安装

1. 打开 Obsidian 设置
2. 点击 "社区插件" > "浏览"
3. 搜索 "Image OCR"
4. 安装并启用插件

### 手动安装

1. 下载最新的 release 文件
2. 解压缩后，将文件夹复制到 Obsidian 插件目录（`.obsidian/plugins/obsidian-image-ocr/`）
3. 在 Obsidian 设置中启用插件

## 🔧 配置

首次使用时，需要配置阿里云 OCR API 的访问凭证：

1. 在插件设置中填写阿里云 AccessKey 和 AccessSecret
   ```
   AccessKey: 您的阿里云AccessKey
   AccessSecret: 您的阿里云AccessSecret
   ```

2. 或者在 Obsidian 库根目录下的 `.env` 文件中设置：
   ```env
   ALI_AK=您的阿里云AccessKey
   ALI_SK=您的阿里云AccessSecret
   ```

## 🚀 使用方法

1. **识别图片文字**：
   - 在 Obsidian 中右键点击任意图片
   - 选择 "OCR 识别图片文字" 菜单项
   - 等待识别完成，结果会显示在弹出窗口中

2. **结果操作**：
   - 直接编辑识别文本（自动显示字符数和词数）
   - 点击"复制文本"将当前编辑的文本复制到剪贴板
   - 点击"创建为新笔记"将结果保存为独立的笔记文件
   - 点击窗口上方的路径右侧复制按钮可复制图片路径
   - 点击图片预览可在新窗口查看原图

## 💡 使用技巧

- 在源码模式下，将光标放在图片 Markdown 语法上（如 `![](image.png)`）即可使用右键菜单
- 识别长篇文本时，可自由调整文本区域大小
- 识别网络图片时，需确保图片 URL 可直接访问

## 🌟 支持的图片来源

- Obsidian 库中的本地图片文件
- 附件文件夹中的图片
- 网络图片（HTTP/HTTPS URL）
- 剪贴板粘贴的图片（通过 Markdown 链接）

## ⚠️ 注意事项

- 使用前需要设置阿里云 OCR API 的 AccessKey 和 Secret
- 本插件需要联网使用，识别速度受网络状况影响
- 阿里云 OCR API 可能有使用限制和收费标准，请参考阿里云官方文档
- 如在使用过程中遇到问题，请查看控制台日志或提交 issue

## 📝 更新日志

### 0.1.0 (2023-04-15)
- 新增更美观的 OCR 结果展示窗口
- 添加实时字符统计功能
- 支持图片预览和路径复制
- 改进 UI/UX 设计，优化用户体验

### 0.0.1 (2023-04-15)
- 首次发布
- 支持多种模式下的图片 OCR 识别
- 基础结果展示和复制功能

## 📄 许可证

MIT 