import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [appSource, appStyles, globalStyles, layoutSource, packageSource] =
  await Promise.all([
    readFile(new URL("../app/KuzensApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/kuzens.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

test("keeps the application fixed to the viewport", () => {
  assert.match(
    appStyles,
    /\.app-shell\s*\{[\s\S]*?height:\s*100dvh;[\s\S]*?max-height:\s*100dvh;[\s\S]*?overflow:\s*hidden;/,
  );
  assert.match(
    appStyles,
    /\.chat-panel\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/,
  );
  assert.match(
    globalStyles,
    /html,\s*body\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;/,
  );
});

test("scrolls messages inside their own panel", () => {
  assert.match(
    appStyles,
    /\.message-list\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/,
  );
  assert.match(appSource, /const messageList = useRef<HTMLDivElement \| null>/);
  assert.match(appSource, /list\.scrollTo\(\{[\s\S]*?top:\s*list\.scrollHeight/);
  assert.match(appSource, /className="message-list" ref=\{messageList\}/);
  assert.doesNotMatch(appSource, /messagesEnd\.current\?\.scrollIntoView/);
});

test("uses the finished Kuzens interface instead of starter content", () => {
  assert.match(layoutSource, /Kuzens/);
  assert.match(appSource, /className="app-shell"/);
  assert.doesNotMatch(appSource, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageSource, /react-loading-skeleton/);
});
