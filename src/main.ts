import { App, Editor, MarkdownView, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile } from 'obsidian';
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
		const imageFileName = this.imagePath || 'image';
		
		// 标题区域
		const titleContainer = contentEl.createDiv({cls: 'ocr-result-title'});
		titleContainer.createEl('h2', {text: 'OCR 识别结果: '});
		
		// 创建小字的文件名超链接
		const fileNameLink = titleContainer.createEl('a', {
			cls: 'ocr-filename-link',
			text: imageFileName,
			attr: {
				style: 'font-size: 0.8em; color: var(--text-muted); margin-left: 5px; text-decoration: underline;',
				title: '点击可以在文件系统中显示图片'
			}
		});
		
		// 为超链接添加点击事件，尝试在系统文件浏览器中打开图片位置
		fileNameLink.addEventListener('click', async (e) => {
			e.preventDefault();
			try {
				if (this.imagePath.startsWith('http')) {
					// 如果是网络图片，在浏览器中打开
					window.open(this.imagePath, '_blank');
				} else {
					// 检查本地文件是否存在
					const fileExists = await this.app.vault.adapter.exists(this.imagePath);
					if (fileExists) {
						// @ts-ignore - Electron API
						if (this.app.appId === 'obsidian' && window.require) {
							try {
								const electron = window.require('electron');
								const path = window.require('path');
								const fullPath = path.resolve(this.imagePath);
								electron.shell.showItemInFolder(fullPath);
							} catch (e) {
								console.error('无法在文件系统中打开图片:', e);
								new Notice('无法在文件系统中打开图片');
							}
						} else {
							new Notice('当前环境无法在文件系统中打开图片');
						}
					} else {
						new Notice('找不到图片文件');
					}
				}
			} catch (e) {
				console.error('处理图片链接时出错:', e);
				new Notice('无法打开图片位置');
			}
		});
		
		// 图片预览（如果是本地图片）
		if (!this.imagePath.startsWith('http')) {
			try {
				const imgContainer = contentEl.createDiv({cls: 'ocr-image-preview'});
				imgContainer.createEl('img', {attr: {src: this.imagePath, style: 'max-width: 100%; max-height: 200px;'}});
			} catch (e) {
				console.log('无法显示图片预览:', e);
			}
		}
		
		// 文本编辑区域
		const textAreaContainer = contentEl.createDiv({cls: 'ocr-result-textarea-container'});
		textAreaContainer.createEl('h3', {text: '识别文本 (可编辑):'});
		
		const textArea = textAreaContainer.createEl('textarea', {
			cls: 'ocr-result-textarea',
			attr: {
				style: 'width: 100%; height: 200px; font-family: monospace; padding: 8px; margin-bottom: 10px;'
			}
		});
		textArea.value = this.result;
		
		// 按钮组
		const buttonContainer = contentEl.createDiv({cls: 'ocr-result-buttons'});
		
		// 复制按钮
		const copyButton = buttonContainer.createEl('button', {text: '复制文本'});
		copyButton.addEventListener('click', async () => {
			await navigator.clipboard.writeText(textArea.value);
			new Notice('文本已复制到剪贴板!');
		});
		
		// 创建为新笔记按钮
		const createNoteButton = buttonContainer.createEl('button', {
			text: '创建为新笔记',
			attr: {
				style: 'margin-left: 10px;'
			}
		});
		createNoteButton.addEventListener('click', async () => {
			this.close();
			await this.createNoteWithText(textArea.value);
		});
		
		// 关闭按钮
		const closeButton = buttonContainer.createEl('button', {
			text: '关闭',
			attr: {
				style: 'margin-left: 10px;'
			}
		});
		closeButton.addEventListener('click', () => {
			this.close();
		});
		
		// 自动聚焦到文本区域并选中全部文本
		setTimeout(() => {
			textArea.focus();
			textArea.select();
		}, 50);
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
		console.log('Loading Image OCR Plugin - 初始化图片OCR插件');

		// 加载设置
		await this.loadSettings();

		// 添加设置标签页
		this.addSettingTab(new ImageOcrSettingTab(this.app, this));

		// Register DOM event for contextmenu on images in Reading Mode
		this.registerDomEvent(document, 'contextmenu', (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			console.log('右键点击事件捕获:', target.tagName, target);
			
			// Check if target is an image or has an image parent (for better support in Live Preview)
			if (this.isImageElement(target)) {
				console.log('检测到图片元素右键，处理中...');
				// Handle right-click on rendered image
				this.handleImageContextMenu(evt, this.findImageElement(target));
			}
		});

		// Register editor contextmenu event for Source Mode and Live Preview
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, view) => {
				console.log('编辑器菜单事件触发');
				
				// Check if we're in source mode and cursor is on an image markdown
				if (view instanceof MarkdownView) {
					const cursor = editor.getCursor();
					const line = editor.getLine(cursor.line);
					console.log('当前光标位置:', cursor, '当前行内容:', line);
					
					// Simple regex to check if cursor is on an image markdown syntax
					const imageRegex = /!\[.*?\]\(.*?\)/;
					if (imageRegex.test(line)) {
						// Extract the image path from the markdown
						const match = line.match(/!\[.*?\]\((.*?)\)/);
						if (match && match[1]) {
							const imagePath = match[1];
							console.log('检测到图片Markdown语法，图片路径:', imagePath);
							this.addOcrMenuOption(menu, imagePath);
						}
					} else {
						// For Live Preview Mode, try to find if the cursor is near an image
						console.log('尝试处理Live Preview模式下的图片菜单');
						// This is a more complex way to find if we're on an image in Live Preview
						this.handleLivePreviewImageMenu(menu, editor, view, cursor);
					}
				}
			})
		);

		// Register handling image context menu in editing (Obsidian v1.0+)
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file, source) => {
				console.log('文件菜单事件触发:', file?.path);
				
				// When right-clicking on an attachment (file menu in Obsidian)
				if (file instanceof TFile) {
					const extension = file.extension;
					console.log('文件扩展名:', extension);
					
					if (extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension.toLowerCase())) {
						console.log('检测到图片文件，添加OCR菜单选项');
						// Add OCR option for image files
						this.addOcrMenuOption(menu, file.path);
					}
				}
			})
		);
        
        console.log('Image OCR Plugin 加载完成 - 版本 1.0.0');
	}

	onunload() {
		console.log('Unloading Image OCR Plugin - 卸载图片OCR插件');
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
			console.log('Live Preview编辑器元素:', editorEl);
			
			if (editorEl) {
				// Find all images in the editor
				const images = editorEl.querySelectorAll('img');
				console.log('编辑器中找到的图片数量:', images.length);
				
				if (images && images.length > 0) {
					// For simplicity, just add an OCR option if there are any images
					// A more sophisticated approach would check proximity to cursor
					for (let i = 0; i < images.length; i++) {
						const img = images[i] as HTMLImageElement;
						const imgSrc = img.getAttribute('src');
						console.log(`图片[${i}]的路径:`, imgSrc);
						
						if (imgSrc) {
							console.log('在Live Preview模式下添加OCR菜单选项');
							this.addOcrMenuOption(menu, imgSrc);
							break; // Just add once for simplicity
						}
					}
				}
			}
		} catch (error) {
			console.error('Live Preview处理图片菜单时出错:', error);
		}
	}

	/**
	 * Check if the element is an image or contains an image
	 */
	isImageElement(element: HTMLElement): boolean {
		// Direct image element
		if (element.tagName.toLowerCase() === 'img') {
			console.log('直接检测到图片元素');
			return true;
		}
		
		// Check if element contains an image (for handling containers in Live Preview)
		const img = element.querySelector('img');
		if (img) {
			console.log('检测到包含图片的容器元素');
			return true;
		}
		
		// Check if element's parent is or contains an image (helps with nested elements in Live Preview)
		const parent = element.parentElement;
		if (parent) {
			if (parent.tagName.toLowerCase() === 'img') {
				console.log('检测到父元素为图片');
				return true;
			}
			const parentImg = parent.querySelector('img');
			if (parentImg) {
				console.log('检测到父元素包含图片');
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
			console.log('目标已经是图片元素');
			return element;
		}
		
		// Try to find an image in descendants
		const img = element.querySelector('img');
		if (img) {
			console.log('在子元素中找到图片');
			return img as HTMLElement;
		}
		
		// Try to find an image in ancestors
		let parent = element.parentElement;
		while (parent) {
			if (parent.tagName.toLowerCase() === 'img') {
				console.log('在父元素链中找到图片元素');
				return parent;
			}
			
			const parentImg = parent.querySelector('img');
			if (parentImg) {
				console.log('在父元素中找到图片');
				return parentImg as HTMLElement;
			}
			
			parent = parent.parentElement;
		}
		
		// If we can't find an image, return the original element
		console.log('未找到关联图片，返回原始元素');
		return element;
	}

	/**
	 * Handle right-click on an image in Live Preview or Reading Mode
	 */
	handleImageContextMenu(evt: MouseEvent, imgElement: HTMLElement) {
		// Get the image source
		const imgSrc = imgElement.getAttribute('src');
		if (!imgSrc) {
			console.log('图片没有src属性，无法处理');
			return;
		}
		
		console.log('处理图片右键菜单，图片路径:', imgSrc);
		
		// Create a custom menu
		const menu = new Menu();
		this.addOcrMenuOption(menu, imgSrc);
		
		// Show the menu at the position of the right-click
		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
		console.log('显示自定义菜单，位置:', evt.clientX, evt.clientY);
		
		// Prevent default only after our menu is shown
		evt.preventDefault();
		evt.stopPropagation();
	}

	/**
	 * Add OCR menu option to the given menu
	 */
	addOcrMenuOption(menu: Menu, imagePath: string) {
		console.log('添加OCR菜单选项，图片路径:', imagePath);
		
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
					console.log('OCR选项被点击，开始处理图片:', imagePath);
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
			console.log('开始OCR处理流程，原始路径:', imagePath);
			
			// Resolve the full path to the image
			const resolvedPath = this.resolveImagePath(imagePath);
			console.log('解析后的完整路径:', resolvedPath);
			
			if (!resolvedPath) {
				console.error('无法解析图片路径');
				throw new Error('Could not resolve image path');
			}

			// Show a notice that OCR is in progress
			console.log('显示OCR进行中提示');
			const notice = new Notice('OCR 识别中...');
			
			// Perform OCR
			console.log('调用阿里云OCR API...');
			const result = await recognizeImage(resolvedPath, serviceConfig);
			console.log('OCR结果:', result);
			
			// Remove loading notice
			notice.hide();
			
			// Show result
			if (result.success) {
				console.log('OCR识别成功，文本长度:', result.text.length);
				
				// 自动复制到剪贴板
				await navigator.clipboard.writeText(result.text);
				console.log('识别结果已复制到剪贴板');
				
				// 显示OCR结果模态窗口
				new OcrResultModal(this.app, result.text, imagePath).open();
			} else {
				console.error('OCR识别失败:', result.error);
				new Notice('OCR 识别失败: ' + result.error, 5000);
			}
		} catch (error: any) {
			console.error('OCR处理过程中出错:', error);
			new Notice(`OCR 识别失败: ${error.message}`, 5000);
			console.error('OCR error:', error);
		}
	}

	/**
	 * Resolve the image path to a full path
	 */
	resolveImagePath(imagePath: string): string {
		console.log('解析图片路径:', imagePath);
		
		// Handle different scenarios:
		// 1. Absolute path
		// 2. Relative path from vault
		// 3. URL
		
		if (imagePath.startsWith('http')) {
			// URL: can be used directly
			console.log('检测到HTTP URL，直接使用');
			return imagePath;
		}
		
		// Try to resolve as a file within the vault
		// @ts-ignore - getBasePath exists but is not in typings
		const basePath = this.app.vault.adapter.getBasePath();
		console.log('Vault基础路径:', basePath);
		
		// Remove leading slash if it exists
		const normalizedPath = imagePath.startsWith('/') 
			? imagePath.substring(1) 
			: imagePath;
		
		const fullPath = `${basePath}/${normalizedPath}`;
		console.log('生成的完整图片路径:', fullPath);
			
		return fullPath;
	}

} 