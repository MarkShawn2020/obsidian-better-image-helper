import { readFileSync, writeFileSync } from "fs";

// 从命令行参数获取版本号，如果没有则使用package.json中的版本号
const targetVersion = process.argv[2];
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifestJson = JSON.parse(readFileSync("manifest.json", "utf8"));
const versionsJson = JSON.parse(readFileSync("versions.json", "utf8"));

const { minAppVersion } = manifestJson;
// 使用package.json中的版本号作为当前版本
const currentVersion = packageJson.version;

// 如果提供了目标版本，使用它；否则使用当前版本
const versionToUse = targetVersion || currentVersion;

// 更新versions.json，使用新版本关联到当前的minAppVersion
versionsJson[versionToUse] = minAppVersion;

// 更新manifest.json中的版本
manifestJson.version = versionToUse;

// 保存更新后的文件
writeFileSync("manifest.json", JSON.stringify(manifestJson, null, 2));
writeFileSync("versions.json", JSON.stringify(versionsJson, null, 2));

console.log(`✅ 版本已更新到: ${versionToUse}`); 