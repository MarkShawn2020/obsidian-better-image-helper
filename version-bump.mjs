import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.argv[2];
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifestJson = JSON.parse(readFileSync("manifest.json", "utf8"));
const versionsJson = JSON.parse(readFileSync("versions.json", "utf8"));

const { minAppVersion } = manifestJson;
const currentVersion = packageJson.version;

// Update versions.json with the min app version
if (targetVersion) {
  versionsJson[targetVersion] = minAppVersion;
} else {
  versionsJson[currentVersion] = minAppVersion;
}

// Update the version in package.json
if (targetVersion) {
  packageJson.version = targetVersion;
  manifestJson.version = targetVersion;
}

writeFileSync("package.json", JSON.stringify(packageJson, null, 2));
writeFileSync("manifest.json", JSON.stringify(manifestJson, null, 2));
writeFileSync("versions.json", JSON.stringify(versionsJson, null, 2)); 