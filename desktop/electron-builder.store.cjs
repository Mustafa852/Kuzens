const requiredEnvironment = [
  "WINDOWS_STORE_IDENTITY_NAME",
  "WINDOWS_STORE_PUBLISHER",
];

const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]?.trim());

if (missingEnvironment.length > 0) {
  throw new Error(
    [
      "Microsoft Store paket kimliği eksik.",
      `Eksik alanlar: ${missingEnvironment.join(", ")}`,
      "Partner Center > Ürün yönetimi > Ürün kimliği sayfasındaki değerleri kullanın.",
    ].join(" "),
  );
}

const publisherDisplayName =
  process.env.WINDOWS_STORE_PUBLISHER_DISPLAY_NAME?.trim() || "Kuzens";

module.exports = {
  appId: "com.kuzens.chat",
  productName: "Kuzens",
  copyright: "Copyright © 2026 Kuzens. Tüm hakları saklıdır.",
  asar: true,
  npmRebuild: false,
  directories: {
    app: "desktop",
    output: "release/store",
  },
  files: ["main.cjs", "offline.html", "icon-512.png", "package.json"],
  artifactName: "Kuzens-Store-${version}-${arch}.${ext}",
  win: {
    icon: "public/icon-512.png",
    target: [
      {
        target: "appx",
        arch: ["x64"],
      },
    ],
  },
  appx: {
    applicationId: "Kuzens",
    identityName: process.env.WINDOWS_STORE_IDENTITY_NAME.trim(),
    publisher: process.env.WINDOWS_STORE_PUBLISHER.trim(),
    publisherDisplayName,
    displayName: "Kuzens",
    backgroundColor: "#09080f",
    languages: ["tr-TR", "en-US"],
    showNameOnTiles: true,
    setBuildNumber: true,
  },
};
