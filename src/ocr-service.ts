import ocr_api20210707, * as $ocr_api20210707 from '@alicloud/ocr-api20210707';
import OpenApi, * as $OpenApi from '@alicloud/openapi-client';
import Util, * as $Util from '@alicloud/tea-util';
import * as fs from 'fs';
import { OcrServiceConfig } from './settings';
import Stream from '@alicloud/darabonba-stream';

export interface OcrResult {
    success: boolean;
    text: string;
    error?: string;
}

/**
 * Create Alibaba Cloud OCR API client
 */
function createClient(config: OcrServiceConfig): ocr_api20210707 {
    const openApiConfig = new $OpenApi.Config({
        accessKeyId: config.accessKey,
        accessKeySecret: config.secretKey,
    });
    
    openApiConfig.endpoint = 'ocr-api.cn-hangzhou.aliyuncs.com';
    return new ocr_api20210707(openApiConfig);
}

/**
 * Recognize text from an image using Alibaba Cloud OCR
 * @param imagePath Path to the image file
 * @returns Recognized text and success status
 */
export async function recognizeImage(imagePath: string, serviceConfig: OcrServiceConfig): Promise<OcrResult> {
    try {
        // 验证服务配置
        if (!serviceConfig || !serviceConfig.accessKey || !serviceConfig.secretKey) {
            throw new Error('OCR服务配置无效，请在插件设置中配置AccessKey和Secret');
        }

        // 创建客户端
        const client = createClient(serviceConfig);
        
        // For URL images
        if (imagePath.startsWith('http')) {
            return await recognizeFromUrl(client, imagePath);
        }
        
        // For local files
        return await recognizeFromFile(client, imagePath);
    } catch (error: any) {
        console.error('OCR recognition error:', error);
        return {
            success: false,
            text: '',
            error: error.message || 'Unknown error'
        };
    }
}

/**
 * Recognize text from an image URL
 */
async function recognizeFromUrl(
    client: ocr_api20210707, 
    imageUrl: string
): Promise<OcrResult> {
    const request = new $ocr_api20210707.RecognizeGeneralRequest({
        url: imageUrl,
    });
    
    const runtime = new $Util.RuntimeOptions({});
    const response = await client.recognizeGeneralWithOptions(request, runtime);
    
    // @ts-ignore - The type definitions might not properly reflect the actual response structure
    if (response && response.body && response.body.data) {
        return {
            success: true,
            // @ts-ignore - The content property exists in the response but not in type definitions
            text: response.body.data.content || ''
        };
    }
    
    return {
        success: false,
        text: '',
        error: 'Failed to extract text from response'
    };
}

/**
 * Recognize text from a local image file
 */
async function recognizeFromFile(
    client: ocr_api20210707, 
    imagePath: string
): Promise<OcrResult> {
    // Read the file and convert to base64
    const imageStream =  Stream.readFromFilePath(imagePath);
    
    const request = new $ocr_api20210707.RecognizeGeneralRequest({
        body: imageStream,
    });
    
    const runtime = new $Util.RuntimeOptions({});
    const response = await client.recognizeGeneralWithOptions(request, runtime);
    
    // @ts-ignore - The type definitions might not properly reflect the actual response structure
    if (response && response.body && response.body.data) {
        return {
            success: true,
            // @ts-ignore - The content property exists in the response but not in type definitions
            text: response.body.data.content || ''
        };
    }
    
    return {
        success: false,
        text: '',
        error: 'Failed to extract text from response'
    };
} 