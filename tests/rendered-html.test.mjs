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
  assert.match(appSource, /event\.code === "Space"/);
  assert.match(appStyles, /\.app-shell\.high-contrast/);
  assert.match(appStyles, /\.app-shell\.reduce-motion/);
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

test("treats user blocks as a channel, notification, and DM boundary", () => {
  assert.match(messagesRoute, /blockedAuthor/);
  assert.match(messagesRoute, /blockedProfileIdsFor/);
  assert.match(notificationsRoute, /blockedProfileIds/);
  assert.match(directMessagesRoute, /requireConversationUnblocked/);
  assert.match(directMessagesRoute, /blockedProfileIds/);
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
  assert.match(serviceWorkerSource, /skipWaiting/);
  assert.doesNotMatch(serviceWorkerSource, /fetch|caches\./);
});
