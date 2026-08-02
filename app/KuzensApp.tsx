"use client";

import {
  FormEvent,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  deleteKuzensFirebaseUser,
  signOutKuzensFirebase,
} from "./firebase-client";
import "./kuzens.css";

type Channel = {
  id: string;
  serverId: string;
  name: string;
  kind: "text" | "voice" | "forum" | "announcement";
  categoryId?: string | null;
  topic?: string | null;
  slowModeSeconds?: number;
  bitrate?: number;
  userLimit?: number;
  region?: string;
  historyMode?: "all" | "since_join";
  permissions?: number;
  position: number;
  unreadCount?: number;
  mentionCount?: number;
  notificationLevel?: "all" | "mentions" | "none";
  showUnread?: boolean;
};

type ChannelCategory = {
  id: string;
  serverId: string;
  name: string;
  position: number;
  collapsedByDefault: boolean;
};

type MessageAttachment = {
  id: string;
  messageId: string;
  fileName: string;
  contentType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  url: string;
};

type CustomEmoji = { id: string; name: string; url: string; createdAt: string };

type ChatMessage = {
  id: string;
  channelId: string;
  authorProfileId?: string | null;
  authorName: string;
  authorTag: string;
  authorAvatarUrl?: string | null;
  content: string;
  replyToId?: string | null;
  pinned?: boolean;
  mentionedMe?: boolean;
  blockedAuthor?: boolean;
  reactions?: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  poll?: PollData | null;
  thread?: ThreadSummary | null;
  attachments?: MessageAttachment[];
  pending?: boolean;
};

type ThreadSummary = {
  id: string;
  title: string;
  replyCount: number;
  locked: boolean;
  archived: boolean;
  updatedAt: string;
};

type ThreadDetail = {
  id: string;
  parentMessageId: string;
  channelId: string;
  serverId: string;
  creatorProfileId: string;
  title: string;
  locked: boolean;
  archived: boolean;
  channelName: string;
  parent: {
    id: string;
    authorName: string;
    authorTag: string;
    content: string;
    createdAt: string;
    blockedAuthor?: boolean;
  } | null;
};

type ThreadReply = {
  id: string;
  threadId: string;
  authorProfileId: string;
  authorName: string;
  authorUsername: string;
  content: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  blockedAuthor?: boolean;
  createdAt: string;
};

type PollData = {
  id: string;
  question: string;
  allowMultiple: boolean;
  closesAt: string;
  closedAt?: string | null;
  totalVotes: number;
  options: Array<{
    id: string;
    label: string;
    count: number;
    votedByMe: boolean;
  }>;
};

type Toast = { text: string; tone?: "success" | "danger" };

type CopyFallback = {
  title: string;
  description: string;
  value: string;
  label: string;
  code?: string;
};

type Profile = {
  id: string;
  displayName: string;
  username: string;
  bio?: string;
  customStatus?: string;
  presenceStatus?: "online" | "idle" | "dnd" | "invisible";
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  profileColor?: string;
  statusExpiresAt?: string | null;
  allowFriendRequests?: boolean;
  isOwner: boolean;
};

type Role = {
  id: string;
  serverId: string;
  name: string;
  color: string;
  permissions: number;
  position: number;
};

type RoleAssignment = {
  id: string;
  serverId: string;
  memberTag: string;
  roleId: string;
};

type ChannelPermissionOverwrite = {
  id?: string;
  channelId: string;
  roleId: string;
  allowPermissions: number;
  denyPermissions: number;
};

type ChannelMemberPermissionOverwrite = {
  id?: string;
  channelId: string;
  profileId: string;
  allowPermissions: number;
  denyPermissions: number;
};

type Member = {
  id: string;
  name: string;
  tag: string;
  online: boolean;
  lastSeenAt: string | null;
  voiceChannelId: string | null;
  sharing: boolean;
  customStatus?: string;
  presenceStatus?: "online" | "idle" | "dnd" | "invisible" | "offline";
  bio?: string;
  avatarUrl?: string | null;
  displayName?: string;
  bannerUrl?: string | null;
  profileColor?: string;
  timeoutUntil?: string | null;
  serverMuted?: boolean;
  serverDeafened?: boolean;
  role: { id: string; name: string; color: string; position: number } | null;
  roles?: Array<{ id: string; name: string; color: string; position: number }>;
};

type BannedMember = {
  id: string;
  name: string;
  tag: string;
  reason: string;
  createdAt: string;
};

type RtcSignal = {
  id: string;
  senderProfileId: string;
  recipientProfileId: string;
  type: "offer" | "answer" | "ice" | "sound";
  payload: string;
  createdAt: string;
};

type CommunityServer = {
  id: string;
  name: string;
  icon: string;
  description?: string;
  defaultNotificationLevel?: "all" | "mentions";
  explicitContentFilter?: boolean;
  preferredLocale?: string;
  systemChannelId?: string | null;
  ownerProfileId?: string | null;
};

type FriendItem = {
  id: string;
  status: "pending" | "accepted" | "blocked";
  direction: "incoming" | "outgoing";
  profile: { id: string; name: string; tag: string; avatarUrl?: string | null };
};

type MentionNotification = {
  id: string;
  messageId: string;
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
  authorName: string;
  content: string;
  createdAt: string;
  kind?: "mention" | "reply" | "role" | "everyone";
};

type AuraMembership = {
  id: string;
  profileId: string;
  source: "code" | "owner" | "purchase";
  expiresAt: string | null;
  active: boolean;
};

type AuraCode = {
  id: string;
  codeHint: string;
  durationDays: number;
  maxUses: number;
  uses: number;
  active: boolean;
  createdAt: string;
};

type AuraOwnerMembership = {
  id: string;
  profileId: string;
  username: string;
  displayName: string;
  source: string;
  expiresAt: string | null;
};

type ServerAuraMembership = {
  id: string;
  serverId: string;
  tier: number;
  source: string;
  expiresAt: string | null;
  active: boolean;
};

type AuraOwnerServer = Omit<ServerAuraMembership, "active"> & {
  serverName: string;
};

type AppPreferences = {
  fontSize: "small" | "normal" | "large";
  density: "comfortable" | "compact";
  highContrast: boolean;
  reducedMotion: boolean;
  focusMode: boolean;
  pushToTalk: boolean;
  inputDeviceId: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  noiseFilterStrength: "balanced" | "strong";
  automaticInputSensitivity: boolean;
  inputSensitivityDb: number;
};

type VoicePreset = "clear" | "balanced" | "studio";

type DirectConversation = {
  id: string;
  profile: {
    id: string;
    name: string;
    username: string;
    bio?: string;
    status?: string;
    avatarUrl?: string | null;
  };
  lastMessage: string;
  updatedAt: string;
  unreadCount?: number;
  requestStatus?: "pending" | "accepted" | "ignored" | null;
  requestDirection?: "incoming" | "outgoing" | null;
  isGroup?: boolean;
  name?: string | null;
  members?: Array<{ id: string; name: string; username: string; avatarUrl?: string | null }>;
  pinned?: boolean;
  mutedUntil?: string | null;
};

type DirectMessage = {
  id: string;
  conversationId: string;
  authorProfileId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string | null;
  content: string;
  pinned?: boolean;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  pending?: boolean;
};

type AuditEntry = {
  id: string;
  action: string;
  targetId?: string | null;
  detail?: string | null;
  createdAt: string;
  actorProfileId: string;
  actorName: string;
  actorUsername: string;
};

type ContentReport = {
  id: string;
  targetType: "message" | "profile";
  targetId: string;
  reason: string;
  details: string;
  status: "open" | "reviewed" | "closed";
  reporterProfileId: string;
  createdAt: string;
};

type CommunityEvent = {
  id: string;
  serverId: string;
  creatorProfileId: string;
  channelId?: string | null;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  recurrence: "none" | "weekly" | "monthly";
  cancelledAt?: string | null;
  creator: { id: string; name: string; username: string } | null;
  counts: { going: number; interested: number };
  myRsvp: {
    response: "going" | "interested" | "declined";
    reminderMinutes: number;
  } | null;
  occurrences: Array<{
    occurrenceId: string;
    startsAt: string;
    endsAt: string;
  }>;
};

type AutoModSettings = {
  enabled: boolean;
  blockedTerms: string;
  blockInviteLinks: boolean;
  blockDuplicateMessages: boolean;
  maxMentions: number;
  blockedDomains: string;
  maxMessagesPerMinute: number;
  raidJoinLimit: number;
  exemptChannelIds: string[];
};

type SavedMessage = {
  id: string;
  messageId: string;
  note: string;
  remindAt?: string | null;
  createdAt: string;
  updatedAt: string;
  reminderDue: boolean;
  message: {
    id: string;
    channelId: string;
    authorName: string;
    authorTag: string;
    content: string;
    createdAt: string;
    channelName: string;
    serverId: string;
    serverName: string;
  };
};

type ServerGuideData = {
  welcomeMessage: string;
  rulesChannelId: string | null;
};

const defaultPreferences: AppPreferences = {
  fontSize: "normal",
  density: "comfortable",
  highContrast: false,
  reducedMotion: false,
  focusMode: false,
  pushToTalk: false,
  inputDeviceId: "",
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
  noiseFilterStrength: "strong",
  automaticInputSensitivity: true,
  inputSensitivityDb: -42,
};

type VoiceProcessingStatus = {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  voiceIsolation: boolean;
  enhancedNoiseFilter: boolean;
};

type VoiceAudioPipeline = {
  rawStream: MediaStream;
  outputStream: MediaStream;
  context: AudioContext;
};

type PreparedVoiceInput = {
  stream: MediaStream;
  pipeline: VoiceAudioPipeline | null;
  status: VoiceProcessingStatus;
};

function audioConstraintsFor(preferences: AppPreferences): MediaTrackConstraints {
  const supported = navigator.mediaDevices.getSupportedConstraints() as MediaTrackSupportedConstraints & {
    voiceIsolation?: boolean;
  };
  const constraints = {
    ...(preferences.inputDeviceId
      ? { deviceId: { exact: preferences.inputDeviceId } }
      : {}),
    echoCancellation: preferences.echoCancellation,
    noiseSuppression: preferences.noiseSuppression,
    autoGainControl: preferences.autoGainControl,
  } as MediaTrackConstraints & { voiceIsolation?: boolean };
  if (supported.channelCount) constraints.channelCount = { ideal: 1 };
  if (supported.sampleRate) constraints.sampleRate = { ideal: 48_000 };
  if (supported.sampleSize) constraints.sampleSize = { ideal: 16 };
  if (supported.latency) constraints.latency = { ideal: 0.01 };
  if (supported.voiceIsolation) {
    constraints.voiceIsolation = preferences.noiseSuppression;
  }
  return constraints;
}

function voicePresetFor(preferences: AppPreferences): VoicePreset | "custom" {
  if (
    preferences.echoCancellation &&
    preferences.noiseSuppression &&
    !preferences.autoGainControl &&
    preferences.noiseFilterStrength === "strong"
  ) return "clear";
  if (
    preferences.echoCancellation &&
    preferences.noiseSuppression &&
    !preferences.autoGainControl &&
    preferences.noiseFilterStrength === "balanced"
  ) return "balanced";
  if (
    !preferences.echoCancellation &&
    !preferences.noiseSuppression &&
    !preferences.autoGainControl
  ) return "studio";
  return "custom";
}

function preferencesForVoicePreset(
  current: AppPreferences,
  preset: VoicePreset,
): AppPreferences {
  if (preset === "studio") {
    return {
      ...current,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      noiseFilterStrength: "balanced",
      automaticInputSensitivity: false,
    };
  }
  return {
    ...current,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
    noiseFilterStrength: preset === "clear" ? "strong" : "balanced",
    automaticInputSensitivity: true,
  };
}

function processingStatusFor(
  track?: MediaStreamTrack | null,
  enhancedNoiseFilter = false,
): VoiceProcessingStatus {
  const settings = (track?.getSettings() || {}) as MediaTrackSettings & {
    voiceIsolation?: boolean;
  };
  return {
    echoCancellation: settings.echoCancellation === true,
    noiseSuppression: settings.noiseSuppression === true,
    autoGainControl: settings.autoGainControl === true,
    voiceIsolation: settings.voiceIsolation === true,
    enhancedNoiseFilter,
  };
}

async function disposeVoiceAudioPipeline(pipeline: VoiceAudioPipeline | null) {
  if (!pipeline) return;
  pipeline.rawStream.getTracks().forEach((track) => track.stop());
  pipeline.outputStream.getTracks().forEach((track) => track.stop());
  if (pipeline.context.state !== "closed") {
    await pipeline.context.close().catch(() => undefined);
  }
}

async function prepareVoiceInput(preferences: AppPreferences): Promise<PreparedVoiceInput> {
  const rawStream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraintsFor(preferences),
  });
  const rawTrack = rawStream.getAudioTracks()[0];
  if (!rawTrack) {
    rawStream.getTracks().forEach((track) => track.stop());
    throw new Error("Mikrofon ses yolu oluÅŸturulamadÄ±.");
  }
  rawTrack.contentHint = "speech";
  const nativeStatus = processingStatusFor(rawTrack);
  if (!preferences.noiseSuppression) {
    return { stream: rawStream, pipeline: null, status: nativeStatus };
  }

  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return { stream: rawStream, pipeline: null, status: nativeStatus };
  }

  let context: AudioContext | null = null;
  try {
    try {
      context = new AudioContextClass({ latencyHint: "interactive", sampleRate: 48_000 });
    } catch {
      context = new AudioContextClass({ latencyHint: "interactive" });
    }
    await context.resume();
    const source = context.createMediaStreamSource(rawStream);
    const highPass = context.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.setValueAtTime(105, context.currentTime);
    highPass.Q.setValueAtTime(0.72, context.currentTime);

    const lowPass = context.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.setValueAtTime(
      preferences.noiseFilterStrength === "strong" ? 8_500 : 10_500,
      context.currentTime,
    );
    lowPass.Q.setValueAtTime(0.68, context.currentTime);

    const presence = context.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.setValueAtTime(2_800, context.×;ß›h‘éì¶»§q«^v[OÈ‚ˆÏ‚ˆÛX™[‚ˆX™[‚ˆÕSS’PÒHQBˆ]ˆÛ\ÜÓ˜[YOH\Ù\›˜[YKYšY[Ü[ÜÜ[[œ]™\]Z\™YZ[“[™İ^ÌßHX^[™İ^ÌH]\›H–ØK^ŒNW×JÈˆ˜[YO^Ü™YÚ\İ˜][Û•\Ù\›˜[Y_HÛÚ[™ÙO^Ê]™[
HOˆÙ]™YÚ\İ˜][Û•\Ù\›˜[YJ]™[\™Ù]˜[YKÓØØ[SİÙ\Ø\ÙJ™[‹UTÈŠKœ™\XÙJÖ×˜K^ŒNW×KÙËˆŠJ_HÏÙ]‚ˆÛX[–X[±,^˜ØHğï0éğïÈ\™‹˜ZØ[H™H[0éÚ^™ÚKÜÛX[‚ˆÛX™[‚ˆÜ™YÚ\İ˜][Û‘\œ›Üˆ	‰ˆ]ˆÛ\ÜÓ˜[YOHœ™YÚ\İ˜][Û‹Y\œ›ÜˆÜ™YÚ\İ˜][Û‘\œ›ÜŸOÙ]ŸBˆ]ÛˆÛ\ÜÓ˜[YOHœ™YÚ\İ˜][Û‹\İX›Z]ˆ\ØX›Y^Ü™YÚ\İ˜][Û”İX›Z][™ßO‚ˆÜ™YÚ\İ˜][Û”İX›Z][™ÈÈ”›Ùš[[ˆÛqgİ\[^[Ü¸ )ˆˆˆ”›Ùš[HÛqgİ\ˆ™H]˜[H]ŸBˆØ]Û‚ˆÛ\ÜÓ˜[YOHœ™YÚ\İ˜][Û‹Y›Ûİ‘Ú^›[q'Ú[šH˜\ñ,[ÛÜYq'İ[]^HH™YH‹ÚZİZËÙÚ^›[ZÈˆ\™Ù]H—Ø›[šÈ‘Ú^›[ZÈÛ]ZØ\ñ,OØO›™H[›]1,^[Ü^‹Ü‚ˆÙ›Ü›O‚ˆÙ]‚ˆÙ]‚ˆ
_B‚ˆØÛÜQ˜[˜XÚÈ	‰ˆ
ˆ]ˆÛ\ÜÓ˜[YOH›[Ù[X˜XÚÙ›ÜÛÜKX˜XÚÙ›ÜˆÛ“[İ\ÙQİÛ^Ê
HOˆÙ]ÛÜQ˜[˜XÚÊ[
_O‚ˆÙXİ[Û‚ˆÛ\ÜÓ˜[YOH›[Ù[XØ\™ÛÜKY˜[˜XÚË[[Ù[‚ˆ›ÛOH™X[ÙÈ‚ˆ\šXK[[Ù[HYH‚ˆ\šXK[X™[YOH˜ÛÜKY˜[˜XÚË]]H‚ˆÛ“[İ\ÙQİÛ^Ê]™[
HOˆ]™[œİÜ›ÜYØ][ÛŠ
_BˆÛ’Ù^QİÛ^Ê]™[
HOˆÂˆYˆ
]™[šÙ^HOOH‘\ØØ\HŠHÙ]ÛÜQ˜[˜XÚÊ[
NÂˆ_Bˆ‚ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛ\ÜÓ˜[YOH›[Ù[XÛÜÙH‚ˆÛÛXÚÏ^Ê
HOˆÙ]ÛÜQ˜[˜XÚÊ[
_Bˆ\šXK[X™[H’Ø\]‚ˆ‚ˆ0åÂˆØ]Û‚ˆÜ[ˆÛ\ÜÓ˜[YOH™^YXœ›İÈ’ÓÔPSSPVPHV’TÜÜ[‚ˆˆYH˜ÛÜKY˜[˜XÚË]]HØÛÜQ˜[˜XÚË]_OÚ‚ˆØÛÜQ˜[˜XÚË™\ØÜš\[ÛŸOÜ‚ˆØÛÜQ˜[˜XÚË˜ÛÙH	‰ˆÛÜQ˜[˜XÚË˜ÛÙHOOHÛÜQ˜[˜XÚË˜[YH	‰ˆ
ˆ]ˆÛ\ÜÓ˜[YOH˜ÛÜKZ[š]KXÛÙH‚ˆÜ[‘U‘UÓÑOÜÜ[‚ˆİ›Û™ÏØÛÜQ˜[˜XÚË˜ÛÙ_OÜİ›Û™Ï‚ˆÙ]‚ˆ
_BˆX™[Û\ÜÓ˜[YOH˜ÛÜKY˜[˜XÚËYšY[‚ˆÜ[ØÛÜQ˜[˜XÚË›X™[OÜÜ[‚ˆ^\™XBˆ]]Ñ›Øİ\Âˆ™XYÛ›Bˆ›İÜÏ^ØÛÜQ˜[˜XÚË˜[YKš[˜ÛY\Ê—ˆŠHÈHˆßBˆ˜[YO^ØÛÜQ˜[˜XÚË˜[Y_BˆÛ‘›Øİ\Ï^Ê]™[
HOˆ]™[˜İ\œ™[\™Ù]œÙ[Xİ

_BˆÛÛXÚÏ^Ê]™[
HOˆ]™[˜İ\œ™[\™Ù]œÙ[Xİ

_Bˆ\šXK[X™[^ØÛÜQ˜[˜XÚË›X™[BˆÏ‚ˆÛX™[‚ˆÛX[Û\ÜÓ˜[YOH˜ÛÜKY˜[˜XÚËZ[‚ˆ[[±,HÙpéİZİ[ˆÛÛœ˜Hİ›
ĞÈİ[[˜Xš[\ˆ™^XHqgØq'ñ,YZÚH0ï1'ÛY^[HY[šY[ˆ[™^YXš[\œÚ[‹‚ˆÜÛX[‚ˆ]ˆÛ\ÜÓ˜[YOH˜ÛÜKY˜[˜XÚËXXİ[ÛœÈ‚ˆ]Ûˆ\OH˜]ÛˆˆÛÛXÚÏ^Ê
HOˆÙ]ÛÜQ˜[˜XÚÊ[
_O’Ø\]Ø]Û‚ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛ\ÜÓ˜[YOHœš[X\H‚ˆÛÛXÚÏ^Ø\Ş[˜È

HOˆÂˆYˆ
]ØZ]Üš]PÛ\›Ø\™^
ÛÜQ˜[˜XÚË˜[YJJHÂˆÙ]ÛÜQ˜[˜XÚÊ[
NÂˆÙ]Ø\İ
È^ˆ”[›ŞXHÛÜX[[™1,Kˆ‹Û™NˆœİXØÙ\ÜÈˆJNÂˆH[ÙHÂˆÙ]Ø\İ
Âˆ^ˆ”[›È^›šH0è›0èˆØ\[1,Kˆ[[ˆÙpéÚ[NÈİ›
ĞÈ[HÛÜX[^XXš[\œÚ[‹ˆ‹ˆJNÂˆBˆ_Bˆ‚ˆZÜ˜\ˆÛÜX[BˆØ]Û‚ˆÙ]‚ˆÜÙXİ[Û‚ˆÙ]‚ˆ
_B‚ˆØÛÛ^Y[H	‰ˆ
ˆ]‚ˆÛ\ÜÓ˜[YOH˜ÛÛ^[Y[H‚ˆİ[O^ŞÈYˆÛÛ^Y[KÜˆÛÛ^Y[KH_BˆÛ”Ú[\‘İÛ^Ê]™[
HOˆ]™[œİÜ›ÜYØ][ÛŠ
_BˆÛÛXÚÏ^Ê
HOˆÚ[™İËœÙ][Y[İ]


HOˆÙ]ÛÛ^Y[J[
K
_Bˆ›ÛOH›Y[H‚ˆ‚ˆØÛÛ^Y[KšÚ[™OOHœÙ\™\ˆˆ	‰ˆ
ˆ‚ˆÜ[ˆÛ\ÜÓ˜[YOH˜ÛÛ^]]HØXİ]™TÙ\™\‹›˜[Y_OÜÜ[‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÛÜR[š]J
_OÜ[¸¡¥ÏÜÜ[‘]™]Ûqgİ\Ø]Û‚ˆ]ÛˆÛÛXÚÏ^ÛÜ[‘]™[ßOÜ[¸¥êÏÜÜ[‘]Ú[›ZÛ\ˆ™HZİš[OØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÜ[”Ù\™\‘İZYJ
_OÜ[¸§$ÏÜÜ[˜qgÛ[™ñ,péÈ™Z™\šOØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÈÙ]™]ĞÚ[›™[Ú[™
^ŠNÈÙ][Ù[
˜Ú[›™[ŠNÈ_OÜ[ˆÏÜÜ[“Y][ˆØ[˜[1,HÛqgİ\Ø]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÈÙ]™]ĞÚ[›™[Ú[™
›ÚXÙHŠNÈÙ][Ù[
˜Ú[›™[ŠNÈ_OÜ[¸¥åÜÜ[”Ù\ÈØ[˜[1,HÛqgİ\Ø]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÜ[Ø]YÛÜQY]ÜŠ
_OÜ[¸¥¯ÜÜ[’Ø]YÛÜšHÛqgİ\Ø]Û‚ˆHÏ‚ˆ]ÛˆÛÛXÚÏ^ÛÜ[”›Û\ßOÜ[¸¦hÜÜ[”›Û\ˆ™HY]Ú[\Ø]Û‚ˆÛİÛœĞXİ]™TÙ\™\ˆ	‰ˆ
ˆ]ÛˆÛÛXÚÏ^ÛÜ[”Ù\™\”Ù][™ÜßOÜ[¸¦¦OÜÜ[•Ü[ZÈ^X\›\±,OØ]Û‚ˆ
_BˆÊ\›Z\ÜÚ[ÛœÈ	ˆŒÊHOOH	‰ˆ
ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÜ[]Y]ÙÊ
_OÜ[¸¥ãÜÜ[‘[™][HØ^Y1,OØ]Û‚ˆ
_BˆØØ[“X[˜YÙSY\ÜØYÙ\È	‰ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÜ[”™\ÜÊ
_OÜ[ˆOÜÜ[š[\š[Hİ^\q'İOØ]ÛŸBˆØØ[“X[˜YÙTÙ\™\ˆ	‰ˆ
ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÜ[]]Ó[Ù

_OÜ[¸£ OÜÜ[]]Ó[Ù^X\›\±,OØ]Û‚ˆ
_Bˆ]ÛˆÛÛXÚÏ^ÛÜ[]\˜_OÜ[¸§)ÜÜ[’İ^™[œÈ]\˜OØ]Û‚ˆÏ‚ˆ
_BˆØÛÛ^Y[KšÚ[™OOH˜Ø]YÛÜHˆ	‰ˆÛÛ^Y[K˜Ø]YÛÜH	‰ˆ
ˆ‚ˆÜ[ˆÛ\ÜÓ˜[YOH˜ÛÛ^]]HØÛÛ^Y[K˜Ø]YÛÜK›˜[Y_OÜÜ[‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÈÙ]™]ĞÚ[›™[Ø]YÛÜRY
ÛÛ^Y[K˜Ø]YÛÜHKšY
NÈÙ][Ù[
˜Ú[›™[ŠNÈ_OÜ[»ï"ÏÜÜ[“ÙHÛqgİ\Ø]Û‚ˆØØ[“X[˜YÙPÚ[›™[È	‰ˆ
ˆ‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÜ[Ø]YÛÜQY]ÜŠÛÛ^Y[K˜Ø]YÛÜHJ_OÜ[¸§#ÜÜ[’Ø]YÛÜš^ZH0ï™[›OØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYŞ[˜ĞØ]YÛÜT\›Z\ÜÚ[ÛœÊÛÛ^Y[K˜Ø]YÛÜHJ_OÜ[¸¦hÜÜ[±,š[›\šHÙ[šÜ›Ûš^™H]Ø]Û‚ˆ]ÛˆÛ\ÜÓ˜[YOH™[™Ù\ˆˆÛÛXÚÏ^Ê
HOˆ›ÚY[]PØ]YÛÜJÛÛ^Y[K˜Ø]YÛÜHJ_OÜ[°åÏÜÜ[’Ø]YÛÜš^ZHÚ[Ø]Û‚ˆÏ‚ˆ
_BˆÏ‚ˆ
_BˆØÛÛ^Y[KšÚ[™OOH˜Ú[›™[ˆ	‰ˆÛÛ^Y[K˜Ú[›™[	‰ˆ
ˆ‚ˆÜ[ˆÛ\ÜÓ˜[YOH˜ÛÛ^]]HˆŞØÛÛ^Y[K˜Ú[›™[›˜[Y_OÜÜ[‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÙÙÛQ˜]›Üš]PÚ[›™[
ÛÛ^Y[K˜Ú[›™[J_OÜ[¸¦!OÜÜ[Ù˜]›Üš]PÚ[›™[YËš\ÊÛÛ^Y[K˜Ú[›™[šY
HÈ‘˜]›Üš[\™[ˆ0éñ,ZØ\ˆˆˆ‘˜]›Üš[\™HZÛHŸOØ]Û‚ˆØÛÛ^Y[K˜Ú[›™[šÚ[™OOH›ÚXÙHˆ	‰ˆ
ˆ‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÈ›ÚYX\šĞÚ[›™[™XY
ÛÛ^Y[K˜Ú[›™[JNÈÙ]Ø\İ
È^ˆ’Ø[˜[Úİ[™HqgØ\™][™Kˆ‹Û™NˆœİXØÙ\ÜÈˆJNÈ_OÜ[¸§$ÏÜÜ[“Úİ[™HqgØ\™]OØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÜ[Ú[›™[›İYšXØ][ÛœÊÛÛ^Y[K˜Ú[›™[J_OÜ[¸¦hÜÜ[š[\š[H^X\›\±,OØ]Û‚ˆÏ‚ˆ
_Bˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÛÜR[š]J
_OÜ[¸¡¥ÏÜÜ[‘]™]Ûqgİ\Ø]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÛÜU^
ˆ	İÚ[™İË›ØØ][Û‹›ÜšYÚ[ŸKÏÜİ[XİOIØXİ]™TÙ\™\’YIšØ[˜[IØÛÛ^Y[K˜Ú[›™[KšYXˆ’Ø[˜[˜q'Û[1,\ñ,HÛÜX[[™1,Kˆ‹ˆÂˆ]Nˆ’Ø[˜[˜q'Û[1,\ñ,H^±,\ˆ‹ˆ\ØÜš\[Ûˆ˜q'Û[1,^XHÚİ[\İ›
ĞÈ[HÛÜX[^XXš[\œÚ[‹ˆ‹ˆX™[ˆ’ĞSSq'“S•TÒH‹ˆKˆ
_OÜ[¸¦äÏÜÜ[˜q'Û[1,^q,HÛÜX[OØ]Û‚ˆØØ[“X[˜YÙPÚ[›™[È	‰ˆ
ˆ‚ˆHÏ‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÜ[Ú[›™[Ù][™ÜÊÛÛ^Y[K˜Ú[›™[J_OÜ[¸¦¦OÜÜ[’Ø[˜[1,H0ï™[›OØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚY™[Ü™\Ú[›™[
ÛÛ^Y[K˜Ú[›™[KLJ_OÜ[¸¡¤OÜÜ[–]ZØ\±,Hqgñ,OØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚY™[Ü™\Ú[›™[
ÛÛ^Y[K˜Ú[›™[KJ_OÜ[¸¡¤ÏÜÜ[qgØq'ñ,Hqgñ,OØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚY\XØ]PÚ[›™[
ÛÛ^Y[K˜Ú[›™[J_OÜ[»ï"ÏÜÜ[’Ø[˜[1,H0éÛñ'Ø[Ø]Û‚ˆØÛÛ^Y[K˜Ú[›™[šYOOH™Ù[™[ˆ	‰ˆXÛÛ^Y[K˜Ú[›™[šY™[™ÕÚ]
™Ù[™[ŠH	‰ˆ
ˆ]ÛˆÛ\ÜÓ˜[YOH™[™Ù\ˆˆÛÛXÚÏ^Ê
HOˆ›ÚY[]PÚ[›™[
ÛÛ^Y[K˜Ú[›™[
_OÜ[°åÏÜÜ[’Ø[˜[1,HÚ[Ø]Û‚ˆ
_BˆÏ‚ˆ
_BˆÏ‚ˆ
_BˆØÛÛ^Y[KšÚ[™OOH›Y\ÜØYÙHˆ	‰ˆÛÛ^Y[K›Y\ÜØYÙH	‰ˆ
ˆ‚ˆÜ[ˆÛ\ÜÓ˜[YOH˜ÛÛ^]]HØÛÛ^Y[K›Y\ÜØYÙK˜]]Ü“˜[Y_OÜÜ[‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÙ]™\Z[™ÕÊÛÛ^Y[K›Y\ÜØYÙHJ_OÜ[¸¡ªOÜÜ[–X[±,]OØ]Û‚ˆØÛÛ^Y[K›Y\ÜØYÙK™XYÈ
ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÜ[•™XY
ÛÛ^Y[K›Y\ÜØYÙHK™XYKšY
_OÜ[¸¡¬ÏÜÜ[’ÛÛH˜qgÛ1,q'ñ,[±,HpéÏØ]Û‚ˆ
Hˆ
ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÜ™X]U™XY
ÛÛ^Y[K›Y\ÜØYÙHJ_OÜ[»ï"ÏÜÜ[’ÛÛH˜qgÛ1,q'ñ,HÛqgİ\Ø]Û‚ˆ
_Bˆ]ˆÛ\ÜÓ˜[YOH˜ÛÛ^\™XXİ[ÛœÈ‚ˆÖÈ¼'äcH‹¸§i;î#È‹¼'æ ˆ‹¼'æ+ˆ‹¼'å)H—K›X\

[[ÚšJHOˆ
ˆ]ÛˆÙ^O^Ù[[Úš_HÛÛXÚÏ^Ê
HOˆ›ÚYÙÙÛT™XXİ[ÛŠÛÛ^Y[K›Y\ÜØYÙHK[[ÚšJ_OÙ[[Úš_OØ]Û‚ˆ
J_BˆÙ]‚ˆØØ[“X[˜YÙSY\ÜØYÙ\È	‰ˆ
ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÙÙÛT[ŠÛÛ^Y[K›Y\ÜØYÙHJ_OÜ[¸£%ÜÜ[ØÛÛ^Y[K›Y\ÜØYÙKœ[›™YÈ”ØXš][Y^ZHØ[1,\ˆˆˆ“Y\ØZ±,HØXš]HŸOØ]Û‚ˆ
_BˆÊÛÛ^Y[K›Y\ÜØYÙK˜]]Ü”›Ùš[RYOOH›Ùš[OËšYˆÛÛ^Y[K›Y\ÜØYÙK˜]]Ü•YÈOOH	Ü›Ùš[OË\Ù\›˜[Y_X
H	‰ˆ
ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYY]Y\ÜØYÙJÛÛ^Y[K›Y\ÜØYÙHJ_OÜ[¸§#ÜÜ[“Y\ØZ±,H0ï™[›OØ]Û‚ˆ
_BˆHÏ‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÛÜU^
ˆÛÛ^Y[K›Y\ÜØYÙHK˜ÛÛ[ˆ“Y\ØZˆY]šHÛÜX[[™1,Kˆ‹ˆÂˆ]Nˆ“Y\ØZˆY]šH^±,\ˆ‹ˆ\ØÜš\[Ûˆ“Y]™HÚİ[\İ›
ĞÈ[HÛÜX[^XXš[\œÚ[‹ˆ‹ˆX™[ˆ“QTĞRˆQU±,‹ˆKˆ
_OÜ[¸¥¨ÏÜÜ[“Y]šHÛÜX[OØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYÛÜSY\ÜØYÙS[šÊÛÛ^Y[K›Y\ÜØYÙHJ_OÜ[¸¦äÏÜÜ[“Y\ØZˆ˜q'Û[1,\ñ,[±,HÛÜX[OØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚY›ÜØ\™Y\ÜØYÙJÛÛ^Y[K›Y\ÜØYÙHJ_OÜ[¸¡¥ÏÜÜ[“Y\ØZ±,H[]Ø]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYØ]™P›ÛÚÛX\šÊÛÛ^Y[K›Y\ÜØYÙHJ_OÜ[¸¦!ÜÜ[”ÛÛœ˜HpéÚ[ˆØ^Y]Ø]Û‚ˆØÛÛ^Y[K›Y\ÜØYÙK˜]]Ü”›Ùš[RYOOH›Ùš[OËšY	‰ˆ
ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚY™\ÜÛÛ[
›Y\ÜØYÙH‹ÛÛ^Y[K›Y\ÜØYÙHKšY
_OÜ[ˆOÜÜ[“Y\ØZ±,Hš[\Ø]Û‚ˆ
_BˆÊØ[“X[˜YÙSY\ÜØYÙ\ÈˆÛÛ^Y[K›Y\ÜØYÙK˜]]Ü”›Ùš[RYOOH›Ùš[OËšYˆÛÛ^Y[K›Y\ÜØYÙK˜]]Ü•YÈOOH	Ü›Ùš[OË\Ù\›˜[Y_X
H	‰ˆ
ˆ]ÛˆÛ\ÜÓ˜[YOH™[™Ù\ˆˆÛÛXÚÏ^Ê
HOˆ›ÚY[]SY\ÜØYÙJÛÛ^Y[K›Y\ÜØYÙHJ_OÜ[°åÏÜÜ[“Y\ØZ±,HÚ[Ø]Û‚ˆ
_BˆÏ‚ˆ
_BˆØÛÛ^Y[KšÚ[™OOH›Y[X™\ˆˆ	‰ˆÛÛ^Y[K›Y[X™\ˆ	‰ˆ
ˆ‚ˆ]ˆÛ\ÜÓ˜[YOH˜ÛÛ^[Y[X™\ˆ‚ˆ]˜]\ˆ˜[YO^ØÛÛ^Y[K›Y[X™\‹›˜[Y_HÛ™O^İÛ™Q›ÜŠÛÛ^Y[K›Y[X™\‹šY
_HÚ^™OHœÛHˆ[XYÙU\›^ØÛÛ^Y[K›Y[X™\‹˜]˜]\•\›Hİ]\Ï^ØÛÛ^Y[K›Y[X™\‹œ™\Ù[˜ÙTİ]\È
ÛÛ^Y[K›Y[X™\‹›Û›[™HÈ›Û›[™Hˆˆ›Ù™›[™HŠ_HÏ‚ˆÜ[İ›Û™ÏØÛÛ^Y[K›Y[X™\‹›˜[Y_OÜİ›Û™ÏÛX[ØÛÛ^Y[K›Y[X™\‹YßOÜÛX[ÜÜ[‚ˆÙ]‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÈÙ]šY]Ú[™ÓY[X™\ŠÛÛ^Y[K›Y[X™\ˆJNÈÙ][Ù[
›Y[X™\”›Ùš[HŠNÈ_OÜ[¸¥âOÜÜ[”›Ùš[Hğíœ°ï0ïOØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ[œÙ\Y[[ÛŠÛÛ^Y[K›Y[X™\ˆKYÊ_OÜ[ÜÜ[˜ZÙ]Ø]Û‚ˆØØ[“X[˜YÙT›Û\È	‰ˆ
ˆ]ÛˆÛÛXÚÏ^ÛÜ[”›Û\ßOÜ[¸¦hÜÜ[”›Û0ï°ï0ï™[›OØ]Û‚ˆ
_BˆØÛÛ^Y[K›Y[X™\‹šYOOH›Ùš[OËšY	‰ˆ
ˆ‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYİ\\™XİY\ÜØYÙJÛÛ^Y[K›Y[X™\ˆJ_OÜ[¸§"OÜÜ[“Y\ØZˆğí›™\Ø]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚY™\]Y\İœšY[™
ÛÛ^Y[K›Y[X™\ˆJ_OÜ[»ï"ÏÜÜ[\šØYqgÈZÛOØ]Û‚ˆ]ÛˆÛ\ÜÓ˜[YOH™[™Ù\ˆˆÛÛXÚÏ^Ê
HOˆ›ÚYœšY[™Xİ[ÛŠ˜›ØÚÈ‹ÛÛ^Y[K›Y[X™\ˆKšY
_OÜ[¸¢¦ÜÜ[‘[™Ù[OØ]Û‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚY™\ÜÛÛ[
œ›Ùš[H‹ÛÛ^Y[K›Y[X™\ˆKšY
_OÜ[ˆOÜÜ[’İ[[±,Xñ,^q,Hš[\Ø]Û‚ˆÏ‚ˆ
_BˆÊØ[’ÚXÚÓY[X™\œÈØ[˜[“Y[X™\œÊH	‰‚ˆÛÛ^Y[K›Y[X™\‹šYOOH›Ùš[OËšY	‰‚ˆXÛÛ^Y[K›Y[X™\‹œ›ÛOËšY™[™ÕÚ]
›İÛ™\ˆŠH	‰ˆ
ˆ‚ˆHÏ‚ˆØØ[’ÚXÚÓY[X™\œÈ	‰ˆ]ÛˆÛ\ÜÓ˜[YOH™[™Ù\ˆˆÛÛXÚÏ^Ê
HOˆ›ÚY[Ù\˜]SY[X™\ŠÛÛ^Y[K›Y[X™\ˆKšÚXÚÈŠ_OÜ[¸¡¥ÏÜÜ[•Ü[Zİ[ˆ0éñ,ZØ\Ø]ÛŸBˆØØ[’ÚXÚÓY[X™\œÈ	‰ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYY[X™\ÛÛ›Û
ÛÛ^Y[K›Y[X™\ˆK[Y[İ]Š_OÜ[¸¥íÏÜÜ[•[Y[İ]^Yİ[OØ]ÛŸBˆØØ[’ÚXÚÓY[X™\œÈ	‰ˆÛÛ^Y[K›Y[X™\‹›ÚXÙPÚ[›™[Y	‰ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYY[X™\ÛÛ›Û
ÛÛ^Y[K›Y[X™\ˆK›ÚXÙQ\ØÛÛ›™XİŠ_OÜ[¸¥åÜÜ[”Ù\İ[ˆ0éñ,ZØ\Ø]ÛŸBˆØØ[’ÚXÚÓY[X™\œÈ	‰ˆÛÛ^Y[K›Y[X™\‹›ÚXÙPÚ[›™[Y	‰ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYY[X™\ÛÛ›Û
ÛÛ^Y[K›Y[X™\ˆKœÙ\™\“]]HŠ_OÜ[³¯ÜÜ[ØÛÛ^Y[K›Y[X™\‹œÙ\™\“]]YÈ”İ[XİHİ\İ\›X\ñ,[±,HØ[1,\ˆˆˆ”İ[XİYHİ\İ\ˆŸOØ]ÛŸBˆØØ[“X[˜YÙT›Û\È	‰ˆ]ÛˆÛÛXÚÏ^Ê
HOˆ›ÚYY[X™\ÛÛ›Û
ÛÛ^Y[K›Y[X™\ˆK›šXÚÛ˜[YHŠ_OÜ[¸§#ÜÜ[•ZÛXHY1,H0ï™[›OØ]ÛŸBˆØØ[˜[“Y[X™\œÈ	‰ˆ]ÛˆÛ\ÜÓ˜[YOH™[™Ù\ˆˆÛÛXÚÏ^Ê
HOˆ›ÚY[Ù\˜]SY[X™\ŠÛÛ^Y[K›Y[X™\ˆK˜˜[ˆŠ_OÜ[ˆOÜÜ[–X\ØZÛOØ]ÛŸBˆÏ‚ˆ
_BˆÏ‚ˆ
_BˆÙ]‚ˆ
_B‚ˆİØ\İ	‰ˆ
ˆ]‚ˆÛ\ÜÓ˜[YO^ØØ\İ	İØ\İÛ™HˆŸXBˆ›ÛO^İØ\İÛ™HOOH™[™Ù\ˆˆÈ˜[\ˆˆœİ]\ÈŸBˆ\šXK[]™O^İØ\İÛ™HOOH™[™Ù\ˆˆÈ˜\ÜÙ\]™HˆˆœÛ]HŸBˆ‚ˆÜ[ˆ\šXKZY[HYHİØ\İÛ™HOOHœİXØÙ\ÜÈˆÈ¸§$ÈˆˆØ\İÛ™HOOH™[™Ù\ˆˆÈˆHˆˆšHŸOÜÜ[‚ˆİØ\İ^BˆÙ]‚ˆ
_BˆÛXZ[‚ˆ
NÂŸB