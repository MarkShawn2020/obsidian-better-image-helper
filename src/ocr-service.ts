import ocr_api20210707, * as $ocr_api20210707 from '@alicloud/ocr-api20210707';
import OpenApi, * as $OpenApi from '@alicloud/openapi-client';
import Util, * as $Util from '@alicloud/tea-util';
import * as fs from 'fs';

interface OcrResult {
    success: boolean;
    text: string;
    error?: string;
}

/**
 * Create Alibaba Cloud OCR API client
 */
function createClient(): ocr_api20210707 {
    const config = new $OpenApi.Config({
        accessKeyId: process.env.ALI_AK || '',
        accessKeySecret: process.env.ALI_SK || '',
    });
    
    config.endpoint = 'ocr-api.cn-hangzhou.aliyuncs.com';
    return new ocr_api20210707(config);
}

/**
 * Recognize text from an image using Alibaba Cloud OCR
 * @param imagePath Path to the image file
 * @returns Recognized text and success status
 */
export async function recognizeImage(imagePath: string): Promise<OcrResult> {
    try {
        const client = createClient();
        
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
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const request = new $ocr_api20210707.RecognizeGeneralRequest({
        body: imageBuffer,
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