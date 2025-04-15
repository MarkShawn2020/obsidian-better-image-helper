import fs from 'fs';
import path from 'path';

// 读取 dist/main.js 文件
const filePath = path.join('dist', 'main.js');
console.log(`正在处理文件：${filePath}`);

try {
  // 读取文件内容
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 替换 timer.unref() 为 // timer.unref()
  const originalContent = content;
  content = content.replace(/timer\.unref\(\);/g, '// timer.unref();');
  
  // 如果有替换，则写回文件
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    const count = (originalContent.match(/timer\.unref\(\);/g) || []).length;
    console.log(`✅ 成功替换了 ${count} 处 timer.unref() 调用`);
  } else {
    console.log('⚠️ 没有找到任何 timer.unref() 调用需要替换');
  }
} catch (error) {
  console.error(`❌ 处理文件时出错: ${error.message}`);
  process.exit(1);
} 