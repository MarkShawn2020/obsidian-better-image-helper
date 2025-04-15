import { App, Editor, MarkdownView, Menu, Notice, Plugin, TFile, TAbstractFile } from 'obsidian';
import { recognizeImage } from './ocr-service';

export default class ImageOcrPlugin extends Plugin {
	async onload() {
		console.log('Loading Image OCR Plugin - 初始化图片OCR插件');

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
		
		menu.addItem((item) => {
			item
				.setTitle('OCR 识别图片文字')
				.setIcon('file-scan')
				.onClick(async () => {
					console.log('OCR选项被点击，开始处理图片:', imagePath);
					await this.performOcr(imagePath);
				});
		});
	}

	/**
	 * Perform OCR on the given image
	 */
	async performOcr(imagePath: string) {
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
			const result = await recognizeImage(resolvedPath);
			console.log('OCR结果:', result);
			
			// Remove loading notice
			notice.hide();
			
			// Show result
			if (result.success) {
				console.log('OCR识别成功，文本长度:', result.text.length);
				// Copy text to clipboard
				await navigator.clipboard.writeText(result.text);
				console.log('识别结果已复制到剪贴板');
				new Notice('OCR 识别成功，已复制到剪贴板');
				
				// Create a new note with the OCR result
				console.log('创建包含OCR结果的笔记');
				this.createNoteWithOcrResult(result.text, imagePath);
			} else {
				console.error('OCR识别失败:', result.error);
				new Notice('OCR 识别失败: ' + result.error, 5000);
			}
		} catch (error) {
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

	/**
	 * Create a new note with the OCR result
	 */
	async createNoteWithOcrResult(text: string, imagePath: string) {
		console.log('创建OCR结果笔记，图片路径:', imagePath);
		
		// Create the content for the new note
		const fileName = imagePath.split('/').pop() || 'image';
		console.log('从路径提取的文件名:', fileName);
		
		const content = `# OCR 结果: ${fileName}\n\n![](${imagePath})\n\n\`\`\`\n${text}\n\`\`\``;
		console.log('生成的笔记内容长度:', content.length);
		
		// Create a new file
		const newFileName = `OCR_${fileName.replace(/\.\w+$/, '')}_${Date.now()}.md`;
		console.log('新建的笔记文件名:', newFileName);
		
		await this.app.vault.create(newFileName, content);
		console.log('已创建OCR结果笔记');
		
		// Open the new file
		const file = this.app.vault.getAbstractFileByPath(newFileName);
		if (file instanceof TFile) {
			console.log('打开新建的笔记');
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(file);
		} else {
			console.error('无法找到新建的笔记文件');
		}
	}
} 