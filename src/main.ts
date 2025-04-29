import { App, Editor, MarkdownView, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, setIcon } from 'obsidian';
import { recognizeImage, OcrResult } from './ocr-service';
import { DEFAULT_SETTINGS, ImageOcrSettings, ImageOcrSettingTab, OcrServiceConfig } from './settings';

// 扩展App类型定义，添加setting属性
declare module 'obsidian' {
	interface App {
		setting: {
			open(): void;
			openTabById(id: string): void;
			activeTab: PluginSettingTab;
			tabHeaders: Array<{
				name: string;
				click(): void;
			}>;
		};
	}
}

/**
 * OCR结果显示模态窗口
 */
class OcrResultModal extends Modal {
	result: string;
	imagePath: string;

	constructor(app: App, result: string, imagePath: string) {
		super(app);
		this.result = result;
		this.imagePath = imagePath;
	}

	onOpen() {
		const {contentEl} = this;
		const imageFileName = this.imagePath.split('/').pop() || 'image';
		const fullImagePath = this.imagePath || '';
		
		// 添加样式
		contentEl.addClass('ocr-result-modal');
		contentEl.createEl('style', {
			text: `
				.ocr-result-modal {
					padding: 20px;
					max-width: 800px;
				}
				.ocr-result-header {
					display: flex;
					flex-direction: column;
					margin-bottom: 16px;
					border-bottom: 1px solid var(--background-modifier-border);
					padding-bottom: 12px;
				}
				.ocr-result-title {
					display: flex;
					align-items: baseline;
					margin-bottom: 8px;
				}
				.ocr-result-title h2 {
					margin: 0;
					margin-right: 8px;
				}
				.ocr-path-container {
					font-size: 0.8em;
					color: var(--text-muted);
					margin-top: 4px;
					word-break: break-all;
					overflow-wrap: break-word;
					white-space: normal;
					display: flex;
					align-items: center;
				}
				.ocr-path-label {
					flex-shrink: 0;
					margin-right: 6px;
				}
				.ocr-path-value {
					overflow: hidden;
					text-overflow: ellipsis;
				}
				.ocr-content-container {
					display: flex;
					flex-direction: column;
					gap: 16px;
				}
				.ocr-preview-container {
					display: flex;
					justify-content: center;
					background: var(--background-secondary);
					border-radius: 8px;
					padding: 12px;
					margin-bottom: 12px;
				}
				.ocr-preview-container img {
					max-width: 100%;
					max-height: 250px;
					object-fit: contain;
					border-radius: 4px;
				}
				.ocr-result-textarea {
					width: 100%;
					min-height: 200px;
					font-family: var(--font-monospace);
					padding: 12px;
					border-radius: 4px;
					border: 1px solid var(--background-modifier-border);
					background-color: var(--background-primary);
					resize: vertical;
				}
				.ocr-result-textarea:focus {
					border-color: var(--interactive-accent);
					outline: none;
				}
				.ocr-result-buttons {
					display: flex;
					gap: 8px;
					margin-top: 12px;
					justify-content: flex-end;
				}
				.ocr-result-buttons button {
					padding: 6px 12px;
					border-radius: 4px;
					font-size: 14px;
					font-weight: 500;
					background-color: var(--interactive-normal);
					border: none;
					cursor: pointer;
				}
				.ocr-result-buttons button:hover {
					background-color: var(--interactive-hover);
				}
				.ocr-result-buttons button.primary {
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
				}
				.ocr-result-buttons button.primary:hover {
					background-color: var(--interactive-accent-hover);
				}
				.ocr-char-count {
					font-size: 12px;
					color: var(--text-muted);
					text-align: right;
					margin-top: 4px;
				}
			`
		});
		
		// 头部区域
		const headerContainer = contentEl.createDiv({cls: 'ocr-result-header'});
		
		// 标题区域
		const titleContainer = headerContainer.createDiv({cls: 'ocr-result-title'});
		titleContainer.createEl('h2', {text: 'OCR 识别结果'});
		
		
		// 完整路径显示 (包含图标和可复制)
		const pathContainer = headerContainer.createDiv({cls: 'ocr-path-container'});
		pathContainer.createEl('span', {cls: 'ocr-path-label', text: '路径：'});
		
		// 路径值容器
		const pathValue = pathContainer.createEl('span', {
			cls: 'ocr-path-value',
			text: this.truncatePath(fullImagePath, 60),
			attr: {
				title: fullImagePath
			}
		});
		
		// 添加复制路径按钮
		const copyPathBtn = pathContainer.createEl('button', {
			cls: 'clickable-icon',
			attr: {
				'aria-label': '复制路径',
				style: 'margin-left: 4px; padding: 2px;'
			}
		});
		// 使用 setIcon 方法添加图标
		copyPathBtn.addClass('copy-icon');
		setIcon(copyPathBtn, 'copy');
		copyPathBtn.addEventListener('click', async () => {
			await navigator.clipboard.writeText(fullImagePath);
			new Notice('已复制图片路径');
		});
		
		// 内容容器
		const contentContainer = contentEl.createDiv({cls: 'ocr-content-container'});
		
		// 图片预览（如果是本地图片或HTTP图片）
		const previewContainer = contentContainer.createDiv({cls: 'ocr-preview-container'});
		try {
			previewContainer.createEl('img', {
				attr: {
					src: this.imagePath,
					alt: '图片预览',
					onclick: 'window.open(this.src)'
				}
			});
		} catch (e) {
			// console.log('无法显示图片预览:', e);
			previewContainer.setText('无法显示图片预览');
		}
		
		// 文本编辑区域
		const textAreaContainer = contentContainer.createDiv({cls: 'ocr-textarea-container'});
		textAreaContainer.createEl('h3', {text: '识别文本', attr: {style: 'margin-top: 0; margin-bottom: 8px;'}});
		
		const textArea = textAreaContainer.createEl('textarea', {
			cls: 'ocr-result-textarea'
		});
		textArea.value = this.result;
		
		// 字符计数
		const charCount = textAreaContainer.createDiv({cls: 'ocr-char-count'});
		this.updateCharCount(charCount, this.result);
		
		// 监听文本编辑更新字符计数
		textArea.addEventListener('input', () => {
			this.updateCharCount(charCount, textArea.value);
		});
		
		// 按钮组
		const buttonContainer = contentContainer.createDiv({cls: 'ocr-result-buttons'});
		
		// 关闭按钮
		const closeButton = buttonContainer.createEl('button', {text: '关闭'});
		closeButton.addEventListener('click', () => {
			this.close();
		});
		
		// 复制按钮
		const copyButton = buttonContainer.createEl('button', {text: '复制文本'});
		copyButton.addEventListener('click', async () => {
			await navigator.clipboard.writeText(textArea.value);
			new Notice('文本已复制到剪贴板!');
		});
		
		// 创建为新笔记按钮
		const createNoteButton = buttonContainer.createEl('button', {
			text: '创建为新笔记',
			cls: 'primary'
		});
		createNoteButton.addEventListener('click', async () => {
			this.close();
			await this.createNoteWithText(textArea.value);
		});
		
		// 自动聚焦到文本区域并选中全部文本
		setTimeout(() => {
			textArea.focus();
			textArea.select();
		}, 50);
	}
	
	/**
	 * 处理路径显示，避免太长
	 */
	truncatePath(path: string, maxLength: number): string {
		if (!path || path.length <= maxLength) return path;
		
		const startLength = Math.floor(maxLength * 0.3);
		const endLength = Math.floor(maxLength * 0.7);
		
		return path.substring(0, startLength) + 
			   '...' + 
			   path.substring(path.length - endLength);
	}
	
	/**
	 * 更新字符计数
	 */
	updateCharCount(element: HTMLElement, text: string) {
		const charCount = text.length;
		const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
		element.setText(`字符数: ${charCount}, 词数: ${wordCount}`);
	}

	/**
	 * 创建新笔记
	 */
	async createNoteWithText(text: string) {
		const fileName = this.imagePath.split('/').pop() || 'image';
		const content = `# OCR 结果: ${fileName}\n\n![](${this.imagePath})\n\n\`\`\`\n${text}\n\`\`\``;
		
		// 创建新文件
		const newFileName = `OCR_${fileName.replace(/\.\w+$/, '')}_${Date.now()}.md`;
		await this.app.vault.create(newFileName, content);
		
		// 打开新文件
		const file = this.app.vault.getAbstractFileByPath(newFileName);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(file);
			new Notice(`已创建笔记: ${newFileName}`);
		}
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

export default class ImageOcrPlugin extends Plugin {
	settings: ImageOcrSettings;

	async onload() {
		// Initialize plugin

		// 加载设置
		await this.loadSettings();

		// 添加设置标签页
		this.addSettingTab(new ImageOcrSettingTab(this.app, this));

		// Register DOM event for contextmenu on images in Reading Mode
		this.registerDomEvent(document, 'contextmenu', (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			
			// Check if target is an image or has an image parent (for better support in Live Preview)
			if (this.isImageElement(target)) {
				// Handle right-click on rendered image
				this.handleImageContextMenu(evt, this.findImageElement(target));
			}
		});

		// Register editor contextmenu event for Source Mode and Live Preview
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, view) => {
				// Check if we're in source mode and cursor is on an image markdown
				if (view instanceof MarkdownView) {
					const cursor = editor.getCursor();
					const line = editor.getLine(cursor.line);
					
					// Simple regex to check if cursor is on an image markdown syntax
					const imageRegex = /!\[.*?\]\(.*?\)/;
					if (imageRegex.test(line)) {
						// Extract the image path from the markdown
						const match = line.match(/!\[.*?\]\((.*?)\)/);
						if (match && match[1]) {
							const imagePath = match[1];
							this.addOcrMenuOption(menu, imagePath);
						}
					} else {
						// For Live Preview Mode, try to find if the cursor is near an image
						this.handleLivePreviewImageMenu(menu, editor, view, cursor);
					}
				}
			})
		);

		// Register handling image context menu in editing (Obsidian v1.0+)
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file, source) => {
				// When right-clicking on an attachment (file menu in Obsidian)
				if (file instanceof TFile) {
					const extension = file.extension;
					
					if (extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension.toLowerCase())) {
						// Add OCR option for image files
						this.addOcrMenuOption(menu, file.path);
					}
				}
			})
		);
        
	}

	onunload() {
	}

	/**
	 * 加载设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * 保存设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Handle potential image right-click in Live Preview mode
	 */
	handleLivePreviewImageMenu(menu: Menu, editor: Editor, view: MarkdownView, cursor: any) {
		try {
			// Try to get the DOM element at the cursor position
			// This is more complex in Live Preview
			const editorEl = view.containerEl.querySelector('.cm-editor');
			
			if (editorEl) {
				// Find all images in the editor
				const images = editorEl.querySelectorAll('img');
				
				if (images && images.length > 0) {
					// For simplicity, just add an OCR option if there are any images
					// A more sophisticated approach would check proximity to cursor
					for (let i = 0; i < images.length; i++) {
						const img = images[i] as HTMLImageElement;
						const imgSrc = img.getAttribute('src');
						
						if (imgSrc) {
							this.addOcrMenuOption(menu, imgSrc);
							break; // Just add once for simplicity
						}
					}
				}
			}
		} catch (error) {
			// Handle menu processing error
		}
	}

	/**
	 * Check if the element is an image or contains an image
	 */
	isImageElement(element: HTMLElement): boolean {
		// Direct image element
		if (element.tagName.toLowerCase() === 'img') {
			return true;
		}
		
		// Check if element contains an image (for handling containers in Live Preview)
		const img = element.querySelector('img');
		if (img) {
			return true;
		}
		
		// Check if element's parent is or contains an image (helps with nested elements in Live Preview)
		const parent = element.parentElement;
		if (parent) {
			if (parent.tagName.toLowerCase() === 'img') {
				return true;
			}
			const parentImg = parent.querySelector('img');
			if (parentImg) {
				return true;
			}
		}
		
		return false;
	}
	
	/**
	 * Find the actual image element from the target or its descendants/ancestors
	 */
	findImageElement(element: HTMLElement): HTMLElement {
		// If it's already an image, return it
		if (element.tagName.toLowerCase() === 'img') {
			return element;
		}
		
		// Try to find an image in descendants
		const img = element.querySelector('img');
		if (img) {
			return img as HTMLElement;
		}
		
		// Try to find an image in ancestors
		let parent = element.parentElement;
		while (parent) {
			if (parent.tagName.toLowerCase() === 'img') {
				return parent;
			}
			
			const parentImg = parent.querySelector('img');
			if (parentImg) {
				return parentImg as HTMLElement;
			}
			
			parent = parent.parentElement;
		}
		
		// If we can't find an image, return the original element
		return element;
	}

	/**
	 * Handle right-click on an image in Live Preview or Reading Mode
	 */
	handleImageContextMenu(evt: MouseEvent, imgElement: HTMLElement) {
		// Get the image source
		const imgSrc = imgElement.getAttribute('src');
		if (!imgSrc) {
			return;
		}

		// Create a custom menu
		const menu = new Menu();
		this.addOcrMenuOption(menu, imgSrc);
		
		// Show the menu at the position of the right-click
		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
		
		// Prevent default only after our menu is shown
		evt.preventDefault();
		evt.stopPropagation();
	}

	/**
	 * Add OCR menu option to the given menu
	 */
	addOcrMenuOption(menu: Menu, imagePath: string) {
		// 获取默认OCR服务配置
		const defaultServiceType = this.settings.defaultService;
		const service = this.settings.services.find(s => s.type === defaultServiceType && s.enabled);
		
		// 如果没有可用的服务，添加一个提示信息
		if (!service) {
			menu.addItem((item) => {
				item
					.setTitle('OCR 服务未配置')
					.setIcon('alert-triangle')
					.onClick(() => {
						new Notice('请先在插件设置中配置OCR服务');
						// 打开设置页面
						this.openSettingTab();
					});
			});
			return;
		}
		
		menu.addItem((item) => {
			item
				.setTitle(`OCR 识别图片文字 (${service.name})`)
				.setIcon('file-scan')
				.onClick(async () => {
					await this.performOcr(imagePath, service);
				});
		});
	}
	
	/**
	 * 打开设置页面
	 */
	openSettingTab() {
		// 尝试打开设置页面，这样会显示总设置页
		this.app.setting?.open();
		
		// 延迟100ms再打开插件的设置页
		setTimeout(() => {
			const settingTabs = document.querySelectorAll('.vertical-tab-header-group > .vertical-tab-nav-item');
			settingTabs.forEach(tab => {
				if (tab.textContent?.includes(this.manifest.name)) {
					(tab as HTMLElement).click();
				}
			});
		}, 100);
	}

	/**
	 * Perform OCR on the given image
	 */
	async performOcr(imagePath: string, serviceConfig: OcrServiceConfig) {
		try {
			// Resolve the full path to the image
			const resolvedPath = this.resolveImagePath(imagePath);
			if (!resolvedPath) {
				throw new Error('Could not resolve image path');
			}

			// Show a notice that OCR is in progress
			const notice = new Notice('OCR 识别中...');
			
			// Perform OCR
			const result = await recognizeImage(resolvedPath, serviceConfig);
			
			// Remove loading notice
			notice.hide();
			
			// Show result
			if (result.success) {
				// 自动复制到剪贴板
				await navigator.clipboard.writeText(result.text);
				
				// 显示OCR结果模态窗口
				new OcrResultModal(this.app, result.text, imagePath).open();
			} else {
				new Notice('OCR 识别失败: ' + result.error, 5000);
			}
		} catch (error: any) {
			new Notice(`OCR 识别失败: ${error.message}`, 5000);
		}
	}

	/**
	 * Resolve the image path to a full path
	 */
	resolveImagePath(imagePath: string): string {
		// console.log('解析图片路径:', imagePath);
		
		// Handle different scenarios:
		// 1. Absolute path
		// 2. Relative path from vault
		// 3. URL
		
		if (imagePath.startsWith('http')) {
			// URL: can be used directly
			// console.log('检测到HTTP URL，直接使用');
			return imagePath;
		}
		
		// Try to resolve as a file within the vault
		// @ts-ignore - getBasePath exists but is not in typings
		const basePath = this.app.vault.adapter.getBasePath();
		// console.log('Vault基础路径:', basePath);
		
		// Remove leading slash if it exists
		const normalizedPath = imagePath.startsWith('/') 
			? imagePath.substring(1) 
			: imagePath;
		
		const fullPath = `${basePath}/${normalizedPath}`;
		// console.log('生成的完整图片路径:', fullPath);
			
		return fullPath;
	}

} 