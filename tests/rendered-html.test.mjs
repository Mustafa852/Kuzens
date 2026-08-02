import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
  directMessagesRoute,
  channelStateRoute,
  auditLogRoute,
  eventsRoute,
  autoModRoute,
  autoModSource,
  bookmarksRoute,
  pollsRoute,
  threadsRoute,
  serverGuideRoute,
  linkPreviewRoute,
  avatarRoute,
  storageSource,
  resetMembershipMigration,
  storeBuildSource,
  storeWorkflowSource,
  releaseWorkflowSource,
  channelCanvasRoute,
  scheduledMessagesRoute,
  scheduledDeliverySource,
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
    readFile(new URL("../app/api/direct-messages/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/channel-state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/audit-log/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/automod/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/automod.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/bookmarks/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/polls/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/threads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/server-guide/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/link-preview/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/avatar/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0022_reset_native_default_memberships.sql", import.meta.url), "utf8"),
    readFile(new URL("../desktop/electron-builder.store.cjs", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/windows-store-package.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/windows-release.yml", import.meta.url), "utf8"),
    readFile(new URL("../app/api/channel-canvas/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scheduled-messages/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/scheduled-messages.ts", import.meta.url), "utf8"),
  ]);

const apiRoot = new URL("../app/api/", import.meta.url);
const authStyles = await readFile(new URL("../app/auth.css", import.meta.url), "utf8");
const offlineSource = await readFile(new URL("../public/offline.html", import.meta.url), "utf8");
const mutationRouteSources = await Promise.all(
  (await readdir(apiRoot, { recursive: true }))
    .filter((entry) => entry.endsWith("route.ts"))
    .map(async (entry) => ({
      entry,
      source: await readFile(new URL(entry.replaceAll("\\", "/"), apiRoot), "utf8"),
    })),
);
const [accountRoute, channelPermissionsRoute] = await Promise.all([
  readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/channel-permissions/route.ts", import.meta.url), "utf8"),
]);
const desktopMain = await readFile(new URL("../desktop/main.cjs", import.meta.url), "utf8");
const authGateSource = await readFile(
  new URL("../app/KuzensAuthGate.tsx", import.meta.url),
  "utf8",
);
const noiseGateSource = await readFile(
  new URL("../public/audio/kuzens-noise-gate.js", import.meta.url),
  "utf8",
);

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
  assert.match(appSource, /className=\{`message-list[\s\S]{0,120}ref=\{messageList\}/);
  assert.match(appSource, /stickToLatest/);
  assert.match(appSource, /className="jump-latest"/);
  assert.doesNotMatch(appSource, /messagesEnd\.current\?\.scrollIntoView/);
});

test("uses the finished Kuzens interface instead of starter content", () => {
  assert.match(layoutSource, /Kuzens/);
  assert.match(appSource, /className=\{`app-shell/);
  assert.doesNotMatch(appSource, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageSource, /react-loading-skeleton/);
});

test("enforces server-side request and abuse protections", () => {
  assert.match(securitySource, /assertTrustedMutation/);
  assert.match(securitySource, /sec-fetch-site/);
  assert.match(securitySource, /x-kuzens-request/);
  assert.match(securitySource, /application\/json/);
  assert.match(securitySource, /enforceRateLimit/);
  assert.match(securitySource, /Sec-Fetch-Site, Origin/);
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
    directMessagesRoute,
    channelStateRoute,
    eventsRoute,
    autoModRoute,
    bookmarksRoute,
    pollsRoute,
    threadsRoute,
    serverGuideRoute,
  ]) {
    assert.match(route, /assertTrustedMutation\(request\)/);
    assert.match(route, /enforceRateLimit/);
  }
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.match(nextConfig, /frame-ancestors 'none'/);
});

test("keeps every state-changing API behind shared request and abuse guards", () => {
  const stateChanging = mutationRouteSources.filter(({ source }) =>
    /export async function (POST|PATCH|PUT|DELETE)/.test(source),
  );
  assert.ok(stateChanging.length >= 20);
  for (const { entry, source } of stateChanging) {
    assert.match(
      source,
      /assertTrustedMutation\(request\)/,
      `${entry} must reject forged cross-site mutations`,
    );
    assert.match(
      source,
      /enforceRateLimit\(/,
      `${entry} must limit automated abuse`,
    );
  }
});

test("keeps user content inert and realtime signals targeted", () => {
  assert.doesNotMatch(appSource, /dangerouslySetInnerHTML|eval\(|new Function/);
  assert.match(appSource, /Notification\.permission === "granted"/);
  assert.match(appSource, /Notification\.requestPermission\(\)/);
  assert.match(rtcRoute, /recipientProfileId/);
  assert.match(rtcRoute, /Kendine sinyal gönderemezsin/);
  assert.match(rtcRoute, /Yalnızca aynı ses odasındaki üyeler/);
  assert.doesNotMatch(rtcRoute, /recipientProfileId:\s*null/);
});

test("keeps generated links and codes copyable when clipboard permission is denied", () => {
  assert.match(appSource, /async function writeClipboardText/);
  assert.match(appSource, /document\.execCommand\("copy"\)/);
  assert.match(appSource, /Pano izni kapalı/);
  assert.match(appSource, /className="modal-card copy-fallback-modal"/);
  assert.match(appSource, /code: data\.invite\?\.code/);
  assert.equal((appSource.match(/navigator\.clipboard\.writeText/g) || []).length, 1);
  assert.match(desktopMain, /"clipboard-sanitized-write"/);
  assert.match(nextConfig, /clipboard-write=\(self\)/);
});

test("enforces scoped ownership, role hierarchy, and bans", () => {
  assert.match(communitySource, /server\.ownerProfileId === profile\.id/);
  assert.doesNotMatch(communitySource, /serverId === DEFAULT_SERVER_ID && profile\.isOwner/);
  assert.match(membersRoute, /rolePosition\(target\) <= rolePosition\(profile\)/);
  assert.match(membersRoute, /serverBans/);
  assert.match(invitesRoute, /Bu topluluğa erişimin yasaklanmış/);
  assert.match(rolesRoute, /Kurucu rolü başka bir üyeye atanamaz/);
});

test("starts native accounts empty and scopes every community to explicit membership", () => {
  assert.match(appSource, /const \[activeServerId, setActiveServerId\] = useState\(""\)/);
  assert.match(appSource, /const \[channels, setChannels\] = useState<Channel\[]>\(\[]\)/);
  assert.match(appSource, /className="zero-state-home"/);
  assert.match(appSource, /Başka kullanıcıların toplulukları, odaları ve mesajları burada görünmez/);
  assert.doesNotMatch(serversRoute, /serverIds\.add\(DEFAULT_SERVER_ID\)/);
  assert.doesNotMatch(profileRoute, /invite\?\.serverId \|\| DEFAULT_SERVER_ID/);
  assert.doesNotMatch(membersRoute, /serverId === DEFAULT_SERVER_ID && profile\.isOwner/);
  assert.doesNotMatch(messagesRoute, /serverId === DEFAULT_SERVER_ID && item\.isOwner/);
  assert.match(notificationsRoute, /allowedServerIds/);
  assert.match(notificationsRoute, /serverMembers\.profileId/);
  assert.match(resetMembershipMigration, /DELETE FROM `server_members`/);
  assert.match(resetMembershipMigration, /INNER JOIN `auth_accounts`/);
});

test("provides app-like context actions, mentions, reactions, and profile settings", () => {
  assert.match(appSource, /onContextMenu/);
  assert.match(appSource, /className="context-menu"/);
  assert.match(appSource, /mention-suggestions/);
  assert.match(appSource, /inline-mention/);
  assert.match(appSource, /toggleReaction/);
  assert.match(appSource, /profile-settings-modal/);
  assert.match(appSource, /api\/link-preview/);
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

test("delivers channel and direct messages with efficient near-realtime sync", () => {
  assert.match(messagesRoute, /requestedWait/);
  assert.match(messagesRoute, /Math\.min\(15_000/);
  assert.match(messagesRoute, /setTimeout\(resolve, Math\.min\(450/);
  assert.match(directMessagesRoute, /direct-message-sync/);
  assert.match(directMessagesRoute, /syncedAt: boundary/);
  assert.match(appSource, /query\.set\("wait", "12000"\)/);
  assert.match(appSource, /mergeDirectMessages/);
  assert.match(appSource, /pending: true/);
  assert.match(appSource, /gönderiliyor…/);
  assert.match(appStyles, /\.message\.pending/);
});

test("keeps friends, direct messages, and independent registration easy to discover", () => {
  assert.match(appSource, /className="social-quick-actions"/);
  assert.match(appSource, /Arkadaşlar ana sayfası/);
  assert.match(appSource, /pendingFriendCount/);
  assert.match(appSource, /className="rail-unread friend"/);
  assert.match(appStyles, /\.social-quick-actions/);
  assert.match(authGateSource, /Her kullanıcı kendi hesabını açabilir/);
  assert.match(authGateSource, /await signOut\(auth\)/);
  assert.match(authGateSource, /Bu e-posta zaten kayıtlı\. Giriş yap sekmesinden devam et/);
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

test("supports multi-role members and role-scoped channel access", () => {
  assert.match(schemaSource, /member_roles_server_member_role_idx/);
  assert.match(schemaSource, /channelPermissionOverwrites/);
  assert.match(communitySource, /permissions \| role\.permissions/);
  assert.match(communitySource, /basePermissions & ~denied/);
  assert.match(channelPermissionsRoute, /allowPermissions/);
  assert.match(channelPermissionsRoute, /denyPermissions/);
  assert.match(appSource, /Bir üyeye birden fazla rol verebilirsin/);
  assert.match(appSource, /Rol bazlı oda izinleri/);
  assert.match(membersRoute, /position: role\.position/);
  assert.match(membersRoute, /position: item\.position/);
  assert.match(appSource, /const memberRoleGroups = useMemo/);
  assert.match(appSource, /className="role-member-heading"/);
  assert.match(appSource, /collapsedMemberRoles/);
  assert.match(appStyles, /\.role-member-section/);
  assert.match(appStyles, /\.role-member-heading/);
});

test("provides protected account deletion and the requested owner identity", () => {
  assert.match(communitySource, /ibrahimilhan159@gmail\.com/);
  assert.match(communitySource, /profile && isPrimaryOwnerEmail\(identity\.email\) && !profile\.isOwner/);
  assert.match(communitySource, /set\(\{ isOwner: true \}\)/);
  assert.match(profileRoute, /isPrimaryOwnerEmail\(identity\.email\)/);
  assert.match(accountRoute, /confirmation !== "HESABIMI SİL"/);
  assert.match(accountRoute, /Önce sahibi olduğun toplulukları silmelisin/);
  assert.match(accountRoute, /assertTrustedMutation\(request\)/);
  assert.match(accountRoute, /enforceRateLimit/);
  assert.match(appSource, /Hesabı kalıcı olarak sil/);
});

test("separates personal Aura from Aura community upgrades", () => {
  assert.match(schemaSource, /serverAuraMemberships/);
  assert.match(auraRoute, /action === "grant-server"/);
  assert.match(auraRoute, /action === "revoke-server"/);
  assert.match(appSource, /AURA TOPLULUK/);
  assert.match(appSource, /Aura Topluluk \$\{serverAuraMembership\.tier\}/);
  assert.match(auraRoute, /targetByEmail/);
  assert.match(appSource, /kullanıcı adı veya e-posta/);
});

test("adds a unified activity center, command search, and focus mode", () => {
  assert.match(appSource, /modal === "activity"/);
  assert.match(appSource, /KUZENS AKIŞ/);
  assert.match(appSource, /openActivityCenter/);
  assert.match(appSource, /markAllNotificationsRead/);
  assert.match(appSource, /modal === "command"/);
  assert.match(appSource, /commandResults/);
  assert.match(appSource, /CTRL \/ ⌘ \+ SHIFT \+ K/);
  assert.match(appSource, /preferences\.focusMode/);
  assert.match(appStyles, /\.app-shell-v3\.focus-mode/);
  assert.match(appStyles, /\.activity-modal/);
  assert.match(appStyles, /\.command-modal/);
});

test("uses the readable Kuzens V2 visual system", () => {
  assert.match(appStyles, /Kuzens V2/);
  assert.match(appStyles, /--kz-violet/);
  assert.match(appStyles, /\.message p\s*\{[\s\S]*?font-size:\s*15px/);
  assert.match(appStyles, /\.account-modal\s*\{[\s\S]*?grid-template-columns/);
  assert.match(appSource, /Doğrulanmış kimlik oturumu/);
});

test("adds private direct messages with server-side privacy and ownership checks", () => {
  assert.match(schemaSource, /directConversations/);
  assert.match(schemaSource, /directMessages/);
  assert.match(schemaSource, /directMessageSettings/);
  assert.match(directMessagesRoute, /requireConversationMember/);
  assert.match(directMessagesRoute, /status === "blocked"/);
  assert.match(directMessagesRoute, /Yalnızca arkadaşlar|yalnızca arkadaşlarından/);
  assert.match(directMessagesRoute, /message\.authorProfileId !== profile\.id/);
  assert.match(schemaSource, /directConversationReads/);
  assert.match(schemaSource, /directMessageRequests/);
  assert.match(directMessagesRoute, /action === "read"/);
  assert.match(directMessagesRoute, /action === "request"/);
  assert.match(directMessagesRoute, /en fazla iki mesaj/);
  assert.match(directMessagesRoute, /unreadCount/);
  assert.match(directMessagesRoute, /orderBy\(desc\(directMessages\.createdAt\)\)/);
  assert.match(appSource, /className="modal-card direct-modal"/);
  assert.match(appSource, /className="rail-unread"/);
  assert.match(appSource, /className="direct-request-gate"/);
});

test("supports advanced search, accessibility controls, and push-to-talk", () => {
  assert.match(appSource, /function matchesSearch/);
  assert.match(appSource, /from:/);
  assert.match(appSource, /has:link/);
  assert.match(appSource, /is:pinned/);
  assert.match(appSource, /kuzens-preferences/);
  assert.match(appSource, /kuzens-drafts/);
  assert.match(appSource, /preferences\.pushToTalk/);
  assert.match(appSource, /audioConstraintsFor/);
  assert.match(appSource, /voiceIsolation/);
  assert.match(appSource, /prepareVoiceInput/);
  assert.match(appSource, /noiseFilterStrength/);
  assert.match(appSource, /configureAudioSender/);
  assert.match(appSource, /latency = \{ ideal: 0\.01 \}/);
  assert.match(appSource, /automaticInputSensitivity/);
  assert.match(appSource, /inputSensitivityDb/);
  assert.match(appSource, /autoGainControl: false/);
  assert.match(appSource, /voicePresetFor/);
  assert.match(appSource, /Mikrofon testi/);
  assert.match(appSource, /setInterval\(\(\) => void pollSignals\(\), 650\)/);
  assert.match(appSource, /if \(polling \|\| stopped\) return/);
  assert.match(noiseGateSource, /registerProcessor\("kuzens-noise-gate"/);
  assert.match(noiseGateSource, /this\.noiseFloor = 0\.0025/);
  assert.match(noiseGateSource, /this\.holdFrames = 52/);
  assert.match(noiseGateSource, /noiseMultiplier/);
  assert.match(appSource, /replaceMicrophoneInput/);
  assert.match(appSource, /Temiz Ses/);
  assert.match(appSource, /microphoneLevel/);
  assert.match(appSource, /event\.code === "Space"/);
  assert.match(appSource, /event\.altKey/);
  assert.match(appSource, /CTRL \/ ⌘ \+ SHIFT \+ M/);
  assert.match(appSource, /event\.key === "Escape"/);
  assert.match(appSource, /aria-live=/);
  assert.match(appStyles, /\.app-shell\.high-contrast/);
  assert.match(appStyles, /\.app-shell\.reduce-motion/);
  assert.match(appStyles, /:focus-visible/);
  assert.match(appStyles, /content-visibility:\s*auto/);
});

test("separates channel notifications from unread indicators", () => {
  assert.match(schemaSource, /channelNotificationSettings/);
  assert.match(schemaSource, /channelReads/);
  assert.match(channelStateRoute, /action === "read"/);
  assert.match(channelStateRoute, /action === "settings"/);
  assert.match(channelStateRoute, /showUnread/);
  assert.match(appSource, /channel-notification-modal/);
  assert.match(appSource, /notificationLevel/);
  assert.match(appSource, /mention-badge/);
});

test("shows protected moderation audit history", () => {
  assert.match(auditLogRoute, /permissionsFor/);
  assert.match(auditLogRoute, /moderationPermissions/);
  assert.match(auditLogRoute, /auditLogs/);
  assert.match(appSource, /className="modal-card audit-modal"/);
});

test("provides recurring community events, RSVP reminders, and calendar export", () => {
  assert.match(schemaSource, /communityEvents/);
  assert.match(schemaSource, /eventRsvps/);
  assert.match(eventsRoute, /occurrencesFor/);
  assert.match(eventsRoute, /recurrence === "weekly"/);
  assert.match(eventsRoute, /reminderMinutes/);
  assert.match(eventsRoute, /requireMember/);
  assert.match(eventsRoute, /PERMISSIONS\.manageServer/);
  assert.match(appSource, /className="modal-card events-modal"/);
  assert.match(appSource, /BEGIN:VCALENDAR/);
  assert.match(appSource, /Katılacağım/);
});

test("blocks abusive messages with configurable and auditable AutoMod rules", () => {
  assert.match(schemaSource, /serverAutoModerationSettings/);
  assert.match(autoModRoute, /requirePermission\(profile, PERMISSIONS\.manageServer/);
  assert.match(autoModRoute, /exemptChannelIds/);
  assert.match(autoModSource, /mention-limit/);
  assert.match(autoModSource, /external-invite/);
  assert.match(autoModSource, /duplicate-spam/);
  assert.match(autoModSource, /custom-keyword/);
  assert.match(autoModSource, /automod\.block/);
  assert.match(messagesRoute, /checkAutoModeration/);
  assert.match(appSource, /className="modal-card automod-modal"/);
});

test("ships saved-message reminders and device-level voice personalization", () => {
  assert.match(schemaSource, /messageBookmarks/);
  assert.match(bookmarksRoute, /requireMember\(identity, message\.serverId\)/);
  assert.match(bookmarksRoute, /reminderDue/);
  assert.match(appSource, /Sonra için kaydet/);
  assert.match(appSource, /className="modal-card bookmarks-modal"/);
  assert.match(appSource, /kuzens-member-volumes/);
  assert.match(appSource, /preferences\.noiseSuppression/);
  assert.match(appSource, /preferences\.echoCancellation/);
  assert.match(appSource, /className="member-volume"/);
});

test("adds a persistent channel canvas with channel-scoped permissions", () => {
  assert.match(schemaSource, /export const channelCanvases/);
  assert.match(channelCanvasRoute, /requireMember\(identity, serverId\)/);
  assert.match(channelCanvasRoute, /PERMISSIONS\.viewChannels/);
  assert.match(channelCanvasRoute, /PERMISSIONS\.manageChannels/);
  assert.match(channelCanvasRoute, /max:\s*12_000/);
  assert.match(channelCanvasRoute, /channel\.canvas\.update/);
  assert.match(appSource, /className="modal-card channel-canvas-modal"/);
  assert.match(appSource, /Kanal Panosu/);
  assert.doesNotMatch(appSource, /dangerouslySetInnerHTML/);
});

test("schedules idempotent messages and rechecks delivery permissions", () => {
  assert.match(schemaSource, /export const scheduledMessages/);
  assert.match(scheduledMessagesRoute, /assertTrustedMutation/);
  assert.match(scheduledMessagesRoute, /checkAutoModeration/);
  assert.match(scheduledMessagesRoute, /PERMISSIONS\.sendMessages/);
  assert.match(scheduledMessagesRoute, /message-schedule/);
  assert.match(scheduledDeliverySource, /channelPermissionsFor/);
  assert.match(scheduledDeliverySource, /checkAutoModeration/);
  assert.match(scheduledDeliverySource, /Gönderen artık bu topluluğun üyesi değil/);
  assert.match(scheduledDeliverySource, /const scheduledMessageId = `scheduled-\$\{row\.id\}`/);
  assert.match(scheduledDeliverySource, /onConflictDoNothing/);
  assert.match(messagesRoute, /publishDueScheduledMessages/);
  assert.match(appSource, /className="modal-card scheduled-modal"/);
  assert.match(appSource, /Sonra gönder/);
});

test("offers a low-power mode without slowing active voice signaling", () => {
  assert.match(appSource, /lowPowerMode:\s*boolean/);
  assert.match(appSource, /preferences\.lowPowerMode \? 2_500 : 750/);
  assert.match(appSource, /voiceConnected \? 2_000 : preferences\.lowPowerMode/);
  assert.match(appSource, /Tasarruf modu/);
  assert.match(appStyles, /\.app-shell\.low-power/);
  assert.match(appSource, /pollSignals\(\), 650/);
});

test("treats user blocks as a channel, notification, and DM boundary", () => {
  assert.match(messagesRoute, /blockedAuthor/);
  assert.match(messagesRoute, /blockedProfileIdsFor/);
  assert.match(notificationsRoute, /blockedProfileIds/);
  assert.match(directMessagesRoute, /requireConversationUnblocked/);
  assert.match(directMessagesRoute, /blockedProfileIds/);
  assert.match(threadsRoute, /blockedProfileIds/);
  assert.match(appSource, /blocked-message-reveal/);
});

test("adds bot-free polls with scoped voting and duplicate-vote protection", () => {
  assert.match(schemaSource, /export const polls/);
  assert.match(schemaSource, /pollOptions/);
  assert.match(schemaSource, /pollVotes/);
  assert.match(pollsRoute, /requireMember/);
  assert.match(pollsRoute, /checkAutoModeration/);
  assert.match(pollsRoute, /allowMultiple/);
  assert.match(pollsRoute, /Bu anket sona erdi/);
  assert.match(messagesRoute, /totalVotes/);
  assert.match(appSource, /function PollCard/);
  assert.match(appSource, /className="modal-card poll-modal"/);
});

test("keeps message threads persistent, scoped, and moderation-aware", () => {
  assert.match(schemaSource, /messageThreads/);
  assert.match(schemaSource, /threadMessages/);
  assert.match(threadsRoute, /requireMember/);
  assert.match(threadsRoute, /checkAutoModeration/);
  assert.match(threadsRoute, /row\.thread\.locked \|\| row\.thread\.archived/);
  assert.match(threadsRoute, /PERMISSIONS\.manageMessages/);
  assert.match(messagesRoute, /replyCount/);
  assert.match(appSource, /className="thread-chip"/);
  assert.match(appSource, /className="modal-card thread-modal"/);
  assert.match(appSource, /threadDraftKey/);
});

test("supports accessible channel ordering, favorites, and complete deletion cleanup", () => {
  assert.match(appSource, /kuzens-favorite-channels/);
  assert.match(appSource, /FAVORİLERİM/);
  assert.match(appSource, /async function reorderChannel/);
  assert.match(appSource, /Yukarı taşı/);
  assert.match(serversRoute, /messageBookmarks/);
  assert.match(serversRoute, /threadMessages/);
  assert.match(serversRoute, /pollVotes/);
  assert.match(serversRoute, /eventRsvps/);
  assert.match(serversRoute, /channelCanvases/);
  assert.match(serversRoute, /scheduledMessages/);
});

test("provides a permissioned and persistent new-member guide", () => {
  assert.match(schemaSource, /serverGuides/);
  assert.match(schemaSource, /serverGuideProgress/);
  assert.match(serverGuideRoute, /requirePermission\(profile, PERMISSIONS\.manageServer/);
  assert.match(serverGuideRoute, /GUIDE_STEPS/);
  assert.match(serverGuideRoute, /completedAt/);
  assert.match(appSource, /className="modal-card guide-modal"/);
  assert.match(appSource, /Başlangıç rehberi/);
});

test("ships an installable shell without caching private application data", () => {
  assert.match(manifestSource, /display:\s*"standalone"/);
  assert.match(manifestSource, /categories:\s*\["social", "communication"\]/);
  assert.match(serviceWorkerSource, /skipWaiting/);
  assert.match(appSource, /display-mode: standalone/);
  assert.match(serviceWorkerSource, /url\.pathname\.startsWith\("\/api\/"\)\) return/);
  assert.doesNotMatch(serviceWorkerSource, /cache\.put\([^\n]*\/api\//);
  assert.match(serviceWorkerSource, /caches\.match\("\/offline\.html"\)/);
  assert.match(offlineSource, /Kuzens burada, internetin biraz geride kaldı/);
  assert.match(layoutSource, /favicon\.svg/);
});

test("builds a Store-signed distribution path and supports trusted EXE signing", () => {
  assert.match(packageSource, /desktop:store/);
  assert.match(storeBuildSource, /WINDOWS_STORE_IDENTITY_NAME/);
  assert.match(storeBuildSource, /WINDOWS_STORE_PUBLISHER/);
  assert.match(storeBuildSource, /target: "appx"/);
  assert.match(storeBuildSource, /languages: \["tr-TR", "en-US"\]/);
  assert.match(storeWorkflowSource, /Microsoft Store paketini uret/);
  assert.match(storeWorkflowSource, /actions\/upload-artifact@v4/);
  assert.match(releaseWorkflowSource, /WIN_CSC_LINK/);
  assert.match(releaseWorkflowSource, /WIN_CSC_KEY_PASSWORD/);
  assert.match(appSource, /SmartScreen uyar\u0131s\u0131 olmadan kur/);
});

test("uses an original Kuzens loading scene and the distinct Nova interface", async () => {
  const loadingImage = await readFile(new URL("../public/kuzens-loading-v1.webp", import.meta.url));
  assert.ok(loadingImage.byteLength > 100_000);
  assert.match(appSource, /kuzens-loading-v1\.webp/);
  assert.match(appSource, /Kuzenlerinle buluşuyorsun/);
  assert.match(appSource, /app-shell app-shell-v3/);
  assert.match(appSource, /community-hub-card/);
  assert.match(appStyles, /Kuzens Nova/);
  assert.match(appStyles, /\.kuzens-splash/);
});

test("fetches rich link metadata server-side without becoming an open proxy", () => {
  assert.match(schemaSource, /linkPreviews/);
  assert.match(linkPreviewRoute, /safeRemoteUrl/);
  assert.match(linkPreviewRoute, /isPrivateIpv4/);
  assert.match(linkPreviewRoute, /store\.steampowered\.com\/api\/appdetails/);
  assert.match(linkPreviewRoute, /youtube\.com\/oembed/);
  assert.match(linkPreviewRoute, /og:title/);
  assert.match(linkPreviewRoute, /linkPreviews\.imageUrl/);
  assert.match(linkPreviewRoute, /IMAGE_LIMIT/);
  assert.match(linkPreviewRoute, /enforceRateLimit/);
  assert.doesNotMatch(appSource, /dangerouslySetInnerHTML/);
});

test("stores validated profile photos privately and renders real presence states", () => {
  assert.match(schemaSource, /avatarKey/);
  assert.match(storageSource, /UPLOADS/);
  assert.match(profileRoute, /webp\|png\|jpeg/);
  assert.match(profileRoute, /600_000/);
  assert.match(profileRoute, /getUploads\(\)\.put/);
  assert.match(avatarRoute, /requireIdentity/);
  assert.match(avatarRoute, /requireProfile/);
  assert.match(appSource, /selectProfileAvatar/);
  assert.match(appSource, /profileAvatarDataUrl/);
  assert.match(appStyles, /\.presence-dnd/);
  assert.match(appStyles, /\.presence-idle/);
  assert.match(appStyles, /\.presence-invisible/);
});

test("keeps mobile authentication inside the viewport", () => {
  assert.match(authStyles, /overflow-x:\s*hidden/);
  assert.match(authStyles, /\.auth-visual,[\s\S]*\.auth-card\s*\{[\s\S]*min-width:\s*0/);
  assert.match(authStyles, /env\(safe-area-inset-bottom\)/);
});

test("preserves failed messages and isolates device drafts per account", () => {
  assert.match(appSource, /`kuzens-drafts:\$\{profile\.id\}`/);
  assert.match(appSource, /`kuzens-member-volumes:\$\{profile\.id\}`/);
  assert.match(appSource, /`kuzens-favorite-channels:\$\{profile\.id\}`/);
  assert.match(appSource, /function readLocalDrafts/);
  assert.match(appSource, /function writeLocalJson/);
  assert.match(appSource, /autoGainControl:\s*saved\.autoGainControl === true/);
  assert.match(appSource, /Taslağın korundu/);
  assert.match(appSource, /failedFiles\.length/);
  assert.match(appSource, /local-\$\{crypto\.randomUUID\(\)\}/);
  assert.match(appSource, /className="draft-badge">Taslak/);
  assert.match(appSource, /className=\{`sync-indicator sync-\$\{syncState\}`\}/);
  assert.match(appStyles, /\.sync-indicator\.sync-offline/);
});
