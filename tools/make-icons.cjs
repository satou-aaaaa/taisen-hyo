// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の地に、勝ち抜きの山（4枠→2→1）。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#123554"/>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="7"><path d="M18 80 V64 H38 V80 M62 80 V64 H82 V80" stroke="#7fc4ef"/><path d="M28 64 V44 H72 V64" stroke="#fffdf7"/><path d="M50 44 V22" stroke="#f6d77a"/></g><circle cx="50" cy="18" r="7" fill="#f6d77a"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
