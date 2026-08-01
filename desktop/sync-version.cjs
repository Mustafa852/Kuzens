/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const rootPackagePath = path.join(__dirname, "..", "package.json");
const desktopPackagePath = path.join(__dirname, "package.json");
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, "utf8"));
const desktopPackage = JSON.parse(fs.readFileSync(desktopPackagePath, "utf8"));

desktopPackage.version = rootPackage.version;
fs.writeFileSync(desktopPackagePath, `${JSON.stringify(desktopPackage, null, 2)}\n`);
