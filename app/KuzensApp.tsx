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
    throw new Error("Mikrofon ses yolu oluşturulamadı.");
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
    presence.frequency.setValueAtTime(2_800, context.currentTime);
    presence.Q.setValueAtTime(0.8, context.currentTime);
    presence.gain.setValueAtTime(1.4, context.currentTime);

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-20, context.currentTime);
    compressor.knee.setValueAtTime(14, context.currentTime);
    compressor.ratio.setValueAtTime(2.4, context.currentTime);
    compressor.attack.setValueAtTime(0.008, context.currentTime);
    compressor.release.setValueAtTime(0.14, context.currentTime);
    const destination = context.createMediaStreamDestination();

    source.connect(highPass);
    highPass.connect(lowPass);
    let tail: AudioNode = lowPass;
    if (context.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      await context.audioWorklet.addModule("/audio/kuzens-noise-gate.js");
      const manualThreshold = Math.pow(10, preferences.inputSensitivityDb / 20);
      const gate = new AudioWorkletNode(context, "kuzens-noise-gate", {
        parameterData: {
          threshold: preferences.automaticInputSensitivity
            ? preferences.noiseFilterStrength === "strong" ? 0.004 : 0.003
            : manualThreshold,
          floor: preferences.noiseFilterStrength === "strong" ? 0.004 : 0.025,
          adaptive: preferences.automaticInputSensitivity ? 1 : 0,
          noiseMultiplier: preferences.noiseFilterStrength === "strong" ? 2.7 : 2.05,
        },
      });
      tail.connect(gate);
      tail = gate;
    }
    tail.connect(presence);
    presence.connect(compressor);
    compressor.connect(destination);

    const outputTrack = destination.stream.getAudioTracks()[0];
    if (!outputTrack) throw new Error("İşlenmiş mikrofon yolu oluşturulamadı.");
    outputTrack.contentHint = "speech";
    const outputStream = new MediaStream([outputTrack]);
    return {
      stream: outputStream,
      pipeline: { rawStream, outputStream, context },
      status: processingStatusFor(rawTrack, true),
    };
  } catch {
    if (context && context.state !== "closed") await context.close().catch(() => undefined);
    return { stream: rawStream, pipeline: null, status: nativeStatus };
  }
}

async function configureAudioSender(sender: RTCRtpSender, bitrate: number) {
  try {
    const parameters = sender.getParameters();
    if (!parameters.encodings.length) parameters.encodings = [{}];
    parameters.encodings[0].maxBitrate = Math.max(24_000, Math.min(384_000, bitrate));
    await sender.setParameters(parameters);
  } catch {
    // Some WebRTC engines lock encoding parameters; Opus remains the browser fallback.
  }
}

type ContextMenuState = {
  x: number;
  y: number;
  kind: "server" | "category" | "channel" | "message" | "member";
  category?: ChannelCategory;
  channel?: Channel;
  message?: ChatMessage;
  member?: Member;
};

const permissionOptions = [
  { bit: 1, label: "Sunucuyu yönet", detail: "Sunucu adı ve genel ayarları" },
  { bit: 2, label: "Odaları yönet", detail: "Oda oluşturma, düzenleme ve silme" },
  { bit: 4, label: "Rolleri yönet", detail: "Rol ve üye yetkilerini değiştirme" },
  { bit: 8, label: "Mesajları yönet", detail: "Mesaj silme ve sabitleme" },
  { bit: 16, label: "Üyeleri uzaklaştır", detail: "Üyeyi sunucudan çıkarma" },
  { bit: 32, label: "Üyeleri yasakla", detail: "Kalıcı erişim engeli uygulama" },
  { bit: 64, label: "Ses odalarına katıl", detail: "Sesli odalara bağlanma" },
  { bit: 128, label: "Ekran paylaş", detail: "Ses odasında ekran yayını açma" },
  { bit: 256, label: "Odaları gör", detail: "İzin verilen metin ve ses odalarını görüntüleme" },
  { bit: 512, label: "Mesaj gönder", detail: "Metin odalarında mesaj, anket ve yanıt gönderme" },
  { bit: 1024, label: "Sesli konuş", detail: "Katıldığı ses odasında mikrofon kullanma" },
];

const channelPermissionOptions = [
  { bit: 256, label: "Odayı gör", kinds: ["text", "voice", "forum", "announcement"] as const },
  { bit: 512, label: "Mesaj gönder", kinds: ["text", "voice", "forum", "announcement"] as const },
  { bit: 64, label: "Odaya katıl", kinds: ["voice"] as const },
  { bit: 1024, label: "Konuş", kinds: ["voice"] as const },
  { bit: 128, label: "Ekran paylaş", kinds: ["voice"] as const },
];

const memberTones = ["purple", "pink", "blue", "orange", "green"];

function toneFor(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return memberTones[hash % memberTones.length];
}

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("x-kuzens-request", "1");
  }
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}

async function responseError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

async function writeClipboardText(value: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Some browsers and desktop shells deny the async clipboard permission.
      // Keep going so the user can still copy through the local selection fallback.
    }
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.readOnly = true;
  field.setAttribute("aria-hidden", "true");
  field.style.position = "fixed";
  field.style.inset = "-1000px auto auto -1000px";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.focus({ preventScroll: true });
  field.select();
  field.setSelectionRange(0, value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

function readLocalDrafts(storageKey: string) {
  const drafts: Record<string, string> = {};
  if (!storageKey) return drafts;
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return drafts;
    for (const [key, value] of Object.entries(parsed).slice(0, 250)) {
      if (
        typeof value === "string" &&
        value.length <= 2_000 &&
        /^(channel|direct|thread):/.test(key)
      ) {
        drafts[key] = value;
      }
    }
  } catch {
    // Corrupt local preferences should never prevent the application from opening.
  }
  return drafts;
}

function writeLocalDrafts(storageKey: string, drafts: Record<string, string>) {
  if (!s