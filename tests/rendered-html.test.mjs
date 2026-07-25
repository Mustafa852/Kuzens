import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  appSource,
  appStyles,
  globalStyles,
  layoutSource,
  packageSource,
  securitySource,
  messagesRoute,
  rtcRoute,
  membersRoute,
  rolesRoute,
  invitesRoute,
  friendsRoute,
  serversRoute,
  communitySource,
  reactionsRoute,
  notificationsRoute,
  profileRoute,
  manifestSource,
  serviceWorkerSource,
  nextConfig,
  auraRoute,
  schemaSource,
] =
  await Promise.all([
    readFile(new URL("../app/KuzensApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/kuzens.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/security.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/messages/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/rtc/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/members/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/roles/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invites/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/friends/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/servers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/community.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/reactions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/aura/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
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

test("enforces server-side request and abuse protections", () => {
  assert.match(securitySource, /assertTrustedMutation/);
  assert.match(securitySource, /sec-fetch-site/);
  assert.match(securitySource, /x-kuzens-request/);
  assert.match(securitySource, /application\/json/);
  assert.match(securitySource, /enforceRateLimit/);
  assert.match(messagesRoute, /assertTrustedMutation\(request\)/);
  assert.match(messagesRoute, /enforceRateLimit/);
  for (const route of [
    membersRoute,
    rolesRoute,
    invitesRoute,
    friendsRoute,
    serversRoute,
    reactionsRoute,
    notificationsRoute,
    profileRoute,
    auraRoute,
  ]) {
    assert.match(route, /assertTrustedMutation\(request\)/);
    assert.match(route, /enforceRateLimit/);
  }
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.match(nextConfig, /frame-ancestors 'none'/);
});

test("keeps user content inert and realtime signals targeted", () => {
  assert.doesNotMatch(appSource, /dangerouslySetInnerHTML|eval\(|new Function|Notification\./);
  assert.match(rtcRoute, /recipientProfileId/);
  assert.match(rtcRoute, /Kendine sinyal gönderemezsin/);
  assert.match(rtcRoute, /Yalnızca aynı ses odasındaki üyeler/);
  assert.doesNotMatch(rtcRoute, /recipientProfileId:\s*null/);
});

test("enforces scoped ownership, role hierarchy, and bans", () => {
  assert.match(communitySource, /server\.ownerProfileId === profile\.id/);
  assert.match(communitySource, /serverId === DEFAULT_SERVER_ID && profile\.isOwner/);
  assert.match(membersRoute, /rolePosition\(target\) <= rolePosition\(profile\)/);
  assert.match(membersRoute, /serverBans/);
  assert.match(invitesRoute, /Bu topluluğa erişimin yasaklanmış/);
  assert.match(rolesRoute, /Kurucu rolü başka bir üyeye atanamaz/);
});

test("provides app-like context actions, mentions, reactions, and profile settings", () => {
  assert.match(appSource, /onContextMenu/);
  assert.match(appSource, /className="context-menu"/);
  assert.match(appSource, /mention-suggestions/);
  assert.match(appSource, /inline-mention/);
  assert.match(appSource, /toggleReaction/);
  assert.match(appSource, /profile-settings-modal/);
  assert.match(messagesRoute, /@everyone ve @here yalnızca yetkili/);
  assert.match(messagesRoute, /messageMentions/);
  assert.match(reactionsRoute, /ALLOWED_REACTIONS/);
});

test("joins voice rooms on click and keeps the connected room independent from chat", () => {
  assert.match(appSource, /async function joinVoice\(channel: Channel\)/);
  assert.match(appSource, /if \(channel\.kind === "voice"\) await joinVoice\(channel\)/);
  assert.match(appSource, /connectedVoiceChannelId/);
  assert.doesNotMatch(
    appSource,
    /if \(voiceConnected && channel\.kind !== "voice"\)[\s\S]{0,80}toggleVoice/,
  );
});

test("ships owner-managed Kuzens Aura codes without storing plaintext codes", () => {
  assert.match(schemaSource, /auraMemberships/);
  assert.match(schemaSource, /auraCodes/);
  assert.match(auraRoute, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(auraRoute, /profile\.isOwner/);
  assert.match(auraRoute, /action === "redeem"/);
  assert.match(auraRoute, /action === "create-code"/);
  assert.match(auraRoute, /action === "grant"/);
  assert.doesNotMatch(schemaSource, /plainCode|plain_code/);
});

test("ships an installable shell without caching private application data", () => {
  assert.match(manifestSource, /display:\s*"standalone"/);
  assert.match(serviceWorkerSource, /skipWaiting/);
  assert.doesNotMatch(serviceWorkerSource, /fetch|caches\./);
});
