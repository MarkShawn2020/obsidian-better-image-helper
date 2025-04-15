import { App, Editor, MarkdownView, Menu, Notice, Plugin, TFile } from 'obsidian';
import { recognizeImage } from './ocr-service';

export default class ImageOcrPlugin extends Plugin {
	async onload() {
		console.log('Loading Image OCR Plugin');

		// Register DOM event for contextmenu on images in Live Preview or Reading Mode
		this.registerDomEvent(document, 'contextmenu', (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			if (target.tagName.toLowerCase() === 'img') {
				// Handle right-click on rendered image
				this.handleImageContextMenu(evt, target);
			}
		});

		// Register editor contextmenu event for Source Mode
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
					}
				}
			})
		);
	}

	onunload() {
		console.log('Unloading Image OCR Plugin');
	}

	/**
	 * Handle right-click on an image in Live Preview or Reading Mode
	 */
	handleImageContextMenu(evt: MouseEvent, imgElement: HTMLElement) {
		// Prevent default context menu
		evt.preventDefault();
		
		// Create a custom menu
		const menu = new Menu();
		
		// Get the image source
		const imgSrc = imgElement.getAttribute('src');
		if (imgSrc) {
			this.addOcrMenuOption(menu, imgSrc);
		}
		
		// Show the menu at the position of the right-click
		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
	}

	/**
	 * Add OCR menu option to the given menu
	 */
	addOcrMenuOption(menu: Menu, imagePath: string) {
		menu.addItem((item) => {
			item
				.setTitle('OCR 识别图片文字')
				.setIcon('file-scan')
				.onClick(async () => {
					await this.performOcr(imagePath);
				});
		});
	}

	/**
	 * Perform OCR on the given image
	 */
	async performOcr(imagePath: string) {
		try {
			// Resolve the full path to the image
			const resolvedPath = this.resolveImagePath(imagePath);
			if (!resolvedPath) {
				throw new Error('Could not resolve image path');
			}

			// Show a notice that OCR is in progress
			const notice = new Notice('OCR 识别中...');
			
			// Perform OCR
			const result = await recognizeImage(resolvedPath);
			
			// Remove loading notice
			notice.hide();
			
			// Show result
			if (result.success) {
				// Copy text to clipboard
				await navigator.clipboard.writeText(result.text);
				new Notice('OCR 识别成功，已复制到剪贴板');
				
				// Create a new note with the OCR result
				this.createNoteWithOcrResult(result.text, imagePath);
			} else {
				new Notice('OCR 识别失败: ' + result.error, 5000);
			}
		} catch (error) {
			new Notice(`OCR 识别失败: ${error.message}`, 5000);
			console.error('OCR error:', error);
		}
	}

	/**
	 * Resolve the image path to a full path
	 */
	resolveImagePath(imagePath: string): string {
		// Handle different scenarios:
		// 1. Absolute path
		// 2. Relative path from vault
		// 3. URL
		
		if (imagePath.startsWith('http')) {
			// URL: can be used directly
			return imagePath;
		}
		
		// Try to resolve as a file within the vault
		// @ts-ignore - getBasePath exists but is not in typings
		const basePath = this.app.vault.adapter.getBasePath();
		
		// Remove leading slash if it exists
		const normalizedPath = imagePath.startsWith('/') 
			? imagePath.substring(1) 
			: imagePath;
			
		return `${basePath}/${normalizedPath}`;
	}

	/**
	 * Create a new note with the OCR result
	 */
	async createNoteWithOcrResult(text: string, imagePath: string) {
		// Create the content for the new note
		const fileName = imagePath.split('/').pop() || 'image';
		const content = `# OCR 结果: ${fileName}\n\n![](${imagePath})\n\n\`\`\`\n${text}\n\`\`\``;
		
		// Create a new file
		const newFileName = `OCR_${fileName.replace(/\.\w+$/, '')}_${Date.now()}.md`;
		await this.app.vault.create(newFileName, content);
		
		// Open the new file
		const file = this.app.vault.getAbstractFileByPath(newFileName);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(file);
		}
	}
} 