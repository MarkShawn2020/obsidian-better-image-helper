import { App, PluginSettingTab, Setting } from 'obsidian';
import ImageOcrPlugin from './main';

export interface OcrServiceConfig {
    name: string;
    type: string;
    enabled: boolean;
    accessKey: string;
    secretKey: string;
}

export interface ImageOcrSettings {
    defaultService: string;
    services: OcrServiceConfig[];
}

export const DEFAULT_SETTINGS: ImageOcrSettings = {
    defaultService: 'aliyun',
    services: [
        {
            name: '阿里云OCR',
            type: 'aliyun',
            enabled: true,
            accessKey: '',
            secretKey: ''
        }
    ]
};

export class ImageOcrSettingTab extends PluginSettingTab {
    plugin: ImageOcrPlugin;

    constructor(app: App, plugin: ImageOcrPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Image OCR 设置' });

        // 默认OCR服务选择
        new Setting(containerEl)
            .setName('默认OCR服务')
            .setDesc('选择默认使用的OCR服务提供商')
            .addDropdown(dropdown => {
                const services = this.plugin.settings.services;
                services.forEach(service => {
                    if (service.enabled) {
                        dropdown.addOption(service.type, service.name);
                    }
                });
                dropdown.setValue(this.plugin.settings.defaultService);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultService = value;
                    await this.plugin.saveSettings();
                });
            });

        containerEl.createEl('h3', { text: 'OCR 服务配置' });

        // 阿里云OCR服务配置
        const aliyunService = this.plugin.settings.services.find(s => s.type === 'aliyun');
        if (aliyunService) {
            const aliyunSetting = new Setting(containerEl)
                .setName('阿里云OCR')
                .setDesc('使用阿里云OCR识别服务')
                .addToggle(toggle => {
                    toggle
                        .setValue(aliyunService.enabled)
                        .onChange(async (value) => {
                            aliyunService.enabled = value;
                            await this.plugin.saveSettings();
                            // 刷新显示
                            this.display();
                        });
                });

            if (aliyunService.enabled) {
                // AccessKey设置
                new Setting(containerEl)
                    .setName('AccessKey ID')
                    .setDesc('阿里云AccessKey ID')
                    .addText(text => text
                        .setPlaceholder('输入阿里云AccessKey ID')
                        .setValue(aliyunService.accessKey)
                        .onChange(async (value) => {
                            aliyunService.accessKey = value;
                            await this.plugin.saveSettings();
                        }));

                // SecretKey设置
                new Setting(containerEl)
                    .setName('AccessKey Secret')
                    .setDesc('阿里云AccessKey Secret')
                    .addText(text => text
                        .setPlaceholder('输入阿里云AccessKey Secret')
                        .setValue(aliyunService.secretKey)
                        .onChange(async (value) => {
                            aliyunService.secretKey = value;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        // 这里可以添加更多OCR服务的配置，如百度OCR、腾讯OCR等

        containerEl.createEl('div', {
            text: '注意：密钥信息会加密保存在Obsidian配置中，请确保使用可信任的第三方插件。',
            cls: 'setting-item-description'
        });
    }
} 