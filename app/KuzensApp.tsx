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
  if (!["GET", "HEAD", "OPTI…103566 tokens truncated… </div>
            ) : (
              <div className="bookmark-empty">
                <span>☆</span>
                <strong>Henüz kayıtlı mesaj yok</strong>
                <p>Bir mesaja sağ tıklayıp “Sonra için kaydet” seçeneğini kullan.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {modal === "notifications" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card notifications-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">GELEN KUTUSU</span>
            <h2>Bahsetmeler ve yanıtlar</h2>
            <p>Yalnızca sana hedeflenen bildirimler burada görünür.</p>
            <div className="notification-tabs">
              {(["all", "mentions", "replies"] as const).map((tab) => (
                <button key={tab} className={notificationTab === tab ? "active" : ""} onClick={() => setNotificationTab(tab)}>
                  {tab === "all" ? "Tümü" : tab === "mentions" ? "Bahsetmeler" : "Yanıtlar"}
                </button>
              ))}
              <button onClick={() => void enableBrowserNotifications()}>Masaüstü bildirimi</button>
            </div>
            <div className="notification-list">
              {notifications.filter((notification) => notificationTab === "all" || (notificationTab === "replies" ? notification.kind === "reply" : notification.kind !== "reply")).length ? (
                notifications
                  .filter((notification) => notificationTab === "all" || (notificationTab === "replies" ? notification.kind === "reply" : notification.kind !== "reply"))
                  .map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => void openNotification(notification)}
                  >
                    <span className="notification-avatar">{initials(notification.authorName)}</span>
                    <span>
                      <strong>{notification.authorName}</strong>
                      <small>{notification.kind === "reply" ? "YANIT" : notification.kind === "role" ? "ROL ETİKETİ" : notification.kind === "everyone" ? "TOPLU ETİKET" : "BAHSETME"} · {notification.serverName} · #{notification.channelName}</small>
                      <p>{notification.content}</p>
                    </span>
                    <time>{timeLabel(notification.createdAt)}</time>
                  </button>
                ))
              ) : (
                <div className="empty-search">
                  <span>✓</span>
                  <strong>Hepsini okudun</strong>
                  <p>Yeni bir bahsetme olduğunda burada göreceksin.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {profile === undefined && (
        <div className="registration-gate loading">
          <div className="registration-loader"><span>KZ</span><p>Hesabın hazırlanıyor…</p></div>
        </div>
      )}

      {profile === null && (
        <div className="registration-gate">
          <div className="registration-card">
            <aside className="registration-brand">
              <span className="registration-logo">KZ</span>
              <div>
                <span className="eyebrow">KUZENS’E HOŞ GELDİN</span>
                <h2>Birlikte kalmanın en kolay yolu.</h2>
                <p>Bir hesap, tüm odaların ve toplulukların için yeterli.</p>
              </div>
              <ul>
                <li><i>1</i> Adını ve kullanıcı adını seç</li>
                <li><i>2</i> Açık kuralları incele</li>
                <li><i>3</i> Sohbete hemen katıl</li>
              </ul>
            </aside>
            <form className="registration-form" onSubmit={registerProfile}>
              <div className="registration-title">
                <span>PROFİLİNİ TAMAMLA</span>
                <h1>Kuzens’te nasıl görüneceksin?</h1>
                <p>E-postan doğrulandı. Şimdi görünen adını ve benzersiz kullanıcı adını seç.</p>
              </div>
              <div className="registration-trust">
                <span>✓</span>
                <div>
                  <strong>Doğrulanmış kimlik oturumu</strong>
                  <small>Şifren güvenli kimlik sağlayıcısında korunur ve Kuzens veritabanına yazılmaz.</small>
                </div>
              </div>
              <label>
                GÖRÜNEN AD
                <input
                  required
                  minLength={2}
                  maxLength={32}
                  value={registrationName}
                  onChange={(event) => setRegistrationName(event.target.value)}
                  placeholder="Sana nasıl hitap edelim?"
                />
              </label>
              <label>
                KULLANICI ADI
                <div className="username-field"><span>@</span><input required minLength={3} maxLength={24} pattern="[a-z0-9_]+" value={registrationUsername} onChange={(event) => setRegistrationUsername(event.target.value.toLocaleLowerCase("en-US").replace(/[^a-z0-9_]/g, ""))} /></div>
                <small>Yalnızca küçük harf, rakam ve alt çizgi.</small>
              </label>
              {registrationError && <div className="registration-error">{registrationError}</div>}
              <button className="registration-submit" disabled={registrationSubmitting}>
                {registrationSubmitting ? "Profilin oluşturuluyor…" : "Profili oluştur ve devam et"}
              </button>
              <p className="registration-foot">Gizliliğini nasıl koruduğumuzu <a href="/hukuk/gizlilik" target="_blank">Gizlilik Politikası</a>nda anlatıyoruz.</p>
            </form>
          </div>
        </div>
      )}

      {copyFallback && (
        <div className="modal-backdrop copy-backdrop" onMouseDown={() => setCopyFallback(null)}>
          <section
            className="modal-card copy-fallback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="copy-fallback-title"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") setCopyFallback(null);
            }}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setCopyFallback(null)}
              aria-label="Kapat"
            >
              ×
            </button>
            <span className="eyebrow">KOPYALAMAYA HAZIR</span>
            <h2 id="copy-fallback-title">{copyFallback.title}</h2>
            <p>{copyFallback.description}</p>
            {copyFallback.code && copyFallback.code !== copyFallback.value && (
              <div className="copy-invite-code">
                <span>DAVET KODU</span>
                <strong>{copyFallback.code}</strong>
              </div>
            )}
            <label className="copy-fallback-field">
              <span>{copyFallback.label}</span>
              <textarea
                autoFocus
                readOnly
                rows={copyFallback.value.includes("\n") ? 5 : 3}
                value={copyFallback.value}
                onFocus={(event) => event.currentTarget.select()}
                onClick={(event) => event.currentTarget.select()}
                aria-label={copyFallback.label}
              />
            </label>
            <small className="copy-fallback-help">
              Alanı seçtikten sonra Ctrl+C kullanabilir veya aşağıdaki düğmeyle yeniden deneyebilirsin.
            </small>
            <div className="copy-fallback-actions">
              <button type="button" onClick={() => setCopyFallback(null)}>Kapat</button>
              <button
                type="button"
                className="primary"
                onClick={async () => {
                  if (await writeClipboardText(copyFallback.value)) {
                    setCopyFallback(null);
                    setToast({ text: "Panoya kopyalandı.", tone: "success" });
                  } else {
                    setToast({
                      text: "Pano izni hâlâ kapalı. Alan seçili; Ctrl+C ile kopyalayabilirsin.",
                    });
                  }
                }}
              >
                Tekrar kopyala
              </button>
            </div>
          </section>
        </div>
      )}

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => window.setTimeout(() => setContextMenu(null), 0)}
          role="menu"
        >
          {contextMenu.kind === "server" && (
            <>
              <span className="context-title">{activeServer.name}</span>
              <button onClick={() => void copyInvite()}><span>↗</span>Davet oluştur</button>
              <button onClick={openEvents}><span>◫</span>Etkinlikler ve takvim</button>
              <button onClick={() => void openServerGuide()}><span>✓</span>Başlangıç rehberi</button>
              <button onClick={() => { setNewChannelKind("text"); setModal("channel"); }}><span>#</span>Metin kanalı oluştur</button>
              <button onClick={() => { setNewChannelKind("voice"); setModal("channel"); }}><span>◖</span>Ses kanalı oluştur</button>
              <button onClick={() => openCategoryEditor()}><span>▾</span>Kategori oluştur</button>
              <i />
              <button onClick={openRoles}><span>♢</span>Roller ve yetkiler</button>
              {ownsActiveServer && (
                <button onClick={openServerSettings}><span>⚙</span>Topluluk ayarları</button>
              )}
              {(permissions & 63) !== 0 && (
                <button onClick={() => void openAuditLog()}><span>◎</span>Denetim kaydı</button>
              )}
              {canManageMessages && <button onClick={() => void openReports()}><span>!</span>Bildirim kuyruğu</button>}
              {canManageServer && (
                <button onClick={() => void openAutoMod()}><span>⌁</span>AutoMod ayarları</button>
              )}
              <button onClick={openAura}><span>✦</span>Kuzens Aura</button>
            </>
          )}
          {contextMenu.kind === "category" && contextMenu.category && (
            <>
              <span className="context-title">{contextMenu.category.name}</span>
              <button onClick={() => { setNewChannelCategoryId(contextMenu.category!.id); setModal("channel"); }}><span>＋</span>Oda oluştur</button>
              {canManageChannels && (
                <>
                  <button onClick={() => openCategoryEditor(contextMenu.category!)}><span>✎</span>Kategoriyi düzenle</button>
                  <button onClick={() => void syncCategoryPermissions(contextMenu.category!)}><span>♢</span>İzinleri senkronize et</button>
                  <button className="danger" onClick={() => void deleteCategory(contextMenu.category!)}><span>×</span>Kategoriyi sil</button>
                </>
              )}
            </>
          )}
          {contextMenu.kind === "channel" && contextMenu.channel && (
            <>
              <span className="context-title">#{contextMenu.channel.name}</span>
              <button onClick={() => toggleFavoriteChannel(contextMenu.channel!)}><span>★</span>{favoriteChannelIds.has(contextMenu.channel.id) ? "Favorilerden çıkar" : "Favorilere ekle"}</button>
              {contextMenu.channel.kind !== "voice" && (
                <>
                  <button onClick={() => { void markChannelRead(contextMenu.channel!); setToast({ text: "Kanal okundu işaretlendi.", tone: "success" }); }}><span>✓</span>Okundu işaretle</button>
                  <button onClick={() => openChannelNotifications(contextMenu.channel!)}><span>♢</span>Bildirim ayarları</button>
                </>
              )}
              <button onClick={() => void copyInvite()}><span>↗</span>Davet oluştur</button>
              <button onClick={() => void copyText(
                `${window.location.origin}/?sunucu=${activeServerId}&kanal=${contextMenu.channel!.id}`,
                "Kanal bağlantısı kopyalandı.",
                {
                  title: "Kanal bağlantısı hazır",
                  description: "Bağlantıya dokunup Ctrl+C ile kopyalayabilirsin.",
                  label: "KANAL BAĞLANTISI",
                },
              )}><span>⛓</span>Bağlantıyı kopyala</button>
              {canManageChannels && (
                <>
                  <i />
                  <button onClick={() => openChannelSettings(contextMenu.channel!)}><span>⚙</span>Kanalı düzenle</button>
                  <button onClick={() => void reorderChannel(contextMenu.channel!, -1)}><span>↑</span>Yukarı taşı</button>
                  <button onClick={() => void reorderChannel(contextMenu.channel!, 1)}><span>↓</span>Aşağı taşı</button>
                  <button onClick={() => void duplicateChannel(contextMenu.channel!)}><span>＋</span>Kanalı çoğalt</button>
                  {contextMenu.channel.id !== "genel" && !contextMenu.channel.id.endsWith(":genel") && (
                    <button className="danger" onClick={() => void deleteChannel(contextMenu.channel)}><span>×</span>Kanalı sil</button>
                  )}
                </>
              )}
            </>
          )}
          {contextMenu.kind === "message" && contextMenu.message && (
            <>
              <span className="context-title">{contextMenu.message.authorName}</span>
              <button onClick={() => setReplyingTo(contextMenu.message!)}><span>↩</span>Yanıtla</button>
              {contextMenu.message.thread ? (
                <button onClick={() => void openThread(contextMenu.message!.thread!.id)}><span>↳</span>Konu başlığını aç</button>
              ) : (
                <button onClick={() => void createThread(contextMenu.message!)}><span>＋</span>Konu başlığı oluştur</button>
              )}
              <div className="context-reactions">
                {["👍", "❤️", "😂", "😮", "🔥"].map((emoji) => (
                  <button key={emoji} onClick={() => void toggleReaction(contextMenu.message!, emoji)}>{emoji}</button>
                ))}
              </div>
              {canManageMessages && (
                <button onClick={() => void togglePin(contextMenu.message!)}><span>⌖</span>{contextMenu.message.pinned ? "Sabitlemeyi kaldır" : "Mesajı sabitle"}</button>
              )}
              {(contextMenu.message.authorProfileId === profile?.id ||
                contextMenu.message.authorTag === `@${profile?.username}`) && (
                <button onClick={() => void editMessage(contextMenu.message!)}><span>✎</span>Mesajı düzenle</button>
              )}
              <i />
              <button onClick={() => void copyText(
                contextMenu.message!.content,
                "Mesaj metni kopyalandı.",
                {
                  title: "Mesaj metni hazır",
                  description: "Metne dokunup Ctrl+C ile kopyalayabilirsin.",
                  label: "MESAJ METNİ",
                },
              )}><span>▣</span>Metni kopyala</button>
              <button onClick={() => void copyMessageLink(contextMenu.message!)}><span>⛓</span>Mesaj bağlantısını kopyala</button>
              <button onClick={() => void forwardMessage(contextMenu.message!)}><span>↗</span>Mesajı ilet</button>
              <button onClick={() => void saveBookmark(contextMenu.message!)}><span>☆</span>Sonra için kaydet</button>
              {contextMenu.message.authorProfileId !== profile?.id && (
                <button onClick={() => void reportContent("message", contextMenu.message!.id)}><span>!</span>Mesajı bildir</button>
              )}
              {(canManageMessages ||
                contextMenu.message.authorProfileId === profile?.id ||
                contextMenu.message.authorTag === `@${profile?.username}`) && (
                <button className="danger" onClick={() => void deleteMessage(contextMenu.message!)}><span>×</span>Mesajı sil</button>
              )}
            </>
          )}
          {contextMenu.kind === "member" && contextMenu.member && (
            <>
              <div className="context-member">
                <Avatar name={contextMenu.member.name} tone={toneFor(contextMenu.member.id)} size="sm" imageUrl={contextMenu.member.avatarUrl} status={contextMenu.member.presenceStatus || (contextMenu.member.online ? "online" : "offline")} />
                <span><strong>{contextMenu.member.name}</strong><small>{contextMenu.member.tag}</small></span>
              </div>
              <button onClick={() => { setViewingMember(contextMenu.member!); setModal("memberProfile"); }}><span>◉</span>Profili görüntüle</button>
              <button onClick={() => insertMention(contextMenu.member!.tag)}><span>@</span>Bahset</button>
              {canManageRoles && (
                <button onClick={openRoles}><span>♢</span>Rolünü düzenle</button>
              )}
              {contextMenu.member.id !== profile?.id && (
                <>
                  <button onClick={() => void startDirectMessage(contextMenu.member!)}><span>✉</span>Mesaj gönder</button>
                  <button onClick={() => void requestFriend(contextMenu.member!)}><span>＋</span>Arkadaş ekle</button>
                  <button className="danger" onClick={() => void friendAction("block", contextMenu.member!.id)}><span>⊘</span>Engelle</button>
                  <button onClick={() => void reportContent("profile", contextMenu.member!.id)}><span>!</span>Kullanıcıyı bildir</button>
                </>
              )}
              {(canKickMembers || canBanMembers) &&
                contextMenu.member.id !== profile?.id &&
                !contextMenu.member.role?.id.endsWith(":owner") && (
                  <>
                    <i />
                    {canKickMembers && <button className="danger" onClick={() => void moderateMember(contextMenu.member!, "kick")}><span>↗</span>Topluluktan çıkar</button>}
                    {canKickMembers && <button onClick={() => void memberControl(contextMenu.member!, "timeout")}><span>◷</span>Timeout uygula</button>}
                    {canKickMembers && contextMenu.member.voiceChannelId && <button onClick={() => void memberControl(contextMenu.member!, "voiceDisconnect")}><span>◖</span>Sesten çıkar</button>}
                    {canKickMembers && contextMenu.member.voiceChannelId && <button onClick={() => void memberControl(contextMenu.member!, "serverMute")}><span>μ</span>{contextMenu.member.serverMuted ? "Sunucu susturmasını kaldır" : "Sunucuda sustur"}</button>}
                    {canManageRoles && <button onClick={() => void memberControl(contextMenu.member!, "nickname")}><span>✎</span>Takma adı düzenle</button>}
                    {canBanMembers && <button className="danger" onClick={() => void moderateMember(contextMenu.member!, "ban")}><span>!</span>Yasakla</button>}
                  </>
                )}
            </>
          )}
        </div>
      )}

      {toast && (
        <div
          className={`toast ${toast.tone || ""}`}
          role={toast.tone === "danger" ? "alert" : "status"}
          aria-live={toast.tone === "danger" ? "assertive" : "polite"}
        >
          <span aria-hidden="true">{toast.tone === "success" ? "✓" : toast.tone === "danger" ? "!" : "i"}</span>
          {toast.text}
        </div>
      )}
    </main>
  );
}
