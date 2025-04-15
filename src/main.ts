import { App, Editor, MarkdownView, Menu, Notice, Plugin, TFile, TAbstractFile } from 'obsidian';
import { recognizeImage } from './ocr-service';

export default class ImageOcrPlugin extends Plugin {
	async onload() {
		console.log('Loading Image OCR Plugin');

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
						// This is a more complex way to find if we're on an image in Live Preview
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
		console.log('Unloading Image OCR Plugin');
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
			console.error('Error in handleLivePreviewImageMenu:', error);
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
		if (!imgSrc) return;
		
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