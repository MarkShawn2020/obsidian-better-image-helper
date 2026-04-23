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

/**
 * 图片大图预览模态窗口
 */
interface AltEditContext {
	editor: Editor;
	// 用于在源文件里匹配的图片路径标识（markdown ![](X) 或 wikilink ![[X]] 中的 X）
	pathKey: string;
}

class ImagePreviewModal extends Modal {
	imageSrc: string;
	editContext?: AltEditContext;

	constructor(app: App, imageSrc: string, editContext?: AltEditContext) {
		super(app);
		this.imageSrc = imageSrc;
		this.editContext = editContext;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass('image-preview-modal');
		contentEl.createEl('style', {
			text: `
				.image-preview-modal {
					background: transparent;
					box-shadow: none;
					border: none;
					padding: 0;
					max-width: 95vw;
					max-height: 95vh;
					width: auto;
				}
				.image-preview-modal .modal-close-button {
					color: var(--text-on-accent);
					background: rgba(0, 0, 0, 0.4);
					border-radius: 50%;
				}
				.image-preview-content {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					padding: 0;
					gap: 8px;
				}
				.image-preview-content img {
					max-width: 95vw;
					max-height: 85vh;
					object-fit: contain;
					cursor: zoom-out;
					border-radius: 4px;
				}
				.image-preview-alt-bar {
					display: flex;
					align-items: center;
					gap: 8px;
					width: min(95vw, 720px);
					padding: 8px 10px;
					background: rgba(0, 0, 0, 0.55);
					border-radius: 6px;
				}
				.image-preview-alt-bar label {
					color: #fff;
					font-size: 12px;
					flex-shrink: 0;
				}
				.image-preview-alt-bar input {
					flex: 1;
					padding: 4px 8px;
					border-radius: 4px;
					border: 1px solid var(--background-modifier-border);
					background: var(--background-primary);
					color: var(--text-normal);
				}
				.image-preview-alt-bar button {
					padding: 4px 10px;
					border-radius: 4px;
					border: none;
					cursor: pointer;
					background: var(--interactive-accent);
					color: var(--text-on-accent);
				}
				.image-preview-alt-bar button:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}
			`,
		});
		contentEl.addClass('image-preview-content');
		const img = contentEl.createEl('img', {
			attr: { src: this.imageSrc, alt: 'preview' },
		});
		img.addEventListener('click', () => this.close());

		if (this.editContext) {
			this.renderAltBar(contentEl);
		}
	}

	private renderAltBar(parent: HTMLElement) {
		const ctx = this.editContext!;
		const found = findImageInEditor(ctx.editor, ctx.pathKey);

		const bar = parent.createDiv({ cls: 'image-preview-alt-bar' });
		bar.createEl('label', { text: 'Alt:' });
		const input = bar.createEl('input', {
			attr: { type: 'text', placeholder: found ? '' : '未在当前编辑器中找到对应图片' },
		});
		input.value = found?.alt ?? '';
		input.disabled = !found;

		const saveBtn = bar.createEl('button', { text: '保存' });
		saveBtn.disabled = !found;
		saveBtn.addEventListener('click', () => {
			if (!found) return;
			replaceImageAlt(ctx.editor, found, input.value);
			new Notice('已更新 alt');
			this.close();
		});
		input.addEventListener('keydown', (e) => {
			if (e.isComposing || (e as any).keyCode === 229) return;
			if (e.key === 'Enter' && !saveBtn.disabled) saveBtn.click();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

interface ImageMatch {
	line: number;
	from: number;
	to: number;
	alt: string;
	body: string; // 原始内部内容（src 或 wikilink target）
	kind: 'md' | 'wiki';
}

function findImageInEditor(editor: Editor, pathKey: string): ImageMatch | null {
	const needle = basename(pathKey);
	if (!needle) return null;
	const lineCount = editor.lineCount();
	const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	const wikiRegex = /!\[\[([^\]]+)\]\]/g;
	for (let i = 0; i < lineCount; i++) {
		const line = editor.getLine(i);
		mdRegex.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = mdRegex.exec(line)) !== null) {
			if (basename(m[2]) === needle) {
				return { line: i, from: m.index, to: m.index + m[0].length, alt: m[1], body: m[2], kind: 'md' };
			}
		}
		wikiRegex.lastIndex = 0;
		while ((m = wikiRegex.exec(line)) !== null) {
			const target = m[1].split('|')[0];
			if (basename(target) === needle) {
				const altPart = m[1].includes('|') ? m[1].slice(m[1].indexOf('|') + 1) : '';
				return { line: i, from: m.index, to: m.index + m[0].length, alt: altPart, body: m[1], kind: 'wiki' };
			}
		}
	}
	return null;
}

function replaceImageAlt(editor: Editor, match: ImageMatch, newAlt: string) {
	const replacement =
		match.kind === 'md'
			? `![${newAlt}](${match.body})`
			: `![[${match.body.split('|')[0]}${newAlt ? `|${newAlt}` : ''}]]`;
	editor.replaceRange(
		replacement,
		{ line: match.line, ch: match.from },
		{ line: match.line, ch: match.to },
	);
}

/**
 * 在源文本里就地替换 ![alt](src) / ![[target|alt]] 的 alt 部分
 * 返回 null 表示未找到
 */
function replaceAltInSource(source: string, pathKey: string, newAlt: string): string | null {
	const needle = basename(pathKey);
	if (!needle) return null;
	const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	const wikiRegex = /!\[\[([^\]]+)\]\]/g;
	let m: RegExpExecArray | null;

	mdRegex.lastIndex = 0;
	while ((m = mdRegex.exec(source)) !== null) {
		if (basename(m[2]) === needle) {
			return source.slice(0, m.index) + `![${newAlt}](${m[2]})` + source.slice(m.index + m[0].length);
		}
	}
	wikiRegex.lastIndex = 0;
	while ((m = wikiRegex.exec(source)) !== null) {
		const target = m[1].split('|')[0];
		if (basename(target) === needle) {
			const replacement = `![[${target}${newAlt ? `|${newAlt}` : ''}]]`;
			return source.slice(0, m.index) + replacement + source.slice(m.index + m[0].length);
		}
	}
	return null;
}

function basename(p: string): string {
	try {
		const noQuery = p.split('?')[0].split('#')[0];
		const decoded = decodeURIComponent(noQuery);
		const parts = decoded.split(/[\\/]/);
		return parts[parts.length - 1] || '';
	} catch {
		const parts = p.split(/[\\/]/);
		return parts[parts.length - 1] || '';
	}
}

export default class ImageOcrPlugin extends Plugin {
	settings: ImageOcrSettings;
	captionObserver?: MutationObserver;
	private scanScheduled = false;

	async onload() {
		// Initialize plugin

		// 加载设置
		await this.loadSettings();

		// 添加设置标签页
		this.addSettingTab(new ImageOcrSettingTab(this.app, this));

		// Reading Mode: 通过 markdown post-processor 注入 caption
		this.registerMarkdownPostProcessor((el) => {
			el.querySelectorAll('img').forEach((img) => {
				this.attachCaption(img as HTMLImageElement);
			});
			el.querySelectorAll('.internal-embed[src]').forEach((embed) => {
				const img = embed.querySelector('img') as HTMLImageElement | null;
				if (img && !img.getAttribute('alt')) {
					const src = embed.getAttribute('src') || '';
					const alt = src.includes('|') ? src.slice(src.indexOf('|') + 1) : '';
					if (alt) img.setAttribute('alt', alt);
				}
				if (img) this.attachCaption(img);
			});
		});

		// Live Preview: 用 MutationObserver 兜底注入 caption
		this.registerEvent(
			this.app.workspace.on('layout-change', () => this.scanAndAttachCaptions()),
		);
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => this.scanAndAttachCaptions()),
		);
		this.captionObserver = new MutationObserver(() => this.scanAndAttachCaptions());
		this.captionObserver.observe(document.body, { childList: true, subtree: true });
		this.register(() => this.captionObserver?.disconnect());

		// 编辑模式（Live Preview）下双击图片打开大图预览
		this.registerDomEvent(document, 'dblclick', (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			if (!target || target.tagName.toLowerCase() !== 'img') return;
			if (!target.closest('.cm-editor')) return;
			const src = (target as HTMLImageElement).getAttribute('src');
			if (!src) return;
			evt.preventDefault();
			evt.stopPropagation();
			const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
			new ImagePreviewModal(
				this.app,
				src,
				editor ? { editor, pathKey: src } : undefined,
			).open();
		});

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
							this.addPreviewMenuOption(menu, imagePath, editor);
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
						this.addPreviewMenuOption(menu, file.path);
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
							this.addPreviewMenuOption(menu, imgSrc, editor);
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
		this.addPreviewMenuOption(menu, imgSrc);
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
	 * 添加"查看大图"菜单项
	 */
	addPreviewMenuOption(menu: Menu, imagePath: string, editor?: Editor) {
		menu.addItem((item) => {
			item
				.setTitle('查看大图')
				.setIcon('image')
				.onClick(() => {
					new ImagePreviewModal(
						this.app,
						imagePath,
						editor ? { editor, pathKey: imagePath } : undefined,
					).open();
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

	/**
	 * 扫描可见的 markdown 视图，给所有 img 注入 caption
	 * 用 rAF 节流避免 MutationObserver 频繁触发
	 */
	scanAndAttachCaptions() {
		if (this.scanScheduled) return;
		this.scanScheduled = true;
		requestAnimationFrame(() => {
			this.scanScheduled = false;
			// 清理孤儿 wrapper（img 已被 CodeMirror 销毁后残留的）
			document.querySelectorAll<HTMLElement>('.bih-wrap').forEach((wrap) => {
				if (!wrap.querySelector('img')) wrap.remove();
			});
			document
				.querySelectorAll<HTMLImageElement>('.cm-editor img, .markdown-preview-view img')
				.forEach((img) => this.attachCaption(img));
		});
	}

	/**
	 * 给单个 img 注入 caption（若已有则跳过）
	 */
	attachCaption(img: HTMLImageElement) {
		if (img.dataset.bihCaptioned === '1') {
			// 已处理，但可能 alt 改了，同步一下文本
			const existing = img.parentElement?.querySelector(':scope > .bih-caption') as HTMLElement | null;
			if (existing) {
				const newAlt = this.readAlt(img);
				if (newAlt && existing.textContent !== newAlt) existing.textContent = newAlt;
			}
			return;
		}
		const alt = this.readAlt(img);
		// 没有 alt 就不注入 caption（避免到处都是"添加说明…"占位）
		if (!alt) return;
		img.dataset.bihCaptioned = '1';

		const caption = document.createElement('figcaption');
		caption.className = 'bih-caption';
		caption.textContent = alt;
		caption.title = '点击编辑说明';

		caption.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.editCaptionInline(caption, img);
		});

		// 用 inline-block wrapper 包住 img，让 caption 在 wrapper 内强制换行到下方
		const wrap = document.createElement('span');
		wrap.className = 'bih-wrap';
		img.parentElement?.insertBefore(wrap, img);
		wrap.appendChild(img);
		wrap.appendChild(caption);
		this.ensureCaptionStyle();
	}

	private readAlt(img: HTMLImageElement): string {
		let alt = img.getAttribute('alt') || '';
		if (!alt) {
			const embedParent = img.closest('.internal-embed[src]') as HTMLElement | null;
			const embedSrc = embedParent?.getAttribute('src') || '';
			if (embedSrc.includes('|')) alt = embedSrc.slice(embedSrc.indexOf('|') + 1);
		}
		// Obsidian 会给没写 alt 的图片自动填一段（文件名 / URL 片段）当 alt。
		// 只要 alt 出现在 src 里，就认为是自动生成的，不是用户写的 caption。
		if (alt) {
			const src = img.getAttribute('src') || '';
			if (src.includes(alt)) return '';
		}
		return alt;
	}

	private styleInjected = false;
	private ensureCaptionStyle() {
		if (this.styleInjected) return;
		this.styleInjected = true;
		const style = document.createElement('style');
		style.textContent = `
			.bih-wrap {
				display: inline-block;
				vertical-align: top;
				max-width: 100%;
			}
			.bih-wrap > img {
				display: block;
				max-width: 100%;
			}
			.bih-caption {
				display: block;
				width: 100%;
				text-align: center;
				font-size: 0.85em;
				color: var(--text-muted);
				margin: 4px 0 8px;
				padding: 2px 6px;
				cursor: text;
				font-style: italic;
				word-break: break-word;
				box-sizing: border-box;
			}
			.bih-caption:hover {
				color: var(--text-normal);
				background: var(--background-modifier-hover);
				border-radius: 4px;
			}
			.bih-caption-input {
				display: block;
				margin: 4px auto 12px;
				width: 80%;
				padding: 4px 8px;
				font-size: 0.85em;
				font-style: italic;
				text-align: center;
				border: 1px solid var(--interactive-accent);
				border-radius: 4px;
				background: var(--background-primary);
				color: var(--text-normal);
			}
		`;
		document.head.appendChild(style);
		this.register(() => style.remove());
	}

	private editCaptionInline(caption: HTMLElement, img: HTMLImageElement) {
		const currentAlt = caption.classList.contains('bih-caption-empty')
			? ''
			: caption.textContent || '';
		const input = document.createElement('input');
		input.type = 'text';
		input.value = currentAlt;
		input.className = 'bih-caption-input';
		caption.replaceWith(input);
		input.focus();
		input.select();

		let finished = false;
		const finish = async (commit: boolean) => {
			if (finished) return;
			finished = true;
			const newAlt = commit ? input.value : currentAlt;
			if (commit && newAlt !== currentAlt) {
				const ok = await this.persistAlt(img, newAlt);
				if (!ok) new Notice('未能定位到对应图片，alt 未保存');
			}
			if (newAlt) {
				caption.textContent = newAlt;
				input.replaceWith(caption);
			} else {
				// 清空了：移除整个 caption 和 wrapper 的捕获关系（让源文件改动驱动重渲染）
				input.remove();
				img.dataset.bihCaptioned = '';
			}
		};

		input.addEventListener('keydown', (e) => {
			if (e.isComposing || (e as any).keyCode === 229) return;
			if (e.key === 'Enter') finish(true);
			if (e.key === 'Escape') finish(false);
		});
		input.addEventListener('blur', () => finish(true));
	}

	/**
	 * 保存 alt 到源文件：优先用 active editor，其次回写 vault 文件
	 */
	private async persistAlt(img: HTMLImageElement, newAlt: string): Promise<boolean> {
		const src = img.getAttribute('src') || '';
		const embedParent = img.closest('.internal-embed[src]') as HTMLElement | null;
		const embedSrc = embedParent?.getAttribute('src') || '';
		const pathKey = embedSrc ? embedSrc.split('|')[0] : src;
		if (!pathKey) return false;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view?.editor) {
			const found = findImageInEditor(view.editor, pathKey);
			if (found) {
				replaceImageAlt(view.editor, found, newAlt);
				return true;
			}
		}
		const file = this.app.workspace.getActiveFile();
		if (file) {
			let replaced = false;
			await this.app.vault.process(file, (content) => {
				const updated = replaceAltInSource(content, pathKey, newAlt);
				if (updated !== null) {
					replaced = true;
					return updated;
				}
				return content;
			});
			return replaced;
		}
		return false;
	}

}