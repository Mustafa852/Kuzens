"use client";

import {
  FormEvent,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./kuzens.css";

type Channel = {
  id: string;
  serverId: string;
  name: string;
  kind: "text" | "voice";
  topic?: string | null;
  slowModeSeconds?: number;
  bitrate?: number;
  userLimit?: number;
  region?: string;
  permissions?: number;
  position: number;
  unreadCount?: number;
  mentionCount?: number;
  notificationLevel?: "all" | "mentions" | "none";
  showUnread?: boolean;
};

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

type Profile = {
  id: string;
  displayName: string;
  username: string;
  bio?: string;
  customStatus?: string;
  presenceStatus?: "online" | "idle" | "dnd" | "invisible";
  avatarUrl?: string | null;
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
  role: { id: string; name: string; color: string } | null;
  roles?: Array<{ id: string; name: string; color: string }>;
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
  type: "offer" | "answer" | "ice";
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
  pushToTalk: boolean;
  inputDeviceId: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
};

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
};

type DirectMessage = {
  id: string;
  conversationId: string;
  authorProfileId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string | null;
  content: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
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
  pushToTalk: false,
  inputDeviceId: "",
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

type ContextMenuState = {
  x: number;
  y: number;
  kind: "server" | "channel" | "message" | "member";
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
  { bit: 256, label: "Odayı gör", kinds: ["text", "voice"] as const },
  { bit: 512, label: "Mesaj gönder", kinds: ["text"] as const },
  { bit: 64, label: "Odaya katıl", kinds: ["voice"] as const },
  { bit: 1024, label: "Konuş", kinds: ["voice"] as const },
  { bit: 128, label: "Ekran paylaş", kinds: ["voice"] as const },
];

const fallbackChannels: Channel[] = [
  { id: "genel", serverId: "kuzens", name: "genel", kind: "text", position: 0 },
  { id: "oyun-gecesi", serverId: "kuzens", name: "oyun-gecesi", kind: "text", position: 1 },
  { id: "paylasimlar", serverId: "kuzens", name: "paylaşımlar", kind: "text", position: 2 },
  { id: "muhabbet", serverId: "kuzens", name: "Muhabbet", kind: "voice", position: 3 },
  { id: "gece-ekibi", serverId: "kuzens", name: "Gece Ekibi", kind: "voice", position: 4 },
];

const memberTones = ["purple", "pink", "blue", "orange", "green"];

function toneFor(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return memberTones[hash % memberTones.length];
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

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) merged.set(message.id, message);
  return Array.from(merged.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function matchesSearch(message: ChatMessage, rawSearch: string) {
  const normalized = rawSearch.trim().toLocaleLowerCase("tr-TR");
  if (!normalized) return true;
  const phrases = Array.from(normalized.matchAll(/"([^"]+)"/g), (match) => match[1]);
  const tokens = normalized.replace(/"[^"]+"/g, " ").split(/\s+/).filter(Boolean);
  const plain: string[] = [];

  for (const token of tokens) {
    if (token.startsWith("from:")) {
      const author = token.slice(5).replace(/^@/, "");
      if (
        author &&
        !message.authorTag.slice(1).toLocaleLowerCase("tr-TR").includes(author) &&
        !message.authorName.toLocaleLowerCase("tr-TR").includes(author)
      ) {
        return false;
      }
      continue;
    }
    if (token === "has:link" && !/https?:\/\/\S+/i.test(message.content)) return false;
    if (token === "has:mention" && !/@(?:[a-z0-9_]{3,24}|everyone|here)\b/i.test(message.content)) {
      return false;
    }
    if (token === "is:pinned" && !message.pinned) return false;
    if (token === "is:edited" && !message.editedAt) return false;
    if (token.startsWith("before:")) {
      const time = new Date(token.slice(7)).getTime();
      if (Number.isFinite(time) && new Date(message.createdAt).getTime() >= time) return false;
      continue;
    }
    if (token.startsWith("after:")) {
      const time = new Date(token.slice(6)).getTime();
      if (Number.isFinite(time) && new Date(message.createdAt).getTime() <= time) return false;
      continue;
    }
    if (!token.includes(":")) plain.push(token);
  }

  const haystack = `${message.content} ${message.authorName} ${message.authorTag}`
    .toLocaleLowerCase("tr-TR");
  return [...phrases, ...plain].every((term) => haystack.includes(term));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("tr-TR");
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateTimeInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function eventDateLabel(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function localDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function calendarDays(monthValue: string) {
  const month = new Date(`${monthValue}T12:00:00`);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const cells: Array<{ date: Date; current: boolean }> = [];
  for (let index = -mondayOffset; index < 42 - mondayOffset; index += 1) {
    const date = new Date(year, monthIndex, index + 1, 12);
    cells.push({ date, current: date.getMonth() === monthIndex });
  }
  return cells;
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    "server.create": "Topluluk oluşturdu",
    "server.update": "Topluluk ayarlarını değiştirdi",
    "channel.create": "Oda oluşturdu",
    "channel.update": "Oda ayarlarını değiştirdi",
    "channel.delete": "Oda sildi",
    "roles.create": "Rol oluşturdu",
    "roles.update": "Rol ve yetkileri değiştirdi",
    "roles.delete": "Rol sildi",
    "member.kick": "Üyeyi topluluktan çıkardı",
    "member.ban": "Üyeyi yasakladı",
    "member.unban": "Üye yasağını kaldırdı",
    "invite.create": "Davet bağlantısı oluşturdu",
    "event.create": "Etkinlik oluşturdu",
    "event.cancel": "Etkinliği iptal etti",
    "automod.update": "AutoMod ayarlarını değiştirdi",
    "automod.block": "AutoMod tarafından mesajı engellendi",
    "guide.update": "Başlangıç rehberini güncelledi",
    "channel.reorder": "Oda sırasını değiştirdi",
  };
  return labels[action] || action.replaceAll(".", " · ");
}

function memberStatus(member: Member) {
  if (member.voiceChannelId) return member.sharing ? "Ekran paylaşıyor" : "Ses odasında";
  if (member.customStatus) return member.customStatus;
  if (member.online) return member.role?.name || "Çevrimiçi";
  if (!member.lastSeenAt) return "Çevrimdışı";
  const minutes = Math.max(
    1,
    Math.floor((Date.now() - new Date(member.lastSeenAt).getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} sa önce` : `${Math.floor(hours / 24)} gün önce`;
}

function MessageText({
  content,
  members,
  onMention,
}: {
  content: string;
  members: Member[];
  onMention: (tag: string) => void;
}) {
  const parts = content.split(/(@(?:everyone|here|[a-z0-9_]{3,24}))/gi);
  return (
    <>
      {parts.map((part, index) => {
        if (!part.startsWith("@")) return <span key={`${part}-${index}`}>{part}</span>;
        const member = members.find(
          (item) => item.tag.toLocaleLowerCase("en-US") === part.toLocaleLowerCase("en-US"),
        );
        const mass = /^@(everyone|here)$/i.test(part);
        if (!member && !mass) return <span key={`${part}-${index}`}>{part}</span>;
        return (
          <button
            type="button"
            className={`inline-mention ${mass ? "mass" : ""}`}
            key={`${part}-${index}`}
            onClick={() => onMention(member?.tag || part)}
          >
            {member?.tag || part}
          </button>
        );
      })}
    </>
  );
}

type LinkPreviewData = {
  url: string;
  provider: string;
  siteName: string;
  title: string;
  description: string;
  imageUrl?: string | null;
};

function LinkEmbed({ content }: { content: string }) {
  const urlText = content.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  const [result, setResult] = useState<{
    key: string;
    preview: LinkPreviewData | null;
    failed: boolean;
  }>({ key: "", preview: null, failed: false });
  let url: URL | null = null;
  try {
    url = urlText ? new URL(urlText) : null;
  } catch {
    url = null;
  }

  useEffect(() => {
    if (!urlText) return;
    let target: URL;
    try {
      target = new URL(urlText);
    } catch {
      return;
    }
    const controller = new AbortController();
    apiFetch(`/api/link-preview?url=${encodeURIComponent(target.toString())}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("preview");
        setResult({
          key: urlText,
          preview: (await response.json()) as LinkPreviewData,
          failed: false,
        });
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setResult({ key: urlText, preview: null, failed: true });
        }
      });
    return () => controller.abort();
  }, [urlText]);

  if (!urlText || !url) return null;
  const preview = result.key === urlText ? result.preview : null;
  const failed = result.key === urlText ? result.failed : false;
  const provider = preview?.provider || "web";
  const source = preview?.siteName || url.hostname.replace(/^www\./, "").toUpperCase();
  const title = preview?.title || url.hostname.replace(/^www\./, "");
  const description =
    preview?.description ||
    (failed
      ? "Önizleme alınamadı · bağlantıyı yeni sekmede aç"
      : "İçerik bilgileri hazırlanıyor…");

  return (
    <a className="link-embed" href={url.toString()} target="_blank" rel="noreferrer noopener nofollow" referrerPolicy="no-referrer">
      <div
        className={`embed-art ${provider} ${preview?.imageUrl ? "has-image" : ""} ${!preview && !failed ? "is-loading" : ""}`}
        style={preview?.imageUrl ? { backgroundImage: `linear-gradient(145deg, rgba(0,0,0,.04), rgba(0,0,0,.36)), url("${preview.imageUrl}")` } : undefined}
      >
        <span>{provider === "steam" ? "STEAM" : provider === "youtube" ? "▶" : "KZ"}</span>
        <div className="embed-art-glow" />
      </div>
      <div className="embed-copy">
        <span className="embed-source">{source}</span>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </a>
  );
}

function PollCard({
  poll,
  onVote,
  onClose,
  canClose,
}: {
  poll: PollData;
  onVote: (optionId: string) => void;
  onClose: () => void;
  canClose: boolean;
}) {
  const ended = Boolean(poll.closedAt);
  const selections = poll.options.reduce((total, option) => total + option.count, 0);
  return (
    <section className={`poll-card ${ended ? "ended" : ""}`}>
      <header>
        <span>ANKET</span>
        <strong>{poll.question}</strong>
        <small>{poll.allowMultiple ? "Birden çok seçim" : "Tek seçim"}</small>
      </header>
      <div className="poll-options">
        {poll.options.map((option) => {
          const percent = selections ? Math.round((option.count / selections) * 100) : 0;
          return (
            <button
              type="button"
              className={option.votedByMe ? "voted" : ""}
              key={option.id}
              onClick={() => onVote(option.id)}
              disabled={ended}
            >
              <i style={{ width: `${percent}%` }} />
              <span>{option.votedByMe ? "✓" : "○"}</span>
              <strong>{option.label}</strong>
              <em>{option.count}</em>
            </button>
          );
        })}
      </div>
      <footer>
        <span>{poll.totalVotes} katılımcı</span>
        <span>{ended ? "Sona erdi" : `${eventDateLabel(poll.closesAt)} biter`}</span>
        {canClose && !ended && <button type="button" onClick={onClose}>Anketi bitir</button>}
      </footer>
    </section>
  );
}

function Avatar({
  name,
  tone = "purple",
  size = "md",
  online,
  imageUrl,
  status,
}: {
  name: string;
  tone?: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  imageUrl?: string | null;
  status?: "online" | "idle" | "dnd" | "invisible" | "offline";
}) {
  const resolvedStatus =
    status || (typeof online === "boolean" ? (online ? "online" : "offline") : null);
  return (
    <span className={`avatar avatar-${tone} avatar-${size}`} aria-label={name}>
      {imageUrl ? (
        // Profile images are authenticated same-origin R2 responses; the framework image proxy cannot forward that identity.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" />
      ) : initials(name)}
      {resolvedStatus && <i className={`presence-dot presence-${resolvedStatus}`} />}
    </span>
  );
}

function RemoteAudio({
  stream,
  muted,
  volume,
}: {
  stream: MediaStream;
  muted: boolean;
  volume: number;
}) {
  const element = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (element.current) {
      element.current.srcObject = stream;
      element.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [stream, volume]);
  return <audio ref={element} autoPlay muted={muted} />;
}

function RemoteVideo({ stream, label }: { stream: MediaStream; label: string }) {
  const element = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (element.current) element.current.srcObject = stream;
  }, [stream]);
  return <video ref={element} autoPlay muted playsInline aria-label={`${label} ekran paylaşımı`} />;
}

export function KuzensApp() {
  const [servers, setServers] = useState<CommunityServer[]>([]);
  const [activeServerId, setActiveServerId] = useState("kuzens");
  const [serverRefresh, setServerRefresh] = useState(0);
  const [channels, setChannels] = useState<Channel[]>(fallbackChannels);
  const [activeChannel, setActiveChannel] = useState("genel");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [bannedMembers, setBannedMembers] = useState<BannedMember[]>([]);
  const [permissions, setPermissions] = useState(0);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [connectedVoiceChannelId, setConnectedVoiceChannelId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [modal, setModal] = useState<
    "channel" | "channelSettings" | "channelNotifications" | "roles" | "server" | "serverSettings" | "friends" | "account" | "profile" | "memberProfile" | "notifications" | "aura" | "preferences" | "directMessages" | "auditLog" | "events" | "automod" | "bookmarks" | "poll" | "thread" | "guide" | null
  >(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [newServerName, setNewServerName] = useState("");
  const [serverSettingsName, setServerSettingsName] = useState("");
  const [serverSettingsIcon, setServerSettingsIcon] = useState("");
  const [serverSettingsDescription, setServerSettingsDescription] = useState("");
  const [serverDefaultNotifications, setServerDefaultNotifications] = useState<"all" | "mentions">("mentions");
  const [serverExplicitFilter, setServerExplicitFilter] = useState(true);
  const [serverPreferredLocale, setServerPreferredLocale] = useState("tr");
  const [serverSystemChannelId, setServerSystemChannelId] = useState("");
  const [serverSaving, setServerSaving] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelKind, setNewChannelKind] = useState<"text" | "voice">("text");
  const [channelSettingsName, setChannelSettingsName] = useState("");
  const [channelSettingsTopic, setChannelSettingsTopic] = useState("");
  const [channelSlowMode, setChannelSlowMode] = useState(0);
  const [channelBitrate, setChannelBitrate] = useState(64_000);
  const [channelUserLimit, setChannelUserLimit] = useState(0);
  const [channelRegion, setChannelRegion] = useState("auto");
  const [channelPermissionRoles, setChannelPermissionRoles] = useState<Role[]>([]);
  const [channelPermissionOverwrites, setChannelPermissionOverwrites] = useState<
    ChannelPermissionOverwrite[]
  >([]);
  const [channelPermissionsLoading, setChannelPermissionsLoading] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileCustomStatus, setProfileCustomStatus] = useState("");
  const [profilePresence, setProfilePresence] = useState<
    "online" | "idle" | "dnd" | "invisible"
  >("online");
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [profileAvatarDataUrl, setProfileAvatarDataUrl] = useState<string | null>(null);
  const [profileRemoveAvatar, setProfileRemoveAvatar] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [accountDeleteUsername, setAccountDeleteUsername] = useState("");
  const [accountDeleteConfirmation, setAccountDeleteConfirmation] = useState("");
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [notifications, setNotifications] = useState<MentionNotification[]>([]);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [mobileChannels, setMobileChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [splashVisible, setSplashVisible] = useState(true);
  const [registrationName, setRegistrationName] = useState("");
  const [registrationUsername, setRegistrationUsername] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);
  const [roleItems, setRoleItems] = useState<Role[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#9c7cff");
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [rolesCanManage, setRolesCanManage] = useState(false);
  const [friendItems, setFriendItems] = useState<FriendItem[]>([]);
  const [friendUsername, setFriendUsername] = useState("");
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [auraMembership, setAuraMembership] = useState<AuraMembership | null>(null);
  const [serverAuraMembership, setServerAuraMembership] = useState<ServerAuraMembership | null>(null);
  const [auraPerks, setAuraPerks] = useState<string[]>([]);
  const [serverAuraPerks, setServerAuraPerks] = useState<string[]>([]);
  const [auraCodes, setAuraCodes] = useState<AuraCode[]>([]);
  const [auraMembers, setAuraMembers] = useState<AuraOwnerMembership[]>([]);
  const [auraServers, setAuraServers] = useState<AuraOwnerServer[]>([]);
  const [auraRedeemCode, setAuraRedeemCode] = useState("");
  const [auraGrantUsername, setAuraGrantUsername] = useState("");
  const [auraDuration, setAuraDuration] = useState<30 | 90 | 365 | 0>(30);
  const [auraCodeDuration, setAuraCodeDuration] = useState<30 | 90 | 365>(30);
  const [auraMaxUses, setAuraMaxUses] = useState(1);
  const [auraServerTier, setAuraServerTier] = useState<1 | 2 | 3>(1);
  const [auraBusy, setAuraBusy] = useState(false);
  const [freshAuraCode, setFreshAuraCode] = useState("");
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [pttPressed, setPttPressed] = useState(false);
  const [directConversations, setDirectConversations] = useState<DirectConversation[]>([]);
  const [directRequests, setDirectRequests] = useState<DirectConversation[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [activeDirectConversationId, setActiveDirectConversationId] = useState("");
  const [directDraft, setDirectDraft] = useState("");
  const [directLoading, setDirectLoading] = useState(false);
  const [directPrivacy, setDirectPrivacy] = useState<"friends" | "shared_servers" | "none">("friends");
  const [directUsername, setDirectUsername] = useState("");
  const [draftLoadedKey, setDraftLoadedKey] = useState("");
  const [directDraftLoadedKey, setDirectDraftLoadedKey] = useState("");
  const [notificationChannel, setNotificationChannel] = useState<Channel | null>(null);
  const [notificationLevel, setNotificationLevel] = useState<"all" | "mentions" | "none">("mentions");
  const [notificationShowUnread, setNotificationShowUnread] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [communityEvents, setCommunityEvents] = useState<CommunityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsCanManage, setEventsCanManage] = useState(false);
  const [eventMonth, setEventMonth] = useState(() =>
    dateTimeInputValue(new Date()).slice(0, 7) + "-01",
  );
  const [eventSelectedDay, setEventSelectedDay] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventChannelId, setEventChannelId] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState(() =>
    dateTimeInputValue(new Date(Date.now() + 60 * 60_000)),
  );
  const [eventEndsAt, setEventEndsAt] = useState(() =>
    dateTimeInputValue(new Date(Date.now() + 2 * 60 * 60_000)),
  );
  const [eventRecurrence, setEventRecurrence] = useState<"none" | "weekly" | "monthly">("none");
  const [eventCreating, setEventCreating] = useState(false);
  const [autoModSettings, setAutoModSettings] = useState<AutoModSettings>({
    enabled: true,
    blockedTerms: "",
    blockInviteLinks: true,
    blockDuplicateMessages: true,
    maxMentions: 8,
    exemptChannelIds: [],
  });
  const [autoModLoading, setAutoModLoading] = useState(false);
  const [autoModSaving, setAutoModSaving] = useState(false);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [memberVolumes, setMemberVolumes] = useState<Record<string, number>>({});
  const [revealedBlockedMessages, setRevealedBlockedMessages] = useState<Set<string>>(
    () => new Set(),
  );
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionDrafts, setPollOptionDrafts] = useState(["", ""]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollDurationHours, setPollDurationHours] = useState(24);
  const [pollCreating, setPollCreating] = useState(false);
  const [activeThread, setActiveThread] = useState<ThreadDetail | null>(null);
  const [threadReplies, setThreadReplies] = useState<ThreadReply[]>([]);
  const [threadDraft, setThreadDraft] = useState("");
  const [threadDraftLoadedKey, setThreadDraftLoadedKey] = useState("");
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadCanManage, setThreadCanManage] = useState(false);
  const [favoriteChannelIds, setFavoriteChannelIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [serverGuide, setServerGuide] = useState<ServerGuideData>({
    welcomeMessage: "",
    rulesChannelId: null,
  });
  const [guideCompletedSteps, setGuideCompletedSteps] = useState<string[]>([]);
  const [guideCanManage, setGuideCanManage] = useState(false);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideServerId, setGuideServerId] = useState("");
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const voiceStream = useRef<MediaStream | null>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const previewVideo = useRef<HTMLVideoElement | null>(null);
  const messageList = useRef<HTMLDivElement | null>(null);
  const stickToLatest = useRef(true);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const directMessageList = useRef<HTMLDivElement | null>(null);
  const preferencesReady = useRef(false);
  const memberVolumesReady = useRef(false);
  const favoriteChannelsReady = useRef(false);
  const rtcSyncAt = useRef(new Date(Date.now() - 30_000).toISOString());
  const rtcChannelId = useRef<string | null>(null);
  const peerConnections = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const makingOffers = useRef(new Set<string>());

  const selected = channels.find((channel) => channel.id === activeChannel) || channels[0];
  const connectedVoiceChannel =
    channels.find((channel) => channel.id === connectedVoiceChannelId) || null;
  const activeDirectConversation =
    directConversations.find((conversation) => conversation.id === activeDirectConversationId) ||
    directRequests.find((conversation) => conversation.id === activeDirectConversationId) ||
    (!activeDirectConversationId ? directConversations[0] : null) ||
    null;
  const activeDirectRequest =
    directRequests.find((conversation) => conversation.id === activeDirectConversationId) || null;
  const directUnreadCount = directConversations.reduce(
    (total, conversation) => total + (conversation.unreadCount || 0),
    directRequests.length,
  );
  const bookmarkReminderCount = savedMessages.filter((item) => item.reminderDue).length;
  const channelDraftKey = `channel:${activeServerId}:${activeChannel}`;
  const directDraftKey = `direct:${activeDirectConversationId || "none"}`;
  const threadDraftKey = `thread:${activeThread?.id || "none"}`;
  const activeServer =
    servers.find((server) => server.id === activeServerId) ||
    ({ id: "kuzens", name: "Kuzens", icon: "KZ" } satisfies CommunityServer);
  const selectedRole = roleItems.find((role) => role.id === selectedRoleId);
  const textChannels = channels.filter((channel) => channel.kind === "text");
  const voiceChannels = channels.filter((channel) => channel.kind === "voice");
  const favoriteChannels = channels.filter((channel) => favoriteChannelIds.has(channel.id));
  const onlineMembers = members.filter((member) => member.online);
  const offlineMembers = members.filter((member) => !member.online);
  const voiceRoomMembers = members.filter(
    (member) => member.voiceChannelId === selected?.id,
  );
  const visibleVoiceMembers =
    voiceRoomMembers.length || !profile || !voiceConnected
      ? voiceRoomMembers
      : [
          {
            id: profile.id,
            name: profile.displayName,
            tag: `@${profile.username}`,
            online: true,
            lastSeenAt: new Date().toISOString(),
            voiceChannelId: selected?.id || null,
            sharing,
            role: null,
          },
        ];
  const remoteSharer = voiceRoomMembers.find(
    (member) => member.id !== profile?.id && member.sharing && remoteStreams[member.id],
  );
  const canManageChannels = (permissions & 2) !== 0;
  const canManageServer = (permissions & 1) !== 0;
  const canManageRoles = (permissions & 4) !== 0;
  const canManageMessages = (permissions & 8) !== 0;
  const canKickMembers = (permissions & 16) !== 0;
  const canBanMembers = (permissions & 32) !== 0;
  const voiceBitrateLimit = profile?.isOwner
    ? 384_000
    : serverAuraMembership?.active
      ? [64_000, 128_000, 192_000, 256_000][serverAuraMembership.tier] || 128_000
      : 64_000;
  const canSpeakInConnectedVoice =
    !connectedVoiceChannel ||
    (((connectedVoiceChannel.permissions ?? permissions) & 1024) !== 0);
  const canShareInConnectedVoice =
    !connectedVoiceChannel ||
    (((connectedVoiceChannel.permissions ?? permissions) & 128) !== 0);
  const ownsActiveServer =
    activeServerId === "kuzens"
      ? Boolean(profile?.isOwner)
      : activeServer.ownerProfileId === profile?.id;
  const mentionQuery = useMemo(() => {
    const match = draft.match(/(?:^|\s)@([a-z0-9_]*)$/i);
    return match ? match[1].toLocaleLowerCase("en-US") : null;
  }, [draft]);
  const mentionCandidates =
    mentionQuery === null
      ? []
      : members
          .filter(
            (member) =>
              member.tag.slice(1).toLocaleLowerCase("en-US").includes(mentionQuery) ||
              member.name.toLocaleLowerCase("tr-TR").includes(mentionQuery),
          )
          .slice(0, 6);

  const visibleMessages = useMemo(() => {
    return messages.filter(
      (message) =>
        message.channelId === activeChannel &&
        (!showPinnedOnly || message.pinned) &&
        matchesSearch(message, search),
    );
  }, [activeChannel, messages, search, showPinnedOnly]);
  const eventOccurrences = useMemo(
    () =>
      communityEvents
        .filter((event) => !event.cancelledAt)
        .flatMap((event) =>
          event.occurrences.map((occurrence) => ({ event, ...occurrence })),
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [communityEvents],
  );
  const eventCalendarDays = useMemo(() => calendarDays(eventMonth), [eventMonth]);
  const visibleEventOccurrences = eventSelectedDay
    ? eventOccurrences.filter((occurrence) => localDateKey(occurrence.startsAt) === eventSelectedDay)
    : eventOccurrences.filter((occurrence) => new Date(occurrence.endsAt).getTime() >= Date.now());

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashVisible(false), 1_850);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    apiFetch("/api/profile")
      .then((response) => response.json())
      .then((data: {
        profile?: Profile | null;
        identity?: { displayName?: string; suggestedUsername?: string };
      }) => {
        setProfile(data.profile ?? null);
        setRegistrationName(data.identity?.displayName || "Savaş");
        setRegistrationUsername(data.identity?.suggestedUsername || "savas");
      })
      .catch(() => {
        setProfile(null);
        setRegistrationName("Savaş");
        setRegistrationUsername("savas");
      });
  }, []);

  useEffect(() => {
    if (!profile) return;
    const code = new URLSearchParams(window.location.search).get("davet");
    if (!code) return;
    apiFetch("/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "join", code }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "Davete katılınamadı."));
        window.history.replaceState({}, "", window.location.pathname);
        setServerRefresh((value) => value + 1);
        setToast({ text: "Kuzens topluluğuna katıldın.", tone: "success" });
      })
      .catch((error) =>
        setToast({
          text: error instanceof Error ? error.message : "Davete katılınamadı.",
          tone: "danger",
        }),
      );
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    apiFetch("/api/servers")
      .then((response) => response.json())
      .then((data: { servers?: CommunityServer[] }) => {
        const nextServers = data.servers || [];
        setServers(nextServers);
        if (nextServers.length && !nextServers.some((server) => server.id === activeServerId)) {
          setActiveServerId(nextServers[0].id);
        }
      })
      .catch(() => undefined);
  }, [activeServerId, profile, serverRefresh]);

  useEffect(() => {
    if (!profile) return;
    apiFetch(`/api/channels?server=${encodeURIComponent(activeServerId)}`)
      .then((response) => response.json())
      .then((data: { channels?: Channel[] }) => {
        if (data.channels?.length) {
          setChannels(data.channels);
          setActiveChannel((current) =>
            data.channels!.some((channel) => channel.id === current)
              ? current
              : data.channels![0].id,
          );
        }
      })
      .catch(() => undefined);
  }, [activeServerId, profile]);

  useEffect(() => {
    if (!profile || selected?.kind !== "text") return;
    let cancelled = false;
    async function syncMessages(initial = false) {
      if (initial) setLoadingMessages(true);
      try {
        const query = new URLSearchParams({
          channel: activeChannel,
          server: activeServerId,
        });
        const response = await apiFetch(`/api/messages?${query.toString()}`);
        if (!response.ok) return;
        const data = (await response.json()) as {
          messages?: ChatMessage[];
          syncedAt?: string;
        };
        if (!cancelled) {
          setMessages((current) => {
            const otherChannels = current.filter(
              (message) => message.channelId !== activeChannel,
            );
            const currentChannel = initial
              ? []
              : current.filter((message) => message.channelId === activeChannel);
            return [
              ...otherChannels,
              ...mergeMessages(currentChannel, data.messages || []),
            ];
          });
        }
      } finally {
        if (!cancelled && initial) setLoadingMessages(false);
      }
    }
    void syncMessages(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncMessages(false);
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeChannel, activeServerId, selected?.kind, profile]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    async function loadMembers() {
      const response = await apiFetch(
        `/api/members?server=${encodeURIComponent(activeServerId)}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as {
        members?: Member[];
        banned?: BannedMember[];
        permissions?: number;
      };
      if (!cancelled) {
        setMembers(data.members || []);
        setBannedMembers(data.banned || []);
        setPermissions(data.permissions || 0);
      }
    }
    async function sendPresence() {
      await apiFetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          voiceChannelId: voiceConnected ? connectedVoiceChannelId : null,
          sharing: voiceConnected && sharing,
          serverId: activeServerId,
        }),
      }).catch(() => undefined);
    }
    void sendPresence().then(loadMembers);
    const presenceTimer = window.setInterval(() => void sendPresence(), 25_000);
    const membersTimer = window.setInterval(() => void loadMembers(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(presenceTimer);
      window.clearInterval(membersTimer);
    };
  }, [activeServerId, connectedVoiceChannelId, profile, sharing, voiceConnected]);

  useEffect(() => {
    if (!profile) return;
    let stopped = false;
    async function syncChannelStates() {
      const response = await apiFetch(
        `/api/channel-state?server=${encodeURIComponent(activeServerId)}`,
      );
      if (!response.ok || stopped) return;
      const data = (await response.json()) as {
        states?: Array<{
          channelId: string;
          unreadCount: number;
          mentionCount: number;
          level: "all" | "mentions" | "none";
          showUnread: boolean;
        }>;
      };
      const stateMap = new Map((data.states || []).map((item) => [item.channelId, item]));
      setChannels((current) =>
        current.map((channel) => {
          const state = stateMap.get(channel.id);
          return state
            ? {
                ...channel,
                unreadCount: state.unreadCount,
                mentionCount: state.mentionCount,
                notificationLevel: state.level,
                showUnread: state.showUnread,
              }
            : channel;
        }),
      );
    }
    void syncChannelStates();
    const timer = window.setInterval(() => void syncChannelStates(), 10_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeServerId, profile]);

  useEffect(() => {
    stickToLatest.current = true;
    window.queueMicrotask(() => setShowJumpToLatest(false));
  }, [activeChannel]);

  useEffect(() => {
    const list = messageList.current;
    if (!list) return;
    if (!stickToLatest.current) {
      window.queueMicrotask(() => setShowJumpToLatest(true));
      return;
    }
    list.scrollTo({
      top: list.scrollHeight,
      behavior: "smooth",
    });
    window.queueMicrotask(() => setShowJumpToLatest(false));
  }, [visibleMessages.length]);

  useEffect(() => {
    const list = directMessageList.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [directMessages.length]);

  useEffect(() => {
    if (modal !== "directMessages" || !activeDirectConversationId) return;
    let stopped = false;
    let lastMarkedMessageId = "";
    async function sync() {
      const response = await apiFetch(
        `/api/direct-messages?conversation=${encodeURIComponent(activeDirectConversationId)}`,
      );
      if (!response.ok || stopped) return;
      const data = (await response.json()) as { messages?: DirectMessage[] };
      const nextMessages = data.messages || [];
      setDirectMessages(nextMessages);
      const latestMessageId = nextMessages.at(-1)?.id || "empty";
      if (latestMessageId !== lastMarkedMessageId) {
        lastMarkedMessageId = latestMessageId;
        await apiFetch("/api/direct-messages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "read",
            conversationId: activeDirectConversationId,
          }),
        }).catch(() => undefined);
        setDirectConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeDirectConversationId
              ? { ...conversation, unreadCount: 0 }
            : conversation,
          ),
        );
      }
    }
    void sync();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, 4_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeDirectConversationId, modal]);

  useEffect(() => {
    if (sharing && previewVideo.current && displayStream.current) {
      previewVideo.current.srcObject = displayStream.current;
    }
  }, [sharing]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!profile) return;
    void loadNotifications();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let stopped = false;
    async function syncDirectSummary() {
      const response = await apiFetch("/api/direct-messages");
      if (!response.ok || stopped) return;
      const data = (await response.json()) as {
        conversations?: DirectConversation[];
        requests?: DirectConversation[];
        privacy?: "friends" | "shared_servers" | "none";
      };
      setDirectConversations(data.conversations || []);
      setDirectRequests(data.requests || []);
      setDirectPrivacy(data.privacy || "friends");
    }
    void syncDirectSummary();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncDirectSummary();
    }, 30_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [profile]);

  useEffect(() => {
    if (profile && activeServerId) void loadAura();
    // loadAura is a component helper; the server/profile keys are the intentional refresh boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerId, profile]);

  useEffect(() => {
    if (!profile) return;
    void loadBookmarks();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadBookmarks();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [profile]);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("kuzens-preferences") || "{}") as Partial<AppPreferences>;
        setPreferences({
          fontSize: ["small", "normal", "large"].includes(saved.fontSize || "")
            ? saved.fontSize!
            : "normal",
          density: saved.density === "compact" ? "compact" : "comfortable",
          highContrast: Boolean(saved.highContrast),
          reducedMotion: Boolean(saved.reducedMotion),
          pushToTalk: Boolean(saved.pushToTalk),
          inputDeviceId: typeof saved.inputDeviceId === "string" ? saved.inputDeviceId : "",
          echoCancellation: saved.echoCancellation !== false,
          noiseSuppression: saved.noiseSuppression !== false,
          autoGainControl: saved.autoGainControl !== false,
        });
      } catch {
        setPreferences(defaultPreferences);
      } finally {
        preferencesReady.current = true;
      }
    });
  }, []);

  useEffect(() => {
    if (!preferencesReady.current) return;
    localStorage.setItem("kuzens-preferences", JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    window.queueMicrotask(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("kuzens-member-volumes") || "{}");
        if (saved && typeof saved === "object") {
          setMemberVolumes(
            Object.fromEntries(
              Object.entries(saved)
                .filter(([, value]) => typeof value === "number" && value >= 0 && value <= 1)
                .slice(0, 200),
            ),
          );
        }
      } catch {
        setMemberVolumes({});
      } finally {
        memberVolumesReady.current = true;
      }
    });
  }, []);

  useEffect(() => {
    if (!memberVolumesReady.current) return;
    localStorage.setItem("kuzens-member-volumes", JSON.stringify(memberVolumes));
  }, [memberVolumes]);

  useEffect(() => {
    window.queueMicrotask(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("kuzens-favorite-channels") || "[]");
        setFavoriteChannelIds(
          new Set(
            Array.isArray(saved)
              ? saved.filter((item): item is string => typeof item === "string").slice(0, 100)
              : [],
          ),
        );
      } catch {
        setFavoriteChannelIds(new Set());
      } finally {
        favoriteChannelsReady.current = true;
      }
    });
  }, []);

  useEffect(() => {
    if (!favoriteChannelsReady.current) return;
    localStorage.setItem(
      "kuzens-favorite-channels",
      JSON.stringify(Array.from(favoriteChannelIds).slice(0, 100)),
    );
  }, [favoriteChannelIds]);

  useEffect(() => {
    let cancelled = false;
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem("kuzens-drafts") || "{}");
    } catch {
      saved = {};
    }
    window.queueMicrotask(() => {
      if (cancelled) return;
      setDraft(saved[channelDraftKey] || "");
      setReplyingTo(null);
      setDraftLoadedKey(channelDraftKey);
    });
    return () => {
      cancelled = true;
    };
  }, [channelDraftKey]);

  useEffect(() => {
    if (draftLoadedKey !== channelDraftKey) return;
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem("kuzens-drafts") || "{}");
    } catch {
      saved = {};
    }
    if (draft) saved[channelDraftKey] = draft;
    else delete saved[channelDraftKey];
    localStorage.setItem("kuzens-drafts", JSON.stringify(saved));
  }, [channelDraftKey, draft, draftLoadedKey]);

  useEffect(() => {
    let cancelled = false;
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem("kuzens-drafts") || "{}");
    } catch {
      saved = {};
    }
    window.queueMicrotask(() => {
      if (cancelled) return;
      setDirectDraft(saved[directDraftKey] || "");
      setDirectDraftLoadedKey(directDraftKey);
    });
    return () => {
      cancelled = true;
    };
  }, [directDraftKey]);

  useEffect(() => {
    if (directDraftLoadedKey !== directDraftKey) return;
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem("kuzens-drafts") || "{}");
    } catch {
      saved = {};
    }
    if (directDraft) saved[directDraftKey] = directDraft;
    else delete saved[directDraftKey];
    localStorage.setItem("kuzens-drafts", JSON.stringify(saved));
  }, [directDraft, directDraftKey, directDraftLoadedKey]);

  useEffect(() => {
    let cancelled = false;
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem("kuzens-drafts") || "{}");
    } catch {
      saved = {};
    }
    window.queueMicrotask(() => {
      if (cancelled) return;
      setThreadDraft(saved[threadDraftKey] || "");
      setThreadDraftLoadedKey(threadDraftKey);
    });
    return () => {
      cancelled = true;
    };
  }, [threadDraftKey]);

  useEffect(() => {
    if (threadDraftLoadedKey !== threadDraftKey) return;
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem("kuzens-drafts") || "{}");
    } catch {
      saved = {};
    }
    if (threadDraft) saved[threadDraftKey] = threadDraft;
    else delete saved[threadDraftKey];
    localStorage.setItem("kuzens-drafts", JSON.stringify(saved));
  }, [threadDraft, threadDraftKey, threadDraftLoadedKey]);

  useEffect(() => {
    function keyboardShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLButtonElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (event.key === "Escape" && event.type === "keydown") {
        setContextMenu(null);
        setModal(null);
        setMobileChannels(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("en-US") === "k") {
        event.preventDefault();
        searchInput.current?.focus();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLocaleLowerCase("en-US") === "m" &&
        event.type === "keydown" &&
        voiceConnected
      ) {
        event.preventDefault();
        if (!canSpeakInConnectedVoice) {
          setToast({ text: "Bu odada konuşma yetkin yok. Dinleyici modundasın.", tone: "danger" });
        } else if (preferences.pushToTalk) {
          setToast({ text: "Bas-konuş açık: konuşmak için Boşluk tuşunu basılı tut." });
        } else {
          setMuted((current) => {
            const next = !current;
            voiceStream.current?.getAudioTracks().forEach((track) => {
              track.enabled = !next;
            });
            return next;
          });
        }
        return;
      }
      if (
        event.altKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown") &&
        event.type === "keydown" &&
        !typing
      ) {
        const navigable = channels.filter((channel) => channel.kind === "text");
        const currentIndex = Math.max(
          0,
          navigable.findIndex((channel) => channel.id === activeChannel),
        );
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const next = navigable[
          (currentIndex + direction + navigable.length) % navigable.length
        ];
        if (next) {
          event.preventDefault();
          setActiveChannel(next.id);
          setMobileChannels(false);
        }
        return;
      }
      if (
        event.code === "Space" &&
        preferences.pushToTalk &&
        voiceConnected &&
        canSpeakInConnectedVoice &&
        !typing
      ) {
        event.preventDefault();
        if (event.type === "keydown" && !event.repeat) {
          voiceStream.current?.getAudioTracks().forEach((track) => {
            track.enabled = true;
          });
          setPttPressed(true);
          setMuted(false);
        }
        if (event.type === "keyup") {
          voiceStream.current?.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setPttPressed(false);
          setMuted(true);
        }
      }
    }
    window.addEventListener("keydown", keyboardShortcut);
    window.addEventListener("keyup", keyboardShortcut);
    return () => {
      window.removeEventListener("keydown", keyboardShortcut);
      window.removeEventListener("keyup", keyboardShortcut);
    };
  }, [activeChannel, canSpeakInConnectedVoice, channels, preferences.pushToTalk, voiceConnected]);

  useEffect(() => {
    const connections = peerConnections.current;
    return () => {
      voiceStream.current?.getTracks().forEach((track) => track.stop());
      displayStream.current?.getTracks().forEach((track) => track.stop());
      connections.forEach((connection) => connection.close());
      connections.clear();
    };
  }, []);

  const sendRtcSignal = useCallback(async (
    recipientProfileId: string,
    type: RtcSignal["type"],
    payload: unknown,
  ) => {
    if (!connectedVoiceChannelId) return;
    const response = await apiFetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serverId: activeServerId,
        channelId: connectedVoiceChannelId,
        recipientProfileId,
        type,
        payload,
      }),
    });
    if (!response.ok) {
      throw new Error(await responseError(response, "Ses bağlantısı kurulamadı."));
    }
  }, [activeServerId, connectedVoiceChannelId]);

  const closePeer = useCallback((profileId: string) => {
    peerConnections.current.get(profileId)?.close();
    peerConnections.current.delete(profileId);
    pendingIce.current.delete(profileId);
    setRemoteStreams((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
  }, []);

  const negotiatePeer = useCallback(async (profileId: string, connection: RTCPeerConnection) => {
    if (makingOffers.current.has(profileId) || connection.signalingState !== "stable") return;
    makingOffers.current.add(profileId);
    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await sendRtcSignal(profileId, "offer", connection.localDescription);
    } finally {
      makingOffers.current.delete(profileId);
    }
  }, [sendRtcSignal]);

  const getOrCreatePeer = useCallback(async (profileId: string, initiate = false) => {
    const existing = peerConnections.current.get(profileId);
    if (existing) return existing;
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
      bundlePolicy: "max-bundle",
    });
    peerConnections.current.set(profileId, connection);

    for (const stream of [voiceStream.current, displayStream.current]) {
      stream?.getTracks().forEach((track) => connection.addTrack(track, stream));
    }
    if (!voiceStream.current?.getAudioTracks().length) {
      connection.addTransceiver("audio", { direction: "recvonly" });
    }
    connection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        void sendRtcSignal(profileId, "ice", event.candidate.toJSON()).catch(() => undefined);
      }
    });
    connection.addEventListener("track", (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams((current) => ({ ...current, [profileId]: stream }));
    });
    connection.addEventListener("connectionstatechange", () => {
      if (["failed", "closed"].includes(connection.connectionState)) closePeer(profileId);
    });
    if (initiate) await negotiatePeer(profileId, connection);
    return connection;
  }, [closePeer, negotiatePeer, sendRtcSignal]);

  const applyRtcSignal = useCallback(async (signal: RtcSignal) => {
    const payload = JSON.parse(signal.payload) as
      | RTCSessionDescriptionInit
      | RTCIceCandidateInit;
    if (signal.type === "offer") {
      const connection = await getOrCreatePeer(signal.senderProfileId);
      await connection.setRemoteDescription(payload as RTCSessionDescriptionInit);
      const queued = pendingIce.current.get(signal.senderProfileId) || [];
      for (const candidate of queued) await connection.addIceCandidate(candidate);
      pendingIce.current.delete(signal.senderProfileId);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await sendRtcSignal(signal.senderProfileId, "answer", connection.localDescription);
      return;
    }
    const connection = await getOrCreatePeer(signal.senderProfileId);
    if (signal.type === "answer") {
      if (connection.signalingState === "have-local-offer") {
        await connection.setRemoteDescription(payload as RTCSessionDescriptionInit);
        const queued = pendingIce.current.get(signal.senderProfileId) || [];
        for (const candidate of queued) await connection.addIceCandidate(candidate);
        pendingIce.current.delete(signal.senderProfileId);
      }
      return;
    }
    const candidate = payload as RTCIceCandidateInit;
    if (connection.remoteDescription) {
      await connection.addIceCandidate(candidate);
    } else {
      const queued = pendingIce.current.get(signal.senderProfileId) || [];
      queued.push(candidate);
      pendingIce.current.set(signal.senderProfileId, queued.slice(-50));
    }
  }, [getOrCreatePeer, sendRtcSignal]);

  useEffect(() => {
    if (!voiceConnected || !profile || !connectedVoiceChannelId) {
      peerConnections.current.forEach((_, profileId) => closePeer(profileId));
      rtcSyncAt.current = new Date(Date.now() - 30_000).toISOString();
      rtcChannelId.current = null;
      return;
    }
    if (rtcChannelId.current !== connectedVoiceChannelId) {
      peerConnections.current.forEach((_, profileId) => closePeer(profileId));
      rtcSyncAt.current = new Date(Date.now() - 30_000).toISOString();
      rtcChannelId.current = connectedVoiceChannelId;
    }
    const participantIds = new Set(
      members
        .filter(
          (member) =>
            member.voiceChannelId === connectedVoiceChannelId && member.id !== profile.id,
        )
        .map((member) => member.id),
    );
    peerConnections.current.forEach((_, profileId) => {
      if (!participantIds.has(profileId)) closePeer(profileId);
    });
    for (const profileId of participantIds) {
      const initiator = profile.id.localeCompare(profileId) < 0;
      void getOrCreatePeer(profileId, initiator).catch(() => closePeer(profileId));
    }

    let stopped = false;
    async function pollSignals() {
      const query = new URLSearchParams({
        server: activeServerId,
        channel: connectedVoiceChannelId,
        after: rtcSyncAt.current,
      });
      const response = await apiFetch(`/api/rtc?${query.toString()}`);
      if (!response.ok || stopped) return;
      const data = (await response.json()) as {
        signals?: RtcSignal[];
        syncedAt?: string;
      };
      for (const signal of data.signals || []) {
        if (stopped) break;
        await applyRtcSignal(signal).catch(() => closePeer(signal.senderProfileId));
      }
      if (data.syncedAt) rtcSyncAt.current = data.syncedAt;
    }
    void pollSignals();
    const timer = window.setInterval(() => void pollSignals(), 1_200);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeServerId, applyRtcSignal, closePeer, connectedVoiceChannelId, getOrCreatePeer, members, profile, voiceConnected]);

  async function leaveVoice(showToast = true) {
    await apiFetch("/api/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serverId: activeServerId,
        voiceChannelId: null,
        sharing: false,
      }),
    }).catch(() => undefined);
    voiceStream.current?.getTracks().forEach((track) => track.stop());
    voiceStream.current = null;
    displayStream.current?.getTracks().forEach((track) => track.stop());
    displayStream.current = null;
    if (previewVideo.current) previewVideo.current.srcObject = null;
    setSharing(false);
    setPttPressed(false);
    peerConnections.current.forEach((_, profileId) => closePeer(profileId));
    setVoiceConnected(false);
    setConnectedVoiceChannelId(null);
    if (showToast) setToast({ text: "Sesli odadan ayrıldın." });
  }

  async function joinVoice(channel: Channel) {
    if (channel.kind !== "voice") return;
    if (((channel.permissions ?? permissions) & 64) === 0) {
      setToast({ text: "Bu ses odasına katılma yetkin yok.", tone: "danger" });
      return;
    }
    const canSpeak = ((channel.permissions ?? permissions) & 1024) !== 0;
    if (voiceConnected && connectedVoiceChannelId === channel.id) return;

    try {
      if (voiceConnected && connectedVoiceChannelId !== channel.id && displayStream.current) {
        displayStream.current.getTracks().forEach((track) => track.stop());
        displayStream.current = null;
        if (previewVideo.current) previewVideo.current.srcObject = null;
      }
      let stream = voiceStream.current;
      if (!canSpeak) {
        stream?.getTracks().forEach((track) => track.stop());
        stream = new MediaStream();
        voiceStream.current = stream;
      } else if (!stream || !stream.getAudioTracks().length) {
        stream?.getTracks().forEach((track) => track.stop());
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(preferences.inputDeviceId
              ? { deviceId: { exact: preferences.inputDeviceId } }
              : {}),
            echoCancellation: preferences.echoCancellation,
            noiseSuppression: preferences.noiseSuppression,
            autoGainControl: preferences.autoGainControl,
          },
        });
        voiceStream.current = stream;
      }
      const presence = await apiFetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverId: activeServerId,
          voiceChannelId: channel.id,
          sharing: false,
        }),
      });
      if (!presence.ok) {
        if (!voiceConnected) {
          stream.getTracks().forEach((track) => track.stop());
          voiceStream.current = null;
        }
        throw new Error(await responseError(presence, "Ses odasına bağlanılamadı."));
      }
      peerConnections.current.forEach((_, profileId) => closePeer(profileId));
      rtcSyncAt.current = new Date(Date.now() - 30_000).toISOString();
      rtcChannelId.current = channel.id;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = canSpeak && !preferences.pushToTalk;
      });
      setConnectedVoiceChannelId(channel.id);
      setVoiceConnected(true);
      setMuted(!canSpeak || preferences.pushToTalk);
      setPttPressed(false);
      setSharing(false);
      setToast({
        text: canSpeak
          ? voiceConnected
            ? `${channel.name} ses odasına geçtin.`
            : `${channel.name} ses odasına katıldın.`
          : `${channel.name} odasına dinleyici olarak katıldın.`,
        tone: "success",
      });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Mikrofon izni verilmedi.",
        tone: "danger",
      });
    }
  }

  async function toggleVoice() {
    if (voiceConnected) {
      await leaveVoice();
      return;
    }
    if (selected?.kind === "voice") await joinVoice(selected);
  }

  function toggleMute() {
    if (!canSpeakInConnectedVoice) {
      setToast({ text: "Bu odada konuşma yetkin yok. Dinleyici modundasın.", tone: "danger" });
      return;
    }
    if (preferences.pushToTalk) {
      setToast({ text: "Bas-konuş açık: konuşmak için Boşluk tuşunu basılı tut." });
      return;
    }
    const next = !muted;
    voiceStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }

  async function toggleShare() {
    if (!sharing && !canShareInConnectedVoice) {
      setToast({ text: "Bu odada ekran paylaşma yetkin yok.", tone: "danger" });
      return;
    }
    if (sharing) {
      const tracks = displayStream.current?.getTracks() || [];
      peerConnections.current.forEach((connection, profileId) => {
        connection.getSenders().forEach((sender) => {
          if (sender.track && tracks.some((track) => track.id === sender.track?.id)) {
            connection.removeTrack(sender);
          }
        });
        void negotiatePeer(profileId, connection).catch(() => undefined);
      });
      displayStream.current?.getTracks().forEach((track) => track.stop());
      displayStream.current = null;
      if (previewVideo.current) previewVideo.current.srcObject = null;
      setSharing(false);
      await apiFetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverId: activeServerId,
          voiceChannelId: connectedVoiceChannelId,
          sharing: false,
        }),
      }).catch(() => undefined);
      return;
    }

    if (!voiceConnected || !connectedVoiceChannelId) {
      setToast({ text: "Önce bir ses odasına bağlanmalısın.", tone: "danger" });
      return;
    }
    if ((permissions & 128) === 0) {
      setToast({ text: "Ekran paylaşma yetkin yok.", tone: "danger" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: {
            ideal: auraMembership?.active ? 60 : 30,
            max: auraMembership?.active ? 60 : 30,
          },
          width: { ideal: auraMembership?.active ? 1920 : 1280 },
          height: { ideal: auraMembership?.active ? 1080 : 720 },
        },
        audio: true,
      });
      displayStream.current = stream;
      if (previewVideo.current) {
        previewVideo.current.srcObject = stream;
      }
      peerConnections.current.forEach((connection, profileId) => {
        stream.getTracks().forEach((track) => connection.addTrack(track, stream));
        void negotiatePeer(profileId, connection).catch(() => undefined);
      });
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (displayStream.current) void toggleShare();
      });
      const presence = await apiFetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverId: activeServerId,
          voiceChannelId: connectedVoiceChannelId,
          sharing: true,
        }),
      });
      if (!presence.ok) throw new Error(await responseError(presence, "Ekran paylaşımı başlatılamadı."));
      setSharing(true);
      setToast({ text: "Ekran paylaşımı başladı.", tone: "success" });
    } catch (error) {
      displayStream.current?.getTracks().forEach((track) => track.stop());
      displayStream.current = null;
      setToast({
        text: error instanceof Error ? error.message : "Ekran paylaşımı iptal edildi.",
        tone: "danger",
      });
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || selected?.kind !== "text") return;

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      channelId: activeChannel,
      authorName: profile?.displayName || "Savaş",
      authorTag: `@${profile?.username || "savas"}`,
      content,
      replyToId: replyingTo?.id || null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setReplyingTo(null);

    try {
      const response = await apiFetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channelId: activeChannel,
          serverId: activeServerId,
          content,
          replyToId: optimistic.replyToId,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Mesaj gönderilemedi."));
      const data = (await response.json()) as { message: ChatMessage };
      setMessages((current) =>
        current.map((message) => (message.id === optimistic.id ? data.message : message)),
      );
      if (guideServerId === activeServerId && !guideCompletedSteps.includes("hello")) {
        void completeGuideStep("hello");
      }
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setToast({
        text: error instanceof Error ? error.message : "Mesaj gönderilemedi.",
        tone: "danger",
      });
    }
  }

  async function reloadCurrentMessages() {
    if (selected?.kind !== "text") return;
    const query = new URLSearchParams({
      channel: activeChannel,
      server: activeServerId,
    });
    const response = await apiFetch(`/api/messages?${query.toString()}`);
    if (!response.ok) return;
    const data = (await response.json()) as { messages?: ChatMessage[] };
    setMessages((current) => [
      ...current.filter((message) => message.channelId !== activeChannel),
      ...(data.messages || []),
    ]);
  }

  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const options = pollOptionDrafts.map((option) => option.trim()).filter(Boolean);
    if (selected?.kind !== "text" || options.length < 2) return;
    setPollCreating(true);
    try {
      const response = await apiFetch("/api/polls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          serverId: activeServerId,
          channelId: activeChannel,
          question: pollQuestion,
          options,
          allowMultiple: pollAllowMultiple,
          durationHours: pollDurationHours,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Anket oluşturulamadı."));
      setPollQuestion("");
      setPollOptionDrafts(["", ""]);
      setPollAllowMultiple(false);
      setPollDurationHours(24);
      setModal(null);
      await reloadCurrentMessages();
      setToast({ text: "Anket yayınlandı.", tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Anket oluşturulamadı.",
        tone: "danger",
      });
    } finally {
      setPollCreating(false);
    }
  }

  async function votePoll(pollId: string, optionId: string) {
    const response = await apiFetch("/api/polls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "vote", pollId, optionId }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Oy kaydedilemedi."), tone: "danger" });
      return;
    }
    await reloadCurrentMessages();
  }

  async function closePoll(pollId: string) {
    const response = await apiFetch("/api/polls", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pollId }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Anket sonlandırılamadı."), tone: "danger" });
      return;
    }
    await reloadCurrentMessages();
    setToast({ text: "Anket sonlandırıldı.", tone: "success" });
  }

  async function openThread(threadId: string) {
    setModal("thread");
    setThreadLoading(true);
    try {
      const response = await apiFetch(
        `/api/threads?thread=${encodeURIComponent(threadId)}`,
      );
      if (!response.ok) throw new Error(await responseError(response, "Konu başlığı yüklenemedi."));
      const data = (await response.json()) as {
        thread?: ThreadDetail;
        replies?: ThreadReply[];
        canManage?: boolean;
      };
      setActiveThread(data.thread || null);
      setThreadReplies(data.replies || []);
      setThreadCanManage(Boolean(data.canManage));
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Konu başlığı yüklenemedi.",
        tone: "danger",
      });
    } finally {
      setThreadLoading(false);
    }
  }

  async function createThread(message: ChatMessage) {
    const title = window.prompt("Konu başlığının adı", message.content.slice(0, 60))?.trim();
    if (!title) return;
    const response = await apiFetch("/api/threads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create",
        serverId: activeServerId,
        channelId: message.channelId,
        parentMessageId: message.id,
        title,
      }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Konu başlığı açılamadı."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as { thread: ThreadDetail };
    await reloadCurrentMessages();
    await openThread(data.thread.id);
  }

  async function sendThreadReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeThread || !threadDraft.trim()) return;
    const content = threadDraft.trim();
    setThreadDraft("");
    const response = await apiFetch("/api/threads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reply", threadId: activeThread.id, content }),
    });
    if (!response.ok) {
      setThreadDraft(content);
      setToast({ text: await responseError(response, "Yanıt gönderilemedi."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as { reply: ThreadReply };
    setThreadReplies((current) => [...current, data.reply]);
    void reloadCurrentMessages();
  }

  async function updateThreadState(next: { locked?: boolean; archived?: boolean }) {
    if (!activeThread) return;
    const response = await apiFetch("/api/threads", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: activeThread.id, ...next }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Konu başlığı güncellenemedi."), tone: "danger" });
      return;
    }
    setActiveThread((current) => current ? { ...current, ...next } : current);
    void reloadCurrentMessages();
  }

  async function deleteThreadReply(reply: ThreadReply) {
    const response = await apiFetch("/api/threads", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: reply.id }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Yanıt silinemedi."), tone: "danger" });
      return;
    }
    setThreadReplies((current) =>
      current.map((item) =>
        item.id === reply.id ? { ...item, content: "", deletedAt: new Date().toISOString() } : item,
      ),
    );
  }

  async function editMessage(message: ChatMessage) {
    if (message.deletedAt) return;
    const content = window.prompt("Mesajı düzenle", message.content)?.trim();
    if (!content || content === message.content) return;
    const response = await apiFetch("/api/messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: message.id, serverId: activeServerId, content }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Mesaj düzenlenemedi."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as { message: ChatMessage };
    setMessages((current) =>
      current.map((item) => (item.id === message.id ? data.message : item)),
    );
    setToast({ text: "Mesaj düzenlendi.", tone: "success" });
  }

  async function deleteMessage(message: ChatMessage) {
    if (message.deletedAt || !window.confirm("Bu mesaj silinsin mi?")) return;
    const response = await apiFetch("/api/messages", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: message.id, serverId: activeServerId }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Mesaj silinemedi."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as { deletedAt: string };
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? { ...item, content: "Mesaj silindi.", deletedAt: data.deletedAt, editedAt: null }
          : item,
      ),
    );
  }

  function openContextMenu(
    event: ReactMouseEvent,
    item: Omit<ContextMenuState, "x" | "y">,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      ...item,
      x: Math.min(event.clientX, window.innerWidth - 230),
      y: Math.min(event.clientY, window.innerHeight - 360),
    });
  }

  function insertMention(tag: string) {
    setDraft((current) => {
      if (/(?:^|\s)@[a-z0-9_]*$/i.test(current)) {
        return `${current.replace(/@[a-z0-9_]*$/i, tag)} `;
      }
      return `${current}${current && !current.endsWith(" ") ? " " : ""}${tag} `;
    });
    setContextMenu(null);
  }

  async function toggleReaction(message: ChatMessage, emoji: string) {
    const response = await apiFetch("/api/reactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serverId: activeServerId,
        messageId: message.id,
        emoji,
      }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Tepki eklenemedi."), tone: "danger" });
      return;
    }
    const { active } = (await response.json()) as { active: boolean };
    setMessages((current) =>
      current.map((item) => {
        if (item.id !== message.id) return item;
        const reactions = [...(item.reactions || [])];
        const existing = reactions.find((reaction) => reaction.emoji === emoji);
        if (existing) {
          existing.count += active ? 1 : -1;
          existing.reactedByMe = active;
          return { ...item, reactions: reactions.filter((reaction) => reaction.count > 0) };
        }
        return {
          ...item,
          reactions: active
            ? [...reactions, { emoji, count: 1, reactedByMe: true }]
            : reactions,
        };
      }),
    );
  }

  async function togglePin(message: ChatMessage) {
    const response = await apiFetch("/api/messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: message.id,
        serverId: activeServerId,
        action: "pin",
        pinned: !message.pinned,
      }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Mesaj sabitlenemedi."), tone: "danger" });
      return;
    }
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, pinned: !message.pinned } : item,
      ),
    );
    setToast({ text: message.pinned ? "Sabitleme kaldırıldı." : "Mesaj sabitlendi.", tone: "success" });
  }

  async function copyMessageLink(message: ChatMessage) {
    const url = new URL(window.location.href);
    url.searchParams.set("sunucu", activeServerId);
    url.searchParams.set("kanal", message.channelId);
    url.hash = `mesaj-${message.id}`;
    await navigator.clipboard.writeText(url.toString());
    setToast({ text: "Mesaj bağlantısı kopyalandı.", tone: "success" });
  }

  async function requestFriend(member: Member) {
    const response = await apiFetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "request", username: member.tag.slice(1) }),
    });
    setToast({
      text: response.ok
        ? `${member.name} kullanıcısına arkadaşlık isteği gönderildi.`
        : await responseError(response, "Arkadaşlık isteği gönderilemedi."),
      tone: response.ok ? "success" : "danger",
    });
  }

  async function openChannelSettings(channel: Channel) {
    setActiveChannel(channel.id);
    setChannelSettingsName(channel.name);
    setChannelSettingsTopic(channel.topic || "");
    setChannelSlowMode(channel.slowModeSeconds || 0);
    setChannelBitrate(channel.bitrate || 64_000);
    setChannelUserLimit(channel.userLimit || 0);
    setChannelRegion(channel.region || "auto");
    setChannelPermissionRoles([]);
    setChannelPermissionOverwrites([]);
    setContextMenu(null);
    setModal("channelSettings");
    setChannelPermissionsLoading(true);
    try {
      const response = await apiFetch(
        `/api/channel-permissions?server=${encodeURIComponent(activeServerId)}&channel=${encodeURIComponent(channel.id)}`,
      );
      if (!response.ok) {
        throw new Error(
          await responseError(response, "Oda izinleri yüklenemedi."),
        );
      }
      const data = (await response.json()) as {
        roles?: Role[];
        overwrites?: ChannelPermissionOverwrite[];
      };
      setChannelPermissionRoles(data.roles || []);
      setChannelPermissionOverwrites(data.overwrites || []);
    } catch (error) {
      setToast({
        text:
          error instanceof Error ? error.message : "Oda izinleri yüklenemedi.",
        tone: "danger",
      });
    } finally {
      setChannelPermissionsLoading(false);
    }
  }

  function setChannelRolePermission(
    roleId: string,
    bit: number,
    state: "inherit" | "allow" | "deny",
  ) {
    setChannelPermissionOverwrites((current) => {
      const existing = current.find((item) => item.roleId === roleId) || {
        channelId: activeChannel,
        roleId,
        allowPermissions: 0,
        denyPermissions: 0,
      };
      let allowPermissions = existing.allowPermissions & ~bit;
      let denyPermissions = existing.denyPermissions & ~bit;
      if (state === "allow") allowPermissions |= bit;
      if (state === "deny") denyPermissions |= bit;
      const next = {
        ...existing,
        allowPermissions,
        denyPermissions,
      };
      return current.some((item) => item.roleId === roleId)
        ? current.map((item) => (item.roleId === roleId ? next : item))
        : [...current, next];
    });
  }

  function openChannelNotifications(channel: Channel) {
    if (channel.kind !== "text") {
      setToast({ text: "Ses odalarında yalnızca canlı bağlantı bildirimleri kullanılır." });
      return;
    }
    setNotificationChannel(channel);
    setNotificationLevel(channel.notificationLevel || "mentions");
    setNotificationShowUnread(Boolean(channel.showUnread));
    setContextMenu(null);
    setModal("channelNotifications");
  }

  async function saveChannelNotifications(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!notificationChannel) return;
    const response = await apiFetch("/api/channel-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "settings",
        serverId: activeServerId,
        channelId: notificationChannel.id,
        level: notificationLevel,
        showUnread: notificationShowUnread,
      }),
    });
    if (!response.ok) {
      setToast({
        text: await responseError(response, "Bildirim ayarları kaydedilemedi."),
        tone: "danger",
      });
      return;
    }
    setChannels((current) =>
      current.map((channel) =>
        channel.id === notificationChannel.id
          ? {
              ...channel,
              notificationLevel,
              showUnread: notificationShowUnread,
            }
          : channel,
      ),
    );
    setModal(null);
    setToast({ text: `#${notificationChannel.name} bildirimleri güncellendi.`, tone: "success" });
  }

  async function markChannelRead(channel: Channel) {
    if (channel.kind !== "text") return;
    setChannels((current) =>
      current.map((item) =>
        item.id === channel.id ? { ...item, unreadCount: 0, mentionCount: 0 } : item,
      ),
    );
    await apiFetch("/api/channel-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "read",
        serverId: activeServerId,
        channelId: channel.id,
      }),
    }).catch(() => undefined);
  }

  async function openAuditLog() {
    setModal("auditLog");
    setAuditLoading(true);
    try {
      const response = await apiFetch(
        `/api/audit-log?server=${encodeURIComponent(activeServerId)}`,
      );
      if (!response.ok) throw new Error(await responseError(response, "Denetim kaydı yüklenemedi."));
      const data = (await response.json()) as { entries?: AuditEntry[] };
      setAuditEntries(data.entries || []);
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Denetim kaydı yüklenemedi.",
        tone: "danger",
      });
    } finally {
      setAuditLoading(false);
    }
  }

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const response = await apiFetch(
        `/api/events?server=${encodeURIComponent(activeServerId)}`,
      );
      if (!response.ok) throw new Error(await responseError(response, "Etkinlikler yüklenemedi."));
      const data = (await response.json()) as {
        events?: CommunityEvent[];
        canManage?: boolean;
      };
      setCommunityEvents(data.events || []);
      setEventsCanManage(Boolean(data.canManage));
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Etkinlikler yüklenemedi.",
        tone: "danger",
      });
    } finally {
      setEventsLoading(false);
    }
  }, [activeServerId]);

  function openEvents() {
    setContextMenu(null);
    setEventSelectedDay("");
    setModal("events");
    void loadEvents();
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEventCreating(true);
    try {
      const response = await apiFetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          serverId: activeServerId,
          channelId: eventChannelId || null,
          title: eventTitle,
          description: eventDescription,
          location: eventLocation,
          startsAt: new Date(eventStartsAt).toISOString(),
          endsAt: new Date(eventEndsAt).toISOString(),
          recurrence: eventRecurrence,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Etkinlik oluşturulamadı."));
      setEventTitle("");
      setEventDescription("");
      setEventLocation("");
      setEventRecurrence("none");
      setEventStartsAt(dateTimeInputValue(new Date(Date.now() + 60 * 60_000)));
      setEventEndsAt(dateTimeInputValue(new Date(Date.now() + 2 * 60 * 60_000)));
      await loadEvents();
      setToast({ text: "Etkinlik takvime eklendi.", tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Etkinlik oluşturulamadı.",
        tone: "danger",
      });
    } finally {
      setEventCreating(false);
    }
  }

  async function rsvpEvent(
    item: CommunityEvent,
    responseValue: "going" | "interested" | "declined",
    reminderMinutes = item.myRsvp?.reminderMinutes ?? 30,
  ) {
    const response = await apiFetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "rsvp",
        serverId: activeServerId,
        id: item.id,
        response: responseValue,
        reminderMinutes,
      }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Katılım yanıtı kaydedilemedi."), tone: "danger" });
      return;
    }
    await loadEvents();
    setToast({ text: "Katılım ve hatırlatma tercihin kaydedildi.", tone: "success" });
  }

  async function cancelEvent(item: CommunityEvent) {
    const response = await apiFetch("/api/events", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serverId: activeServerId, id: item.id }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Etkinlik iptal edilemedi."), tone: "danger" });
      return;
    }
    await loadEvents();
    setToast({ text: "Etkinlik iptal edildi.", tone: "success" });
  }

  function downloadEventCalendar(item: CommunityEvent, startsAt: string, endsAt: string) {
    const stamp = (value: string) =>
      new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escape = (value: string) =>
      value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,");
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Kuzens//Etkinlik//TR",
      "BEGIN:VEVENT",
      `UID:${item.id}@kuzens`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(startsAt)}`,
      `DTEND:${stamp(endsAt)}`,
      `SUMMARY:${escape(item.title)}`,
      `DESCRIPTION:${escape(item.description || `${activeServer.name} etkinliği`)}`,
      item.location ? `LOCATION:${escape(item.location)}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.title.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/gi, "-") || "kuzens-etkinlik"}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function openAutoMod() {
    setContextMenu(null);
    setModal("automod");
    setAutoModLoading(true);
    try {
      const response = await apiFetch(
        `/api/automod?server=${encodeURIComponent(activeServerId)}`,
      );
      if (!response.ok) throw new Error(await responseError(response, "AutoMod ayarları yüklenemedi."));
      const data = (await response.json()) as { settings?: AutoModSettings };
      if (data.settings) setAutoModSettings(data.settings);
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "AutoMod ayarları yüklenemedi.",
        tone: "danger",
      });
    } finally {
      setAutoModLoading(false);
    }
  }

  async function saveAutoMod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAutoModSaving(true);
    try {
      const response = await apiFetch("/api/automod", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverId: activeServerId, ...autoModSettings }),
      });
      if (!response.ok) throw new Error(await responseError(response, "AutoMod ayarları kaydedilemedi."));
      const data = (await response.json()) as { settings?: AutoModSettings };
      if (data.settings) setAutoModSettings(data.settings);
      setToast({ text: "AutoMod kuralları etkinleştirildi.", tone: "success" });
      setModal(null);
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "AutoMod ayarları kaydedilemedi.",
        tone: "danger",
      });
    } finally {
      setAutoModSaving(false);
    }
  }

  async function loadBookmarks() {
    setBookmarksLoading(true);
    try {
      const response = await apiFetch("/api/bookmarks");
      if (!response.ok) throw new Error(await responseError(response, "Kayıtlı mesajlar yüklenemedi."));
      const data = (await response.json()) as { bookmarks?: SavedMessage[] };
      setSavedMessages(data.bookmarks || []);
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Kayıtlı mesajlar yüklenemedi.",
        tone: "danger",
      });
    } finally {
      setBookmarksLoading(false);
    }
  }

  function openBookmarks() {
    setModal("bookmarks");
    void loadBookmarks();
  }

  async function saveBookmark(message: ChatMessage) {
    const response = await apiFetch("/api/bookmarks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: message.id, note: "", remindAt: null }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Mesaj kaydedilemedi."), tone: "danger" });
      return;
    }
    setContextMenu(null);
    setToast({ text: "Mesaj Sonra Bak listene eklendi.", tone: "success" });
    void loadBookmarks();
  }

  async function updateBookmark(
    item: SavedMessage,
    reminderMinutes: number | null | undefined,
    note = item.note,
  ) {
    const remindAt =
      reminderMinutes === undefined
        ? item.remindAt || null
        : reminderMinutes === null
        ? null
        : new Date(Date.now() + reminderMinutes * 60_000).toISOString();
    const response = await apiFetch("/api/bookmarks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: item.messageId, note, remindAt }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Kayıt güncellenemedi."), tone: "danger" });
      return;
    }
    await loadBookmarks();
    setToast({ text: typeof reminderMinutes === "number" ? "Hatırlatma ayarlandı." : "Kayıt güncellendi.", tone: "success" });
  }

  async function removeBookmark(item: SavedMessage) {
    const response = await apiFetch("/api/bookmarks", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: item.messageId }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Kayıt kaldırılamadı."), tone: "danger" });
      return;
    }
    setSavedMessages((current) => current.filter((saved) => saved.id !== item.id));
    setToast({ text: "Mesaj kayıtlılardan çıkarıldı.", tone: "success" });
  }

  async function jumpToBookmark(item: SavedMessage) {
    if (item.message.serverId !== activeServerId) {
      await chooseServer(item.message.serverId);
    }
    setActiveChannel(item.message.channelId);
    setModal(null);
    window.setTimeout(() => {
      document.getElementById(`mesaj-${item.messageId}`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }, 650);
  }

  async function openServerGuide() {
    setGuideServerId(activeServerId);
    setModal("guide");
    setGuideLoading(true);
    try {
      const response = await apiFetch(
        `/api/server-guide?server=${encodeURIComponent(activeServerId)}`,
      );
      if (!response.ok) throw new Error(await responseError(response, "Başlangıç rehberi yüklenemedi."));
      const data = (await response.json()) as {
        guide?: ServerGuideData;
        completedSteps?: string[];
        canManage?: boolean;
      };
      if (data.guide) setServerGuide(data.guide);
      setGuideCompletedSteps(data.completedSteps || []);
      setGuideCanManage(Boolean(data.canManage));
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Başlangıç rehberi yüklenemedi.",
        tone: "danger",
      });
    } finally {
      setGuideLoading(false);
    }
  }

  async function completeGuideStep(step: "rules" | "favorite" | "hello") {
    const response = await apiFetch("/api/server-guide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "progress", serverId: activeServerId, step }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Rehber adımı kaydedilemedi."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as { completedSteps?: string[]; completedAt?: string | null };
    setGuideCompletedSteps(data.completedSteps || []);
    if (data.completedAt) {
      setToast({ text: "Başlangıç rehberini tamamladın. Kuzens’e hoş geldin!", tone: "success" });
    }
  }

  async function saveServerGuide() {
    setGuideSaving(true);
    try {
      const response = await apiFetch("/api/server-guide", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverId: activeServerId, ...serverGuide }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Rehber ayarları kaydedilemedi."));
      setToast({ text: "Başlangıç rehberi güncellendi.", tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Rehber ayarları kaydedilemedi.",
        tone: "danger",
      });
    } finally {
      setGuideSaving(false);
    }
  }

  async function saveChannelSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const response = await apiFetch("/api/channels", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        serverId: activeServerId,
        name: channelSettingsName,
        topic: channelSettingsTopic,
        slowModeSeconds: channelSlowMode,
        bitrate: channelBitrate,
        userLimit: channelUserLimit,
        region: channelRegion,
      }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Kanal ayarları kaydedilemedi."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as { channel: Channel };
    const permissionsResponse = await apiFetch("/api/channel-permissions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serverId: activeServerId,
        channelId: selected.id,
        overwrites: channelPermissionOverwrites.map((overwrite) => ({
          roleId: overwrite.roleId,
          allowPermissions: overwrite.allowPermissions,
          denyPermissions: overwrite.denyPermissions,
        })),
      }),
    });
    if (!permissionsResponse.ok) {
      setToast({
        text: await responseError(
          permissionsResponse,
          "Oda izinleri kaydedilemedi.",
        ),
        tone: "danger",
      });
      return;
    }
    setChannels((current) =>
      current.map((channel) => (channel.id === data.channel.id ? data.channel : channel)),
    );
    setModal(null);
    setToast({ text: "Kanal ayarları kaydedildi.", tone: "success" });
  }

  async function duplicateChannel(channel: Channel) {
    const response = await apiFetch("/api/channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `${channel.name}-kopya`.slice(0, 32),
        kind: channel.kind,
        serverId: activeServerId,
      }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Kanal çoğaltılamadı."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as { channel: Channel };
    setChannels((current) => [...current, data.channel]);
    setToast({ text: "Kanal çoğaltıldı.", tone: "success" });
  }

  async function loadNotifications() {
    const response = await apiFetch("/api/notifications");
    if (!response.ok) return;
    const data = (await response.json()) as { notifications?: MentionNotification[] };
    setNotifications(data.notifications || []);
  }

  async function openNotification(notification: MentionNotification) {
    await apiFetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: notification.id }),
    });
    if (notification.serverId !== activeServerId) {
      await chooseServer(notification.serverId);
    }
    setActiveChannel(notification.channelId);
    setModal(null);
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    window.setTimeout(() => {
      document.getElementById(`mesaj-${notification.messageId}`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }, 500);
  }

  function openProfileSettings() {
    if (!profile) return;
    setProfileDisplayName(profile.displayName);
    setProfileUsername(profile.username);
    setProfileBio(profile.bio || "");
    setProfileCustomStatus(profile.customStatus || "");
    setProfilePresence(profile.presenceStatus || "online");
    setProfileAvatarPreview(profile.avatarUrl || null);
    setProfileAvatarDataUrl(null);
    setProfileRemoveAvatar(false);
    setModal("profile");
  }

  async function selectProfileAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5_000_000) {
      setToast({ text: "PNG, JPEG veya WebP biçiminde en fazla 5 MB bir fotoğraf seç.", tone: "danger" });
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const side = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
      bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("image"))),
          "image/webp",
          0.84,
        ),
      );
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      setProfileAvatarPreview(dataUrl);
      setProfileAvatarDataUrl(dataUrl);
      setProfileRemoveAvatar(false);
    } catch {
      setToast({ text: "Fotoğraf işlenemedi. Başka bir görsel dene.", tone: "danger" });
    }
  }

  async function openPreferences() {
    setModal("preferences");
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
    } catch {
      setAudioDevices([]);
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (voiceConnected) {
        const replacement = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(preferences.inputDeviceId
              ? { deviceId: { exact: preferences.inputDeviceId } }
              : {}),
            echoCancellation: preferences.echoCancellation,
            noiseSuppression: preferences.noiseSuppression,
            autoGainControl: preferences.autoGainControl,
          },
        });
        replacement.getAudioTracks().forEach((track) => {
          track.enabled = preferences.pushToTalk ? pttPressed : !muted;
        });
        const nextTrack = replacement.getAudioTracks()[0];
        if (nextTrack) {
          await Promise.all(
            Array.from(peerConnections.current.values()).map(async (connection) => {
              const sender = connection.getSenders().find((item) => item.track?.kind === "audio");
              if (sender) await sender.replaceTrack(nextTrack);
            }),
          );
        }
        voiceStream.current?.getTracks().forEach((track) => track.stop());
        voiceStream.current = replacement;
      }
      setModal(null);
      setToast({ text: "Görünüm ve ses tercihlerin bu cihazda kaydedildi.", tone: "success" });
    } catch {
      setToast({ text: "Seçilen mikrofon açılamadı. Sistem varsayılanını deneyebilirsin.", tone: "danger" });
    }
  }

  function openMemberProfile(member: Member) {
    setViewingMember(member);
    setModal("memberProfile");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaving(true);
    try {
      const response = await apiFetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: profileDisplayName,
          username: profileUsername,
          bio: profileBio,
          customStatus: profileCustomStatus,
          presenceStatus: profilePresence,
          avatarDataUrl: profileAvatarDataUrl || undefined,
          removeAvatar: profileRemoveAvatar,
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Profil kaydedilemedi."));
      }
      const data = (await response.json()) as { profile: Profile };
      setProfile(data.profile);
      setModal(null);
      setToast({ text: "Profil ve durumun güncellendi.", tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Profil kaydedilemedi.",
        tone: "danger",
      });
    } finally {
      setProfileSaving(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !profile ||
      accountDeleteUsername !== profile.username ||
      accountDeleteConfirmation !== "HESABIMI SİL" ||
      !window.confirm(
        "Kuzens hesabın ve kişisel verilerin kalıcı olarak silinecek. Devam edilsin mi?",
      )
    ) {
      return;
    }
    setAccountDeleting(true);
    try {
      const response = await apiFetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: accountDeleteUsername,
          confirmation: accountDeleteConfirmation,
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Hesap silinemedi."));
      }
      setProfile(null);
      setModal(null);
      window.location.reload();
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Hesap silinemedi.",
        tone: "danger",
      });
    } finally {
      setAccountDeleting(false);
    }
  }

  async function createChannel(event: FormEvent) {
    event.preventDefault();
    const name = newChannelName.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, "-");
    if (!name) return;
    const optimistic: Channel = {
      id: `${name}-${Date.now()}`,
      serverId: activeServerId,
      name,
      kind: newChannelKind,
      position: channels.length,
    };
    setChannels((current) => [...current, optimistic]);
    setModal(null);
    setNewChannelName("");
    setActiveChannel(optimistic.id);

    try {
      const response = await apiFetch("/api/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, kind: newChannelKind, serverId: activeServerId }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Oda oluşturulamadı."));
      const data = (await response.json()) as { channel: Channel };
      setChannels((current) =>
        current.map((channel) => (channel.id === optimistic.id ? data.channel : channel)),
      );
      setActiveChannel(data.channel.id);
      setToast({ text: `#${data.channel.name} oluşturuldu.`, tone: "success" });
    } catch (error) {
      setChannels((current) => current.filter((channel) => channel.id !== optimistic.id));
      setActiveChannel(channels[0]?.id || "genel");
      setToast({
        text: error instanceof Error ? error.message : "Oda oluşturulamadı.",
        tone: "danger",
      });
    }
  }

  async function deleteChannel(channel: Channel | undefined = selected) {
    if (!channel || !canManageChannels || !window.confirm(`#${channel.name} silinsin mi?`)) {
      return;
    }
    if (connectedVoiceChannelId === channel.id) await leaveVoice(false);
    const response = await apiFetch("/api/channels", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: channel.id, serverId: activeServerId }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Oda silinemedi."), tone: "danger" });
      return;
    }
    setChannels((current) => current.filter((item) => item.id !== channel.id));
    setActiveChannel(
      channels.find((item) => item.id !== channel.id)?.id || "genel",
    );
    setToast({ text: "Oda silindi.", tone: "success" });
  }

  async function registerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegistrationSubmitting(true);
    setRegistrationError("");
    const form = new FormData(event.currentTarget);

    try {
      const inviteCode = new URLSearchParams(window.location.search).get("davet");
      const response = await apiFetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: registrationName,
          username: registrationUsername,
          inviteCode,
          birthConfirmed: form.get("birthConfirmed") === "on",
          termsAccepted: form.get("termsAccepted") === "on",
          noticeRead: form.get("noticeRead") === "on",
          communityAccepted: form.get("communityAccepted") === "on",
        }),
      });
      const data = (await response.json()) as { profile?: Profile; error?: string };
      if (!response.ok || !data.profile) {
        throw new Error(data.error || "Kayıt tamamlanamadı.");
      }
      setProfile(data.profile);
      setToast({ text: "Kuzens hesabın hazır. Hoş geldin!", tone: "success" });
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : "Kayıt tamamlanamadı.");
    } finally {
      setRegistrationSubmitting(false);
    }
  }

  async function openRoles() {
    setModal("roles");
    setRolesLoading(true);
    setRolesCanManage(false);
    try {
      const response = await apiFetch(
        `/api/roles?server=${encodeURIComponent(activeServerId)}`,
      );
      if (!response.ok) throw new Error(await responseError(response, "Yetkiler yüklenemedi."));
      const data = (await response.json()) as {
        roles?: Role[];
        assignments?: RoleAssignment[];
        canManage?: boolean;
      };
      const nextRoles = data.roles || [];
      setRoleItems(nextRoles);
      setRoleAssignments(data.assignments || []);
      setRolesCanManage(Boolean(data.canManage));
      setSelectedRoleId(nextRoles[0]?.id || "");
    } catch {
      setToast({ text: "Yetkiler şu anda yüklenemedi.", tone: "danger" });
    } finally {
      setRolesLoading(false);
    }
  }

  function toggleRolePermission(bit: number) {
    setRoleItems((current) =>
      current.map((role) => {
        if (role.id !== selectedRoleId || role.id.endsWith(":owner")) return role;
        return { ...role, permissions: role.permissions ^ bit };
      }),
    );
  }

  function toggleMemberRole(memberTag: string, roleId: string) {
    setRoleAssignments((current) => {
      const exists = current.some(
        (item) => item.memberTag === memberTag && item.roleId === roleId,
      );
      if (exists) {
        return current.filter(
          (item) => !(item.memberTag === memberTag && item.roleId === roleId),
        );
      }
      return [
        ...current,
        {
          id: `${activeServerId}:${memberTag}:${roleId}`,
          serverId: activeServerId,
          memberTag,
          roleId,
        },
      ];
    });
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newRoleName.trim()) return;
    setRolesSaving(true);
    try {
      const response = await apiFetch("/api/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          serverId: activeServerId,
          name: newRoleName,
          color: newRoleColor,
          permissions: 768,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Rol oluşturulamadı."));
      const data = (await response.json()) as { role: Role };
      setRoleItems((current) => [...current, data.role]);
      setSelectedRoleId(data.role.id);
      setNewRoleName("");
      setToast({ text: `${data.role.name} rolü oluşturuldu.`, tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Rol oluşturulamadı.",
        tone: "danger",
      });
    } finally {
      setRolesSaving(false);
    }
  }

  async function deleteSelectedRole() {
    if (
      !selectedRole ||
      !selectedRole.id.includes(":custom:") ||
      !window.confirm(`${selectedRole.name} rolü silinsin mi?`)
    ) {
      return;
    }
    setRolesSaving(true);
    try {
      const response = await apiFetch("/api/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          serverId: activeServerId,
          roleId: selectedRole.id,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Rol silinemedi."));
      setRoleAssignments((current) =>
        current.filter((assignment) => assignment.roleId !== selectedRole.id),
      );
      const nextRoles = roleItems.filter((role) => role.id !== selectedRole.id);
      setRoleItems(nextRoles);
      setSelectedRoleId(nextRoles[0]?.id || "");
      setToast({ text: "Rol ve bu role ait üye atamaları silindi.", tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Rol silinemedi.",
        tone: "danger",
      });
    } finally {
      setRolesSaving(false);
    }
  }

  async function saveRoles() {
    const selectedRole = roleItems.find((role) => role.id === selectedRoleId);
    if (!selectedRole) return;
    setRolesSaving(true);
    try {
      const response = await apiFetch("/api/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          serverId: activeServerId,
          roleId: selectedRole.id,
          name: selectedRole.name,
          color: selectedRole.color,
          permissions: selectedRole.permissions,
          assignments: roleAssignments.map((assignment) => ({
            memberTag: assignment.memberTag,
            roleId: assignment.roleId,
          })),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Yetkiler kaydedilemedi.");
      setModal(null);
      setToast({ text: "Rol ve üye yetkileri kaydedildi.", tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Yetkiler kaydedilemedi.",
        tone: "danger",
      });
    } finally {
      setRolesSaving(false);
    }
  }

  async function loadDirectConversations(preferredId?: string) {
    setDirectLoading(true);
    try {
      const response = await apiFetch("/api/direct-messages");
      if (!response.ok) {
        throw new Error(await responseError(response, "Özel mesajlar yüklenemedi."));
      }
      const data = (await response.json()) as {
        conversations?: DirectConversation[];
        requests?: DirectConversation[];
        privacy?: "friends" | "shared_servers" | "none";
      };
      const conversations = data.conversations || [];
      const requests = data.requests || [];
      setDirectConversations(conversations);
      setDirectRequests(requests);
      setDirectPrivacy(data.privacy || "friends");
      setActiveDirectConversationId((current) => {
        const requested = preferredId || current;
        return [...conversations, ...requests].some((item) => item.id === requested)
          ? requested
          : conversations[0]?.id || "";
      });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Özel mesajlar yüklenemedi.",
        tone: "danger",
      });
    } finally {
      setDirectLoading(false);
    }
  }

  function openDirectMessages() {
    setModal("directMessages");
    void loadDirectConversations();
  }

  async function startDirectMessage(target: { tag?: string; username?: string; name?: string }) {
    const username = (target.username || target.tag || "").replace(/^@/, "");
    if (!username) return;
    const response = await apiFetch("/api/direct-messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start", username }),
    });
    if (!response.ok) {
      setToast({
        text: await responseError(response, "Özel konuşma başlatılamadı."),
        tone: "danger",
      });
      return;
    }
    const data = (await response.json()) as { conversation: DirectConversation };
    setDirectConversations((current) => [
      data.conversation,
      ...current.filter((item) => item.id !== data.conversation.id),
    ]);
    setActiveDirectConversationId(data.conversation.id);
    setDirectMessages([]);
    setModal("directMessages");
  }

  async function respondDirectRequest(
    conversation: DirectConversation,
    requestResponse: "accept" | "ignore",
  ) {
    const response = await apiFetch("/api/direct-messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "request",
        conversationId: conversation.id,
        requestResponse,
      }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Mesaj isteği yanıtlanamadı."), tone: "danger" });
      return;
    }
    if (requestResponse === "accept") {
      await loadDirectConversations(conversation.id);
      setToast({ text: "Mesaj isteği kabul edildi.", tone: "success" });
    } else {
      setActiveDirectConversationId("");
      setDirectMessages([]);
      await loadDirectConversations();
      setToast({ text: "Mesaj isteği gelen kutusundan kaldırıldı.", tone: "success" });
    }
  }

  async function sendDirectMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDirectConversation || !directDraft.trim()) return;
    const content = directDraft.trim();
    setDirectDraft("");
    const response = await apiFetch("/api/direct-messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "send",
        conversationId: activeDirectConversation.id,
        content,
      }),
    });
    if (!response.ok) {
      setDirectDraft(content);
      setToast({
        text: await responseError(response, "Özel mesaj gönderilemedi."),
        tone: "danger",
      });
      return;
    }
    const data = (await response.json()) as { message: DirectMessage };
    setDirectMessages((current) => [...current, data.message]);
    setDirectConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeDirectConversation.id
          ? { ...conversation, lastMessage: content, updatedAt: data.message.createdAt }
          : conversation,
      ),
    );
  }

  async function editDirectMessage(message: DirectMessage) {
    const content = window.prompt("Mesajı düzenle", message.content)?.trim();
    if (!content || content === message.content) return;
    const response = await apiFetch("/api/direct-messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: message.id, content }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Mesaj düzenlenemedi."), tone: "danger" });
      return;
    }
    setDirectMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? { ...item, content, editedAt: new Date().toISOString() }
          : item,
      ),
    );
  }

  async function deleteDirectMessage(message: DirectMessage) {
    if (!window.confirm("Bu özel mesaj silinsin mi?")) return;
    const response = await apiFetch("/api/direct-messages", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: message.id }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Mesaj silinemedi."), tone: "danger" });
      return;
    }
    setDirectMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? { ...item, content: "", deletedAt: new Date().toISOString() }
          : item,
      ),
    );
  }

  async function updateDirectPrivacy(value: "friends" | "shared_servers" | "none") {
    const previous = directPrivacy;
    setDirectPrivacy(value);
    const response = await apiFetch("/api/direct-messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "privacy", allowFrom: value }),
    });
    if (!response.ok) {
      setDirectPrivacy(previous);
      setToast({
        text: await responseError(response, "Özel mesaj gizliliği kaydedilemedi."),
        tone: "danger",
      });
      return;
    }
    setToast({ text: "Özel mesaj gizliliğin güncellendi.", tone: "success" });
  }

  async function loadFriends() {
    setFriendsLoading(true);
    try {
      const response = await apiFetch("/api/friends");
      if (!response.ok) throw new Error(await responseError(response, "Arkadaşlar yüklenemedi."));
      const data = (await response.json()) as { friends?: FriendItem[] };
      setFriendItems(data.friends || []);
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Arkadaşlar yüklenemedi.",
        tone: "danger",
      });
    } finally {
      setFriendsLoading(false);
    }
  }

  function openFriends() {
    setModal("friends");
    void loadFriends();
  }

  async function sendFriendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = friendUsername.trim();
    if (!username) return;
    const response = await apiFetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "request", username }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "İstek gönderilemedi."), tone: "danger" });
      return;
    }
    setFriendUsername("");
    setToast({ text: "Arkadaşlık isteği gönderildi.", tone: "success" });
    await loadFriends();
  }

  async function friendAction(
    action: "accept" | "remove" | "block",
    profileId: string,
  ) {
    const response = await apiFetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, profileId }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "İşlem tamamlanamadı."), tone: "danger" });
      return;
    }
    if (action === "block") {
      setDirectConversations((current) =>
        current.filter((conversation) => conversation.profile.id !== profileId),
      );
      setModal(null);
      setToast({ text: "Kullanıcı engellendi; mesajları ve bildirimleri artık gizlenecek.", tone: "success" });
    }
    await loadFriends();
  }

  async function moderateMember(
    member: Member | BannedMember,
    action: "kick" | "ban" | "unban",
  ) {
    const label =
      action === "kick"
        ? `${member.name} topluluktan çıkarılsın mı?`
        : action === "ban"
          ? `${member.name} yasaklansın mı? Yeniden davetle katılamaz.`
          : `${member.name} kullanıcısının yasağı kaldırılsın mı?`;
    if (!window.confirm(label)) return;
    const reason =
      action === "ban"
        ? window.prompt("Yasaklama nedeni", "Topluluk kuralları ihlali")?.trim()
        : undefined;
    if (action === "ban" && reason === undefined) return;
    const response = await apiFetch("/api/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serverId: activeServerId,
        profileId: member.id,
        action,
        reason,
      }),
    });
    if (!response.ok) {
      setToast({
        text: await responseError(response, "Moderasyon işlemi tamamlanamadı."),
        tone: "danger",
      });
      return;
    }
    if (action === "unban") {
      setBannedMembers((current) => current.filter((item) => item.id !== member.id));
    } else {
      setMembers((current) => current.filter((item) => item.id !== member.id));
      if (action === "ban") {
        setBannedMembers((current) => [
          ...current.filter((item) => item.id !== member.id),
          {
            id: member.id,
            name: member.name,
            tag: "tag" in member ? member.tag : "",
            reason: reason || "Topluluk kuralları ihlali",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    }
    setToast({
      text:
        action === "kick"
          ? "Üye topluluktan çıkarıldı."
          : action === "ban"
            ? "Üye yasaklandı."
            : "Üyenin yasağı kaldırıldı.",
      tone: "success",
    });
  }

  async function copyInvite() {
    try {
      const response = await apiFetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", serverId: activeServerId }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Davet oluşturulamadı."));
      const data = (await response.json()) as { url: string };
      await navigator.clipboard.writeText(data.url);
      setToast({ text: "Davet bağlantısı kopyalandı.", tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Davet oluşturulamadı.",
        tone: "danger",
      });
    }
  }

  async function loadAura() {
    const response = await apiFetch(`/api/aura?serverId=${encodeURIComponent(activeServerId)}`);
    if (!response.ok) {
      setToast({ text: await responseError(response, "Aura bilgileri yüklenemedi."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as {
      membership?: AuraMembership | null;
      serverMembership?: ServerAuraMembership | null;
      perks?: string[];
      serverPerks?: string[];
      owner?: {
        codes?: AuraCode[];
        memberships?: AuraOwnerMembership[];
        servers?: AuraOwnerServer[];
      };
    };
    setAuraMembership(data.membership || null);
    setServerAuraMembership(data.serverMembership || null);
    setAuraPerks(data.perks || []);
    setServerAuraPerks(data.serverPerks || []);
    setAuraCodes(data.owner?.codes || []);
    setAuraMembers(data.owner?.memberships || []);
    setAuraServers(data.owner?.servers || []);
  }

  function openAura() {
    setFreshAuraCode("");
    setModal("aura");
    void loadAura();
  }

  async function auraAction(payload: Record<string, unknown>, successMessage: string) {
    setAuraBusy(true);
    try {
      const response = await apiFetch("/api/aura", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
      };
      if (!response.ok) throw new Error(data.error || "Aura işlemi tamamlanamadı.");
      if (data.code) {
        setFreshAuraCode(data.code);
        await navigator.clipboard.writeText(data.code).catch(() => undefined);
      }
      await loadAura();
      setToast({ text: successMessage, tone: "success" });
      return true;
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Aura işlemi tamamlanamadı.",
        tone: "danger",
      });
      return false;
    } finally {
      setAuraBusy(false);
    }
  }

  async function redeemAura(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await auraAction(
      { action: "redeem", code: auraRedeemCode },
      "Kuzens Aura hesabında etkinleştirildi.",
    );
    if (ok) setAuraRedeemCode("");
  }

  async function createAuraCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await auraAction(
      {
        action: "create-code",
        durationDays: auraCodeDuration,
        maxUses: auraMaxUses,
      },
      "Yeni Aura kodu üretildi ve panoya kopyalandı.",
    );
  }

  async function grantAura(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await auraAction(
      {
        action: "grant",
        username: auraGrantUsername,
        durationDays: auraDuration === 0 ? null : auraDuration,
      },
      `@${auraGrantUsername.replace(/^@/, "")} için Aura tanımlandı.`,
    );
    if (ok) setAuraGrantUsername("");
  }

  async function grantServerAura() {
    await auraAction(
      {
        action: "grant-server",
        serverId: activeServerId,
        tier: auraServerTier,
        durationDays: auraDuration === 0 ? null : auraDuration,
      },
      `${activeServer.name} için Aura Topluluk ${auraServerTier} etkinleştirildi.`,
    );
  }

  async function revokeServerAura() {
    await auraAction(
      { action: "revoke-server", serverId: activeServerId },
      `${activeServer.name} için Aura Topluluk kaldırıldı.`,
    );
  }

  async function createServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newServerName.trim();
    if (!name) return;
    const response = await apiFetch("/api/servers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Topluluk kurulamadı."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as { server: CommunityServer };
    setServers((current) => [...current, data.server]);
    setNewServerName("");
    setModal(null);
    setActiveServerId(data.server.id);
    setToast({ text: `${data.server.name} topluluğu hazır.`, tone: "success" });
  }

  function openServerSettings() {
    if (!canManageServer) {
      setToast({ text: "Topluluk ayarlarını düzenleme yetkin yok.", tone: "danger" });
      return;
    }
    setServerSettingsName(activeServer.name);
    setServerSettingsIcon(activeServer.icon);
    setServerSettingsDescription(activeServer.description || "");
    setServerDefaultNotifications(activeServer.defaultNotificationLevel || "mentions");
    setServerExplicitFilter(activeServer.explicitContentFilter !== false);
    setServerPreferredLocale(activeServer.preferredLocale || "tr");
    setServerSystemChannelId(activeServer.systemChannelId || "");
    setContextMenu(null);
    setModal("serverSettings");
  }

  async function saveServerSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerSaving(true);
    try {
      const response = await apiFetch("/api/servers", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: activeServerId,
          name: serverSettingsName,
          icon: serverSettingsIcon,
          description: serverSettingsDescription,
          defaultNotificationLevel: serverDefaultNotifications,
          explicitContentFilter: serverExplicitFilter,
          preferredLocale: serverPreferredLocale,
          systemChannelId: serverSystemChannelId || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Topluluk ayarları kaydedilemedi."));
      }
      const data = (await response.json()) as { server: CommunityServer };
      setServers((current) =>
        current.map((server) => (server.id === data.server.id ? data.server : server)),
      );
      setModal(null);
      setToast({ text: "Topluluk ayarları kaydedildi.", tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Topluluk ayarları kaydedilemedi.",
        tone: "danger",
      });
    } finally {
      setServerSaving(false);
    }
  }

  async function deleteActiveServer() {
    if (
      activeServerId === "kuzens" ||
      !ownsActiveServer ||
      !window.confirm(`${activeServer.name} topluluğu ve tüm mesajları kalıcı olarak silinsin mi?`)
    ) {
      return;
    }
    if (voiceConnected) await toggleVoice();
    const response = await apiFetch("/api/servers", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: activeServerId }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Topluluk silinemedi."), tone: "danger" });
      return;
    }
    const nextServers = servers.filter((server) => server.id !== activeServerId);
    setServers(nextServers);
    setActiveServerId(nextServers[0]?.id || "kuzens");
    setToast({ text: "Topluluk silindi.", tone: "success" });
  }

  async function chooseServer(serverId: string) {
    if (serverId === activeServerId) return;
    if (voiceConnected) await leaveVoice(false);
    setActiveServerId(serverId);
    setMessages([]);
    setMembers([]);
    setPermissions(0);
    setShowPinnedOnly(false);
  }

  async function chooseChannel(channel: Channel) {
    setActiveChannel(channel.id);
    setMobileChannels(false);
    if (channel.kind === "voice") await joinVoice(channel);
    else await markChannelRead(channel);
  }

  function toggleFavoriteChannel(channel: Channel) {
    setFavoriteChannelIds((current) => {
      const next = new Set(current);
      if (next.has(channel.id)) next.delete(channel.id);
      else next.add(channel.id);
      return next;
    });
    setContextMenu(null);
    setToast({
      text: favoriteChannelIds.has(channel.id)
        ? `#${channel.name} favorilerden çıkarıldı.`
        : `#${channel.name} favorilere eklendi.`,
      tone: "success",
    });
  }

  async function reorderChannel(channel: Channel, direction: -1 | 1) {
    const ordered = [...channels].sort((a, b) => a.position - b.position);
    const sameKind = ordered.filter((item) => item.kind === channel.kind);
    const currentKindIndex = sameKind.findIndex((item) => item.id === channel.id);
    const target = sameKind[currentKindIndex + direction];
    if (!target) {
      setToast({ text: direction < 0 ? "Oda zaten bölümün en üstünde." : "Oda zaten bölümün en altında." });
      return;
    }
    const fromIndex = ordered.findIndex((item) => item.id === channel.id);
    const toIndex = ordered.findIndex((item) => item.id === target.id);
    [ordered[fromIndex], ordered[toIndex]] = [ordered[toIndex], ordered[fromIndex]];
    const response = await apiFetch("/api/channels", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "reorder",
        serverId: activeServerId,
        orderedIds: ordered.map((item) => item.id),
      }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Oda sırası değiştirilemedi."), tone: "danger" });
      return;
    }
    setChannels(ordered.map((item, position) => ({ ...item, position })));
    setContextMenu(null);
    setToast({ text: `#${channel.name} ${direction < 0 ? "yukarı" : "aşağı"} taşındı.`, tone: "success" });
  }

  return (
    <main
      className={`app-shell app-shell-v3 font-${preferences.fontSize} density-${preferences.density} ${preferences.highContrast ? "high-contrast" : ""} ${preferences.reducedMotion ? "reduce-motion" : ""}`}
    >
      {splashVisible && (
        <div className="kuzens-splash" role="status" aria-live="polite">
          {/* Pixel-art must stay unprocessed so its hard edges remain intentional. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kuzens-loading-v1.webp" alt="" />
          <div className="splash-vignette" />
          <div className="splash-copy">
            <span className="splash-brand"><b>K</b><i>Z</i></span>
            <small>KUZENS · AURA GATE</small>
            <h1>Kuzenlerinle buluşuyorsun.</h1>
            <p>Odalar, mesajlar ve ses bağlantın hazırlanıyor.</p>
            <div className="splash-progress"><i /></div>
          </div>
        </div>
      )}
      <aside className="server-rail" aria-label="Sunucular">
        <button className="brand-mark" aria-label="Kuzens ana sayfa">
          <span>K</span><b>Z</b>
        </button>
        <div className="rail-line" />
        {servers.map((server) => (
          <button
            className={`server-badge ${server.id === activeServerId ? "active" : ""} ${server.id === activeServerId && serverAuraMembership?.active ? "aura-server-badge" : ""}`}
            aria-label={`${server.name} topluluğu`}
            key={server.id}
            onClick={() => void chooseServer(server.id)}
            onContextMenu={(event) =>
              openContextMenu(event, { kind: "server" })
            }
          >
            {server.icon}
            {server.id === activeServerId && <i />}
          </button>
        ))}
        <button className="server-badge direct" aria-label="Özel mesajlar" onClick={openDirectMessages}>
          M
          {directUnreadCount > 0 && <b className="rail-unread">{Math.min(99, directUnreadCount)}</b>}
        </button>
        <button className="server-badge friends" aria-label="Arkadaşlar" onClick={openFriends}>
          A
        </button>
        <button className="server-add" aria-label="Topluluk kur" onClick={() => setModal("server")}>
          +
        </button>
        <div className="rail-spacer" />
        <a className="rail-help" href="/hukuk" aria-label="Hukuk ve güven merkezi">
          ?
        </a>
      </aside>

      <aside className={`channel-sidebar ${mobileChannels ? "mobile-open" : ""}`}>
        <header
          className="server-header"
          onContextMenu={(event) => openContextMenu(event, { kind: "server" })}
        >
          <div>
            <span className="eyebrow">KUZENS TOPLULUĞU</span>
            <strong>
              {activeServer.name}
              {serverAuraMembership?.active && <i className="server-aura-chip">AURA {serverAuraMembership.tier}</i>}
            </strong>
            <small className="server-description">
              {activeServer.description || "Birlikte konuş, üret ve paylaş."}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Topluluk ayarları"
            onClick={canManageServer ? openServerSettings : openRoles}
          >
            •••
          </button>
        </header>

        <section className="community-hub-card">
          <div>
            <span>KUZENS NOVA</span>
            <strong>Topluluğun kumanda merkezi</strong>
            <small>Davetleri, rolleri ve odaları tek yerden yönet.</small>
          </div>
          <button onClick={copyInvite}>Davet bağlantısı <b>↗</b></button>
        </section>
        <div className="sidebar-utility-grid">
          <button onClick={openEvents}><span>◫</span><b>Etkinlik</b></button>
          <button onClick={() => void openServerGuide()}><span>✓</span><b>Rehber</b></button>
          <button onClick={openRoles}><span>♢</span><b>Roller</b></button>
          {canManageServer && <button onClick={openServerSettings}><span>⚙</span><b>Ayarlar</b></button>}
          <button className="aura-entry" onClick={openAura}><span>✦</span><b>Aura</b></button>
          {ownsActiveServer && activeServerId !== "kuzens" && (
            <button className="danger-utility" onClick={() => void deleteActiveServer()}><span>×</span><b>Sil</b></button>
          )}
        </div>

        <nav className="channel-scroll" aria-label="Odalar">
          {favoriteChannels.length > 0 && (
            <div className="channel-section favorite-channels">
              <div className="section-label"><span>FAVORİLERİM</span><b>★</b></div>
              {favoriteChannels.map((channel) => (
                <button
                  className={`channel-row ${activeChannel === channel.id ? "active" : ""}`}
                  key={`favorite-${channel.id}`}
                  onClick={() => chooseChannel(channel)}
                  onContextMenu={(event) => openContextMenu(event, { kind: "channel", channel })}
                >
                  <span className="channel-symbol">{channel.kind === "text" ? "#" : "◖"}</span>
                  <span>{channel.name}</span>
                  {Boolean(channel.mentionCount && channel.notificationLevel !== "none") && (
                    <em className="mention-badge">{Math.min(99, channel.mentionCount || 0)}</em>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="channel-section">
            <div className="section-label">
              <span>METİN ODALARI</span>
              {canManageChannels && (
                <button aria-label="Metin odası oluştur" onClick={() => { setNewChannelKind("text"); setModal("channel"); }}>+</button>
              )}
            </div>
            {textChannels.map((channel) => (
              <button
                className={`channel-row ${activeChannel === channel.id ? "active" : ""} ${channel.unreadCount && channel.showUnread && channel.notificationLevel !== "none" ? "unread" : ""}`}
                key={channel.id}
                onClick={() => chooseChannel(channel)}
                onContextMenu={(event) =>
                  openContextMenu(event, { kind: "channel", channel })
                }
              >
                <span className="channel-symbol">#</span>
                <span>{channel.name}</span>
                {Boolean(channel.mentionCount && channel.notificationLevel !== "none") && (
                  <em className="mention-badge">{Math.min(99, channel.mentionCount || 0)}</em>
                )}
                {!channel.mentionCount &&
                  Boolean(
                    channel.unreadCount &&
                      channel.showUnread &&
                      channel.notificationLevel !== "none",
                  ) && <i className={`unread-dot ${channel.notificationLevel}`} />}
              </button>
            ))}
          </div>

          <div className="channel-section">
            <div className="section-label">
              <span>SES ODALARI</span>
              {canManageChannels && (
                <button aria-label="Ses odası oluştur" onClick={() => { setNewChannelKind("voice"); setModal("channel"); }}>+</button>
              )}
            </div>
            {voiceChannels.map((channel) => (
              <div key={channel.id}>
                <button
                  className={`channel-row ${activeChannel === channel.id ? "active" : ""}`}
                  onClick={() => chooseChannel(channel)}
                  onContextMenu={(event) =>
                    openContextMenu(event, { kind: "channel", channel })
                  }
                >
                  <span className="channel-symbol">◖</span>
                  <span>{channel.name}</span>
                  {members.some((member) => member.voiceChannelId === channel.id) && (
                    <em className="live-dot">
                      {members.filter((member) => member.voiceChannelId === channel.id).length}
                    </em>
                  )}
                </button>
                {members.some((member) => member.voiceChannelId === channel.id) && (
                  <div className="voice-members">
                    {members
                      .filter((member) => member.voiceChannelId === channel.id)
                      .map((member) => (
                        <span
                          key={member.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openMemberProfile(member)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") openMemberProfile(member);
                          }}
                          onContextMenu={(event) =>
                            openContextMenu(event, { kind: "member", member })
                          }
                        >
                          <Avatar name={member.name} size="sm" tone={toneFor(member.id)} imageUrl={member.avatarUrl} />
                          {member.name}
                          {member.sharing && <i>YAYIN</i>}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        {voiceConnected && (
          <section className="voice-status">
            <div>
              <span className="signal-bars">▮▮▮</span>
              <div><strong>Ses bağlantısı iyi</strong><small>{connectedVoiceChannel?.name || "Ses odası"} / {activeServer.name}</small></div>
            </div>
            <button onClick={toggleVoice} aria-label="Sesli odadan ayrıl">×</button>
          </section>
        )}

        <footer className="user-dock" onDoubleClick={openProfileSettings}>
          <Avatar
            name={profile?.displayName || "Savaş"}
            tone="purple"
            imageUrl={profile?.avatarUrl}
            status={profile?.presenceStatus || "online"}
          />
          <button className="user-profile-button" onClick={openProfileSettings}>
            <strong>
              {profile?.displayName || "Savaş"}
              {auraMembership?.active && <i className="aura-mini-badge">AURA</i>}
            </strong>
            <small>{profile?.customStatus || `@${profile?.username || "savas"}`}</small>
          </button>
          <button
            className={muted ? "control-active" : ""}
            onClick={toggleMute}
            aria-label={preferences.pushToTalk ? "Bas-konuş açık" : "Mikrofonu aç veya kapat"}
            title={preferences.pushToTalk ? "Bas-konuş: Boşluk tuşunu basılı tut" : "Mikrofon"}
          >
            {preferences.pushToTalk ? "PTT" : "μ"}
          </button>
          <button className={deafened ? "control-active" : ""} onClick={() => setDeafened((value) => !value)} aria-label="Sesi aç veya kapat">◉</button>
          <button onClick={() => setModal("account")} aria-label="Kullanıcı ayarları">⚙</button>
        </footer>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <button className="mobile-menu" onClick={() => setMobileChannels((value) => !value)} aria-label="Odaları aç">
            ☰
          </button>
          <span className="header-channel-icon">{selected?.kind === "voice" ? "◖" : "#"}</span>
          <div className="channel-heading">
            <small className="nova-breadcrumb">{activeServer.name} / {selected?.kind === "voice" ? "SES ODASI" : "METİN ODASI"}</small>
            <strong>{selected?.name || "genel"}</strong>
            <span>
              {selected?.kind === "voice"
                ? selected.topic || "Sesli buluşma odası"
                : selected?.topic || "Kuzens topluluğunun ortak alanı"}
            </span>
          </div>
          <div className="header-spacer" />
          {selected?.kind === "voice" ? (
            <button className="join-voice" onClick={toggleVoice}>
              <span>{voiceConnected ? "×" : "◖"}</span>{voiceConnected ? "Ayrıl" : "Sese katıl"}
            </button>
          ) : (
            <div className="clear-actions">
              <button onClick={copyInvite}>Davet et</button>
              <button onClick={openRoles}>Yetkiler</button>
              {canManageChannels && (
                <>
                  <button onClick={() => selected && openChannelSettings(selected)}>Düzenle</button>
                  {selected?.id !== "genel" && (
                    <button onClick={() => void deleteChannel()}>Sil</button>
                  )}
                </>
              )}
            </div>
          )}
          {selected?.kind === "text" && (
            <button
              className={`notification-button ${showPinnedOnly ? "active" : ""}`}
              onClick={() => setShowPinnedOnly((value) => !value)}
              aria-label={showPinnedOnly ? "Tüm mesajları göster" : "Sabitlenen mesajları göster"}
              title="Sabitlenen mesajlar"
            >
              ⌖
            </button>
          )}
          <button
            className="notification-button"
            onClick={openBookmarks}
            aria-label={`Sonra Bak, ${bookmarkReminderCount} bekleyen hatırlatma`}
            title="Sonra Bak"
          >
            ☆
            {bookmarkReminderCount > 0 && <b>{Math.min(99, bookmarkReminderCount)}</b>}
          </button>
          <button
            className="notification-button"
            onClick={() => {
              setModal("notifications");
              void loadNotifications();
            }}
            aria-label={`Bildirimler, ${notifications.length} okunmamış`}
          >
            ♢
            {notifications.length > 0 && <b>{Math.min(99, notifications.length)}</b>}
          </button>
          <div className="search-wrap">
            <div className="search-box">
              <span>⌕</span>
              <input
                ref={searchInput}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                placeholder="Mesajlarda ara"
                aria-label="Mesajlarda ara"
              />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Aramayı temizle">×</button>}
              <kbd>Ctrl K</kbd>
            </div>
            {searchFocused && (
              <div className="search-guide">
                <span>GELİŞMİŞ ARAMA</span>
                <button onMouseDown={(event) => event.preventDefault()} onClick={() => setSearch("from:@")}>
                  <code>from:@kullanıcı</code><small>Belirli bir kişinin mesajları</small>
                </button>
                <button onMouseDown={(event) => event.preventDefault()} onClick={() => setSearch("has:link")}>
                  <code>has:link</code><small>Bağlantı içeren mesajlar</small>
                </button>
                <button onMouseDown={(event) => event.preventDefault()} onClick={() => setSearch("is:pinned")}>
                  <code>is:pinned</code><small>Sabitlenen mesajlar</small>
                </button>
                <button onMouseDown={(event) => event.preventDefault()} onClick={() => setSearch('after:2026-01-01 "tam ifade"')}>
                  <code>after:tarih &quot;tam ifade&quot;</code><small>Tarih ve birebir eşleşme</small>
                </button>
              </div>
            )}
          </div>
        </header>

        {selected?.kind === "voice" ? (
          <div className="voice-stage">
            <div className="voice-stage-head">
              <div>
                <span className="live-pill">CANLI</span>
                <h1>{selected.name}</h1>
                <p>{voiceRoomMembers.length} kişi bağlı · Uçtan uca WebRTC medya</p>
              </div>
              <div className="connection-grade"><i /> Bağlantı iyi</div>
            </div>

            <div className="speaker-grid">
              {visibleVoiceMembers.map((member) => (
                <article
                  className={`speaker-card ${member.id === profile?.id ? "speaking" : ""}`}
                  key={member.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openMemberProfile(member)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") openMemberProfile(member);
                  }}
                  onContextMenu={(event) =>
                    openContextMenu(event, { kind: "member", member })
                  }
                >
                  <div className="speaker-orbit">
                    <Avatar name={member.name} tone={toneFor(member.id)} size="lg" imageUrl={member.avatarUrl} status={member.presenceStatus || "online"} />
                  </div>
                  <strong>{member.name}</strong>
                  <span>{member.id === profile?.id ? "Sen" : memberStatus(member)}</span>
                  {member.id !== profile?.id && (
                    <label
                      className="member-volume"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <span>Ses</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((memberVolumes[member.id] ?? 1) * 100)}
                        onChange={(event) =>
                          setMemberVolumes((current) => ({
                            ...current,
                            [member.id]: Number(event.target.value) / 100,
                          }))
                        }
                        aria-label={`${member.name} ses düzeyi`}
                      />
                      <small>{Math.round((memberVolumes[member.id] ?? 1) * 100)}%</small>
                    </label>
                  )}
                </article>
              ))}
              <article className={`screen-card ${sharing ? "sharing" : ""}`}>
                {sharing ? (
                  <video ref={previewVideo} autoPlay muted playsInline />
                ) : remoteSharer ? (
                  <RemoteVideo
                    stream={remoteStreams[remoteSharer.id]}
                    label={remoteSharer.name}
                  />
                ) : (
                  <div>
                    <span>▣</span>
                    <strong>Ekranını paylaş</strong>
                    <p>Pencere, sekme veya tüm ekran</p>
                    <button onClick={toggleShare}>Paylaşımı başlat</button>
                  </div>
                )}
                {sharing && <button className="stop-share" onClick={toggleShare}>Paylaşımı durdur</button>}
              </article>
            </div>

            <div className="voice-controls">
              <button className={muted ? "danger" : ""} onClick={toggleMute}>
                <span>{preferences.pushToTalk ? "PTT" : "μ"}</span>
                {preferences.pushToTalk
                  ? pttPressed
                    ? "Konuşuyorsun"
                    : "Bas-konuş"
                  : muted
                    ? "Mikrofon kapalı"
                    : "Mikrofon"}
              </button>
              <button className={deafened ? "danger" : ""} onClick={() => setDeafened((value) => !value)}><span>◉</span>{deafened ? "Ses kapalı" : "Kulaklık"}</button>
              <button className={sharing ? "active" : ""} onClick={toggleShare}><span>▣</span>Ekran paylaş</button>
              <button className={voiceConnected ? "hangup" : "connect"} onClick={toggleVoice}><span>{voiceConnected ? "×" : "◖"}</span>{voiceConnected ? "Ayrıl" : "Bağlan"}</button>
            </div>
            <p className="privacy-note">Sesin tarayıcının yankı ve gürültü engellemesiyle işlenir. Kayıt yapılmaz.</p>
          </div>
        ) : (
          <>
            <div
              className="message-list"
              ref={messageList}
              onScroll={(event) => {
                const list = event.currentTarget;
                const atLatest =
                  list.scrollHeight - list.scrollTop - list.clientHeight < 96;
                stickToLatest.current = atLatest;
                if (atLatest) setShowJumpToLatest(false);
              }}
            >
              <section className="channel-intro">
                <span>#</span>
                <h1>#{selected?.name}</h1>
                <p>Burası #{selected?.name} odasının başlangıcı. Sohbete bir şeyler bırak.</p>
                <button onClick={copyInvite}>Arkadaşlarını davet et →</button>
              </section>

              {loadingMessages && <div className="sync-chip">Mesajlar eşitleniyor…</div>}
              {visibleMessages.map((message, index) => {
                const previous = visibleMessages[index - 1];
                const compact = previous?.authorTag === message.authorTag;
                return (
                  <article
                    id={`mesaj-${message.id}`}
                    className={`message ${compact ? "compact" : ""} ${message.mentionedMe ? "mentioned" : ""} ${message.pinned ? "pinned" : ""}`}
                    key={message.id}
                    onContextMenu={(event) =>
                      openContextMenu(event, { kind: "message", message })
                    }
                  >
                    {!compact && <Avatar name={message.authorName} imageUrl={message.authorAvatarUrl} tone={message.authorName === "Savaş" ? "purple" : message.authorName === "Ece" ? "pink" : message.authorName === "Batu" ? "blue" : "orange"} />}
                    <div className="message-content">
                      {!compact && (
                        <div className="message-meta">
                          <strong>{message.authorName}</strong>
                          <span>{message.authorTag}</span>
                          <time>{timeLabel(message.createdAt)}</time>
                        </div>
                      )}
                      {compact && <time className="compact-time">{timeLabel(message.createdAt)}</time>}
                      {message.replyToId && (
                        <button
                          className="message-reply"
                          onClick={() => {
                            const replied = messages.find((item) => item.id === message.replyToId);
                            if (replied) setReplyingTo(replied);
                          }}
                        >
                          ↩ {messages.find((item) => item.id === message.replyToId)?.authorName || "Mesaj"}:
                          {" "}
                          {messages.find((item) => item.id === message.replyToId)?.content.slice(0, 80) || "Önceki mesaj"}
                        </button>
                      )}
                      {message.blockedAuthor && !revealedBlockedMessages.has(message.id) ? (
                        <button
                          type="button"
                          className="blocked-message-reveal"
                          onClick={() =>
                            setRevealedBlockedMessages((current) => {
                              const next = new Set(current);
                              next.add(message.id);
                              return next;
                            })
                          }
                        >
                          <span>Engellenen kullanıcıdan mesaj</span>
                          <strong>Bir kez göster</strong>
                        </button>
                      ) : (
                        <>
                          {!message.poll && (
                            <p className={message.deletedAt ? "deleted-message" : ""}>
                              <MessageText
                                content={message.content}
                                members={members}
                                onMention={insertMention}
                              />
                              {message.editedAt && !message.deletedAt && <small> (düzenlendi)</small>}
                            </p>
                          )}
                          {!message.deletedAt && !message.poll && <LinkEmbed content={message.content} />}
                          {!message.deletedAt && message.poll && (
                            <PollCard
                              poll={message.poll}
                              onVote={(optionId) => void votePoll(message.poll!.id, optionId)}
                              onClose={() => void closePoll(message.poll!.id)}
                              canClose={
                                canManageMessages ||
                                message.authorProfileId === profile?.id ||
                                message.authorTag === `@${profile?.username}`
                              }
                            />
                          )}
                          {!message.deletedAt && Boolean(message.reactions?.length) && (
                            <div className="message-reactions">
                              {message.reactions?.map((reaction) => (
                                <button
                                  type="button"
                                  className={reaction.reactedByMe ? "active" : ""}
                                  key={reaction.emoji}
                                  onClick={() => void toggleReaction(message, reaction.emoji)}
                                >
                                  <span>{reaction.emoji}</span>
                                  {reaction.count}
                                </button>
                              ))}
                            </div>
                          )}
                          {!message.deletedAt && message.thread && (
                            <button
                              type="button"
                              className="thread-chip"
                              onClick={() => void openThread(message.thread!.id)}
                            >
                              <span>↳</span>
                              <div><strong>{message.thread.title}</strong><small>{message.thread.replyCount} yanıt · kalıcı konu</small></div>
                              <b>›</b>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {!message.blockedAuthor && !message.id.startsWith("local-") && !message.deletedAt && (
                      <div className="message-tools">
                        {!message.poll && (message.authorProfileId === profile?.id ||
                          message.authorTag === `@${profile?.username}`) && (
                          <button aria-label="Düzenle" onClick={() => void editMessage(message)}>✎</button>
                        )}
                        <button aria-label="Tepki ekle" onClick={() => void toggleReaction(message, "👍")}>☺</button>
                        <button aria-label="Yanıtla" onClick={() => setReplyingTo(message)}>↩</button>
                        {(canManageMessages ||
                          message.authorProfileId === profile?.id ||
                          message.authorTag === `@${profile?.username}`) && (
                          <button aria-label="Sil" onClick={() => void deleteMessage(message)}>×</button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
              {!visibleMessages.length && (
                <div className="empty-search">
                  <span>⌕</span>
                  <strong>Sonuç bulunamadı</strong>
                  <p>Başka bir kelimeyle aramayı dene.</p>
                </div>
              )}
            </div>

            {showJumpToLatest && (
              <button
                type="button"
                className="jump-latest"
                onClick={() => {
                  stickToLatest.current = true;
                  setShowJumpToLatest(false);
                  messageList.current?.scrollTo({
                    top: messageList.current.scrollHeight,
                    behavior: "smooth",
                  });
                }}
              >
                Yeni mesajlar <span>↓</span>
              </button>
            )}

            <form className="composer-wrap" onSubmit={sendMessage}>
              {mentionCandidates.length > 0 && (
                <div className="mention-suggestions">
                  <span>ETİKETLE</span>
                  {mentionCandidates.map((member) => (
                    <button
                      type="button"
                      key={member.id}
                      onClick={() => insertMention(member.tag)}
                    >
                      <Avatar name={member.name} tone={toneFor(member.id)} size="sm" imageUrl={member.avatarUrl} />
                      <span><strong>{member.name}</strong><small>{member.tag}</small></span>
                    </button>
                  ))}
                </div>
              )}
              {replyingTo ? (
                <div className="reply-hint active">
                  <span>↩</span> {replyingTo.authorName} kullanıcısına yanıt veriyorsun.
                  <button type="button" onClick={() => setReplyingTo(null)}>İptal</button>
                </div>
              ) : (
                <div className="reply-hint">
                  <span>✦</span> Kuzens’e hoş geldin — güzel bir şey söyle.
                  {(selected?.slowModeSeconds || 0) > 0 && (
                    <b> Yavaş mod: {selected?.slowModeSeconds} sn</b>
                  )}
                </div>
              )}
              <div className="composer">
                <button type="button" aria-label="Anket oluştur" title="Anket oluştur" onClick={() => setModal("poll")}>+</button>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  title="Taslak bu cihazda otomatik saklanır"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={`#${selected?.name} odasına mesaj gönder`}
                  rows={1}
                  aria-label="Mesaj"
                />
                <button type="button" className="composer-tool" aria-label="GIF">GIF</button>
                <button type="button" className="composer-tool" aria-label="Emoji">☺</button>
                <button className="send-button" type="submit" disabled={!draft.trim()} aria-label="Gönder">↑</button>
              </div>
            </form>
          </>
        )}
      </section>

      <aside className="member-sidebar">
        <div className="member-summary">
          <span><i /> {onlineMembers.length} çevrimiçi</span>
          <button onClick={copyInvite}>+ Davet et</button>
        </div>
        <div className="member-list">
          <span className="member-group">ÇEVRİMİÇİ — {onlineMembers.length}</span>
          {onlineMembers.map((member) => (
            <div
              className="member-row"
              key={member.id}
              role="button"
              tabIndex={0}
              onClick={() => openMemberProfile(member)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openMemberProfile(member);
              }}
              onContextMenu={(event) =>
                openContextMenu(event, { kind: "member", member })
              }
            >
              <Avatar name={member.name} tone={toneFor(member.id)} imageUrl={member.avatarUrl} status={member.presenceStatus || "online"} />
              <span className="member-copy"><strong>{member.name}</strong><small>{memberStatus(member)}</small></span>
              {member.id !== profile?.id && !member.role?.id.endsWith(":owner") && (
                <span className="member-moderation">
                  {canKickMembers && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void moderateMember(member, "kick");
                      }}
                      title="Topluluktan çıkar"
                      aria-label={`${member.name} kullanıcısını topluluktan çıkar`}
                    >
                      Çıkar
                    </button>
                  )}
                  {canBanMembers && (
                    <button
                      className="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        void moderateMember(member, "ban");
                      }}
                      title="Yasakla"
                      aria-label={`${member.name} kullanıcısını yasakla`}
                    >
                      Yasakla
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
          <span className="member-group">ÇEVRİMDIŞI — {offlineMembers.length}</span>
          {offlineMembers.map((member) => (
            <div
              className="member-row offline"
              key={member.id}
              role="button"
              tabIndex={0}
              onClick={() => openMemberProfile(member)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openMemberProfile(member);
              }}
              onContextMenu={(event) =>
                openContextMenu(event, { kind: "member", member })
              }
            >
              <Avatar name={member.name} tone={toneFor(member.id)} imageUrl={member.avatarUrl} status="offline" />
              <span className="member-copy"><strong>{member.name}</strong><small>{memberStatus(member)}</small></span>
              {member.id !== profile?.id && !member.role?.id.endsWith(":owner") && (
                <span className="member-moderation">
                  {canKickMembers && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void moderateMember(member, "kick");
                      }}
                      title="Topluluktan çıkar"
                      aria-label={`${member.name} kullanıcısını topluluktan çıkar`}
                    >
                      Çıkar
                    </button>
                  )}
                  {canBanMembers && (
                    <button
                      className="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        void moderateMember(member, "ban");
                      }}
                      title="Yasakla"
                      aria-label={`${member.name} kullanıcısını yasakla`}
                    >
                      Yasakla
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
          {canBanMembers && bannedMembers.length > 0 && (
            <>
              <span className="member-group">YASAKLILAR — {bannedMembers.length}</span>
              {bannedMembers.map((member) => (
                <div className="member-row banned" key={member.id}>
                  <Avatar name={member.name} tone={toneFor(member.id)} imageUrl={member.avatarUrl} status="offline" />
                  <span className="member-copy">
                    <strong>{member.name}</strong>
                    <small>{member.reason}</small>
                  </span>
                  <span className="member-moderation visible">
                    <button
                      onClick={() => void moderateMember(member, "unban")}
                      title="Yasağı kaldır"
                      aria-label={`${member.name} kullanıcısının yasağını kaldır`}
                    >
                      Kaldır
                    </button>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
        <article className="community-card">
          <span>✦</span>
          <strong>Topluluğu büyüt</strong>
          <p>Davet bağlantını paylaş, kuzenleri bir araya getir.</p>
          <button onClick={copyInvite}>Bağlantıyı kopyala</button>
        </article>
      </aside>

      <div className="remote-audio" aria-hidden="true">
        {Object.entries(remoteStreams).map(([memberId, stream]) => (
          <RemoteAudio
            key={memberId}
            stream={stream}
            muted={deafened}
            volume={memberVolumes[memberId] ?? 1}
          />
        ))}
      </div>

      {modal === "directMessages" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card direct-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <aside className="direct-sidebar">
              <div className="direct-title">
                <span className="eyebrow">ÖZEL MESAJLAR</span>
                <strong>Konuşmalar</strong>
              </div>
              <form
                className="direct-start"
                onSubmit={(event) => {
                  event.preventDefault();
                  void startDirectMessage({ username: directUsername });
                  setDirectUsername("");
                }}
              >
                <span>@</span>
                <input
                  value={directUsername}
                  onChange={(event) =>
                    setDirectUsername(
                      event.target.value
                        .toLocaleLowerCase("en-US")
                        .replace(/^@/, "")
                        .replace(/[^a-z0-9_]/g, ""),
                    )
                  }
                  placeholder="kullanıcı adı"
                  aria-label="Yeni özel mesaj kullanıcı adı"
                />
                <button disabled={directUsername.length < 3}>＋</button>
              </form>
              {directRequests.length > 0 && (
                <div className="direct-requests">
                  <span>MESAJ İSTEKLERİ <b>{directRequests.length}</b></span>
                  {directRequests.map((conversation) => (
                    <button
                      type="button"
                      key={conversation.id}
                      className={activeDirectRequest?.id === conversation.id ? "active" : ""}
                      onClick={() => {
                        setActiveDirectConversationId(conversation.id);
                        setDirectMessages([]);
                      }}
                    >
                      <Avatar name={conversation.profile.name} tone={toneFor(conversation.profile.id)} size="sm" imageUrl={conversation.profile.avatarUrl} />
                      <span><strong>{conversation.profile.name}</strong><small>İncelemek için aç</small></span>
                      <b>›</b>
                    </button>
                  ))}
                </div>
              )}
              <div className="direct-conversations">
                {directLoading ? (
                  <div className="roles-loading">Konuşmalar yükleniyor…</div>
                ) : directConversations.length ? (
                  directConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      className={activeDirectConversation?.id === conversation.id ? "active" : ""}
                      onClick={() => {
                        setActiveDirectConversationId(conversation.id);
                        setDirectMessages([]);
                      }}
                    >
                      <Avatar name={conversation.profile.name} tone={toneFor(conversation.profile.id)} imageUrl={conversation.profile.avatarUrl} />
                      <span>
                        <strong>{conversation.profile.name}</strong>
                        <small>{conversation.lastMessage}</small>
                      </span>
                      <time>{timeLabel(conversation.updatedAt)}</time>
                      {Boolean(conversation.unreadCount) && (
                        <b className="direct-unread">{Math.min(99, conversation.unreadCount || 0)}</b>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="direct-empty-list">
                    <span>✉</span>
                    <strong>Henüz konuşma yok</strong>
                    <small>Bir arkadaşının kullanıcı adıyla başla.</small>
                  </div>
                )}
              </div>
              <label className="direct-privacy">
                <span>Kim mesaj gönderebilir?</span>
                <select
                  value={directPrivacy}
                  onChange={(event) =>
                    void updateDirectPrivacy(
                      event.target.value as "friends" | "shared_servers" | "none",
                    )
                  }
                >
                  <option value="friends">Yalnızca arkadaşlar</option>
                  <option value="shared_servers">Ortak topluluktakiler · istek olarak</option>
                  <option value="none">Hiç kimse</option>
                </select>
              </label>
            </aside>

            <div className="direct-chat">
              {activeDirectConversation ? (
                <>
                  <header className="direct-chat-head">
                    <Avatar
                      name={activeDirectConversation.profile.name}
                      tone={toneFor(activeDirectConversation.profile.id)}
                      imageUrl={activeDirectConversation.profile.avatarUrl}
                      online={members.some(
                        (member) => member.id === activeDirectConversation.profile.id && member.online,
                      )}
                    />
                    <div>
                      <strong>{activeDirectConversation.profile.name}</strong>
                      <span>@{activeDirectConversation.profile.username}</span>
                    </div>
                    <button
                      onClick={() => {
                        const member = members.find(
                          (item) => item.id === activeDirectConversation.profile.id,
                        );
                        if (member) openMemberProfile(member);
                      }}
                      disabled={!members.some(
                        (item) => item.id === activeDirectConversation.profile.id,
                      )}
                    >
                      Profili gör
                    </button>
                  </header>
                  {activeDirectRequest && (
                    <div className="direct-request-gate">
                      <div>
                        <strong>Bu kişi arkadaşın değil</strong>
                        <span>Mesajları önizle; kabul edene kadar yanıt gönderilmez.</span>
                      </div>
                      <button type="button" onClick={() => void respondDirectRequest(activeDirectRequest, "ignore")}>
                        Görmezden gel
                      </button>
                      <button type="button" className="accept" onClick={() => void respondDirectRequest(activeDirectRequest, "accept")}>
                        Kabul et
                      </button>
                    </div>
                  )}
                  {!activeDirectRequest &&
                    activeDirectConversation.requestStatus === "pending" &&
                    activeDirectConversation.requestDirection === "outgoing" && (
                      <div className="direct-request-pending">
                        ◷ Mesaj isteği bekliyor · Kabul edilene kadar en fazla iki mesaj gönderebilirsin.
                      </div>
                    )}
                  <div className="direct-message-list" ref={directMessageList}>
                    <section className="direct-intro">
                      <Avatar
                        name={activeDirectConversation.profile.name}
                        tone={toneFor(activeDirectConversation.profile.id)}
                        size="lg"
                        imageUrl={activeDirectConversation.profile.avatarUrl}
                      />
                      <h3>{activeDirectConversation.profile.name}</h3>
                      <span>@{activeDirectConversation.profile.username}</span>
                      <p>{activeDirectConversation.profile.bio || "Özel konuşmanızın başlangıcı."}</p>
                    </section>
                    {directMessages.map((message, index) => {
                      const previous = directMessages[index - 1];
                      const compact =
                        previous?.authorProfileId === message.authorProfileId &&
                        new Date(message.createdAt).getTime() -
                          new Date(previous.createdAt).getTime() <
                          5 * 60_000;
                      return (
                        <article
                          key={message.id}
                          className={`direct-message ${compact ? "compact" : ""}`}
                        >
                          {!compact && (
                            <Avatar
                              name={message.authorName}
                              tone={toneFor(message.authorProfileId)}
                              size="sm"
                              imageUrl={message.authorAvatarUrl}
                            />
                          )}
                          <div>
                            {!compact && (
                              <header>
                                <strong>{message.authorName}</strong>
                                <time>{timeLabel(message.createdAt)}</time>
                              </header>
                            )}
                            <p className={message.deletedAt ? "deleted" : ""}>
                              {message.deletedAt ? "Bu mesaj silindi." : message.content}
                              {message.editedAt && !message.deletedAt && <small> · düzenlendi</small>}
                            </p>
                            {!message.deletedAt && message.content && <LinkEmbed content={message.content} />}
                          </div>
                          {message.authorProfileId === profile?.id && !message.deletedAt && (
                            <span className="direct-message-actions">
                              <button onClick={() => void editDirectMessage(message)}>Düzenle</button>
                              <button onClick={() => void deleteDirectMessage(message)}>Sil</button>
                            </span>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  {!activeDirectRequest && (
                    <form className="direct-composer" onSubmit={sendDirectMessage}>
                      <textarea
                        value={directDraft}
                        onChange={(event) => setDirectDraft(event.target.value)}
                        title="Taslak bu cihazda otomatik saklanır"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        maxLength={2000}
                        rows={1}
                        placeholder={`@${activeDirectConversation.profile.username} kişisine mesaj gönder`}
                      />
                      <button disabled={!directDraft.trim()}>Gönder</button>
                    </form>
                  )}
                </>
              ) : (
                <div className="direct-welcome">
                  <span>✉</span>
                  <h2>Kuzenlerinle özel konuş.</h2>
                  <p>Arkadaşlarınla birebir mesajlaş; gizlilik ayarına sen karar ver.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {modal === "friends" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card friends-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">ARKADAŞLAR</span>
            <h2>Kuzenlerini bul</h2>
            <p>Yalnızca tam kullanıcı adını bildiğin kişiye hedefli istek gönderilir.</p>
            <form className="friend-request-form" onSubmit={sendFriendRequest}>
              <div className="username-field">
                <span>@</span>
                <input
                  minLength={3}
                  maxLength={24}
                  value={friendUsername}
                  onChange={(event) =>
                    setFriendUsername(
                      event.target.value
                        .toLocaleLowerCase("en-US")
                        .replace(/^@/, "")
                        .replace(/[^a-z0-9_]/g, ""),
                    )
                  }
                  placeholder="kullanici_adi"
                  aria-label="Arkadaş kullanıcı adı"
                />
              </div>
              <button disabled={friendUsername.length < 3}>İstek gönder</button>
            </form>
            <div className="friend-list">
              {friendsLoading ? (
                <div className="roles-loading">Arkadaşlar yükleniyor…</div>
              ) : friendItems.length ? (
                friendItems
                  .filter((item) => item.status !== "blocked")
                  .map((item) => (
                    <article key={item.id}>
                      <Avatar
                        name={item.profile.name}
                        tone={toneFor(item.profile.id)}
                        imageUrl={item.profile.avatarUrl}
                        online={members.some(
                          (member) => member.id === item.profile.id && member.online,
                        )}
                      />
                      <span>
                        <strong>{item.profile.name}</strong>
                        <small>
                          {item.profile.tag} ·{" "}
                          {item.status === "accepted"
                            ? "Arkadaş"
                            : item.direction === "incoming"
                              ? "Sana istek gönderdi"
                              : "İstek bekliyor"}
                        </small>
                      </span>
                      <div>
                        {item.status === "accepted" && (
                          <button
                            onClick={() =>
                              void startDirectMessage({
                                username: item.profile.tag,
                                name: item.profile.name,
                              })
                            }
                          >
                            Mesaj
                          </button>
                        )}
                        {item.status === "pending" && item.direction === "incoming" && (
                          <button onClick={() => void friendAction("accept", item.profile.id)}>
                            Kabul et
                          </button>
                        )}
                        <button onClick={() => void friendAction("remove", item.profile.id)}>
                          Kaldır
                        </button>
                        <button
                          className="danger"
                          onClick={() => void friendAction("block", item.profile.id)}
                        >
                          Engelle
                        </button>
                      </div>
                    </article>
                  ))
              ) : (
                <div className="empty-search">
                  <span>☺</span>
                  <strong>Henüz arkadaşın yok</strong>
                  <p>Kullanıcı adıyla güvenli bir istek gönder.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {modal === "server" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form
            className="modal-card"
            onSubmit={createServer}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">YENİ TOPLULUK</span>
            <h2>Kendi alanını kur</h2>
            <p>İlk metin ve ses odaları, güvenli roller ve kurucu yetkileri otomatik hazırlanır.</p>
            <label className="field-label">
              TOPLULUK ADI
              <div>
                <span>K.</span>
                <input
                  autoFocus
                  minLength={2}
                  maxLength={40}
                  value={newServerName}
                  onChange={(event) => setNewServerName(event.target.value)}
                  placeholder="Oyun Ekibi"
                />
              </div>
            </label>
            <button className="primary-button" disabled={newServerName.trim().length < 2}>
              Topluluğu kur
            </button>
          </form>
        </div>
      )}

      {modal === "serverSettings" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form
            className="modal-card server-settings-modal"
            onSubmit={saveServerSettings}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <div className="server-settings-head">
              <div className="server-settings-icon">{serverSettingsIcon || "K"}</div>
              <div>
                <span className="eyebrow">TOPLULUK AYARLARI</span>
                <h2>{activeServer.name}</h2>
                <p>Kimlik, üyeler, odalar ve güvenlik tek merkezden yönetilir.</p>
              </div>
            </div>
            <div className="server-overview-grid">
              <label className="settings-field">
                <span>Topluluk adı</span>
                <input
                  required
                  minLength={2}
                  maxLength={40}
                  value={serverSettingsName}
                  onChange={(event) => setServerSettingsName(event.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Kısa simge</span>
                <input
                  required
                  minLength={1}
                  maxLength={3}
                  value={serverSettingsIcon}
                  onChange={(event) =>
                    setServerSettingsIcon(
                      event.target.value.toLocaleUpperCase("tr-TR").replace(/\s/g, ""),
                    )
                  }
                />
              </label>
            </div>
            <label className="settings-field server-description-field">
              <span>Topluluk açıklaması</span>
              <textarea
                maxLength={240}
                rows={3}
                value={serverSettingsDescription}
                onChange={(event) => setServerSettingsDescription(event.target.value)}
                placeholder="Bu topluluk ne için var? Yeni gelenler ne bilmeli?"
              />
              <small>{serverSettingsDescription.length}/240</small>
            </label>
            <div className="server-overview-grid">
              <label className="settings-field">
                <span>Varsayılan bildirim</span>
                <select
                  value={serverDefaultNotifications}
                  onChange={(event) =>
                    setServerDefaultNotifications(event.target.value as "all" | "mentions")
                  }
                >
                  <option value="mentions">Yalnızca bahsetmeler</option>
                  <option value="all">Tüm mesajlar</option>
                </select>
              </label>
              <label className="settings-field">
                <span>Sistem mesajları odası</span>
                <select
                  value={serverSystemChannelId}
                  onChange={(event) => setServerSystemChannelId(event.target.value)}
                >
                  <option value="">Kapalı</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}># {channel.name}</option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Topluluk dili</span>
                <select
                  value={serverPreferredLocale}
                  onChange={(event) => setServerPreferredLocale(event.target.value)}
                >
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={serverExplicitFilter}
                  onChange={(event) => setServerExplicitFilter(event.target.checked)}
                />
                <span>
                  <strong>Güvenli içerik filtresi</strong>
                  <small>Şüpheli ve uygunsuz içerikleri topluluk genelinde süz.</small>
                </span>
              </label>
            </div>
            <div className="server-health">
              <article><span>ÜYELER</span><strong>{members.length}</strong><small>{onlineMembers.length} çevrimiçi</small></article>
              <article><span>ODALAR</span><strong>{channels.length}</strong><small>{textChannels.length} metin · {voiceChannels.length} ses</small></article>
              <article><span>GÜVENLİK</span><strong>Etkin</strong><small>Rol kontrollü işlemler</small></article>
            </div>
            <div className="server-settings-links">
              <button type="button" onClick={openRoles}><span>♢</span><div><strong>Roller ve yetkiler</strong><small>Rol oluştur, izinleri ve üye rollerini düzenle</small></div><b>›</b></button>
              <button type="button" onClick={() => { setModal("channel"); setNewChannelKind("text"); }}><span>#</span><div><strong>Yeni oda oluştur</strong><small>Metin veya ses alanı ekle</small></div><b>›</b></button>
              <button type="button" onClick={copyInvite}><span>↗</span><div><strong>Davet bağlantısı</strong><small>Sınırlı ve süreli davet oluştur</small></div><b>›</b></button>
              <button type="button" onClick={openEvents}><span>◫</span><div><strong>Etkinlik merkezi</strong><small>Takvim, tekrar, katılım ve hatırlatmalar</small></div><b>›</b></button>
              <button type="button" onClick={() => void openServerGuide()}><span>✓</span><div><strong>Başlangıç rehberi</strong><small>Yeni üyeye kuralları, odaları ve ilk adımları göster</small></div><b>›</b></button>
              {canManageServer && (
                <button type="button" onClick={() => void openAutoMod()}><span>⌁</span><div><strong>AutoMod</strong><small>Spam, davet, kelime ve toplu etiket koruması</small></div><b>›</b></button>
              )}
              <button type="button" onClick={() => void openAuditLog()}><span>◎</span><div><strong>Denetim kaydı</strong><small>Rol, oda, üye ve topluluk işlemlerini izle</small></div><b>›</b></button>
            </div>
            <div className="modal-actions">
              {activeServerId !== "kuzens" && (
                <button
                  type="button"
                  className="danger-outline"
                  onClick={() => void deleteActiveServer()}
                >
                  Topluluğu sil
                </button>
              )}
              <button type="button" onClick={() => setModal(null)}>Vazgeç</button>
              <button className="primary-button" disabled={serverSaving}>
                {serverSaving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === "channel" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form className="modal-card" onSubmit={createChannel} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">YENİ ALAN</span>
            <h2>Bir oda oluştur</h2>
            <p>Sohbet için metin, canlı buluşmalar için ses odası seç.</p>
            <div className="kind-picker">
              <button type="button" className={newChannelKind === "text" ? "active" : ""} onClick={() => setNewChannelKind("text")}>
                <span>#</span><div><strong>Metin odası</strong><small>Mesajlar, görseller ve bağlantılar</small></div>
              </button>
              <button type="button" className={newChannelKind === "voice" ? "active" : ""} onClick={() => setNewChannelKind("voice")}>
                <span>◖</span><div><strong>Ses odası</strong><small>Canlı ses ve ekran paylaşımı</small></div>
              </button>
            </div>
            <label className="field-label">
              ODA ADI
              <div><span>{newChannelKind === "text" ? "#" : "◖"}</span><input autoFocus maxLength={32} value={newChannelName} onChange={(event) => setNewChannelName(event.target.value)} placeholder="yeni-oda" /></div>
            </label>
            <button className="primary-button" disabled={!newChannelName.trim()}>Odayı oluştur</button>
          </form>
        </div>
      )}

      {modal === "roles" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section className="modal-card role-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">YETKİ MERKEZİ</span>
            <h2>Roller ve yetkiler</h2>
            <p>Bir rol seç, izinleri açıp kapat ve üyeye rol ata. Değişiklikler kalıcı olarak kaydedilir.</p>
            {rolesLoading ? (
              <div className="roles-loading">Yetkiler yükleniyor…</div>
            ) : (
              <div className="permission-workspace">
                <div className="role-tabs" role="tablist" aria-label="Roller">
                  {rolesCanManage && (
                    <form className="new-role-form" onSubmit={createRole}>
                      <input
                        type="color"
                        value={newRoleColor}
                        onChange={(event) => setNewRoleColor(event.target.value)}
                        aria-label="Yeni rol rengi"
                      />
                      <input
                        value={newRoleName}
                        onChange={(event) => setNewRoleName(event.target.value)}
                        placeholder="Yeni rol"
                        maxLength={32}
                        aria-label="Yeni rol adı"
                      />
                      <button disabled={!newRoleName.trim() || rolesSaving} aria-label="Rol oluştur">＋</button>
                    </form>
                  )}
                  {roleItems.map((role) => (
                    <button
                      key={role.id}
                      className={selectedRoleId === role.id ? "active" : ""}
                      onClick={() => setSelectedRoleId(role.id)}
                      role="tab"
                      aria-selected={selectedRoleId === role.id}
                    >
                      <i style={{ background: role.color }} />
                      <span>{role.name}<small>{role.id.endsWith(":owner") ? "Sabit tam yetki" : "Düzenlenebilir"}</small></span>
                    </button>
                  ))}
                </div>

                <div className="permission-panel">
                  <div className="permission-heading">
                    <div>
                      <strong>{selectedRole?.name || "Rol seç"}</strong>
                      <span>{selectedRole?.id.endsWith(":owner") ? "Kurucu izinleri güvenlik için kilitlidir." : "Bu role verilen izinler"}</span>
                    </div>
                    <b>{selectedRole ? permissionOptions.filter((item) => (selectedRole.permissions & item.bit) !== 0).length : 0}/{permissionOptions.length} açık</b>
                  </div>
                  {selectedRole && !selectedRole.id.endsWith(":owner") && rolesCanManage && (
                    <div className="role-identity-fields">
                      <label>
                        <span>Rol adı</span>
                        <input
                          value={selectedRole.name}
                          maxLength={32}
                          onChange={(event) =>
                            setRoleItems((current) =>
                              current.map((role) =>
                                role.id === selectedRole.id
                                  ? { ...role, name: event.target.value }
                                  : role,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Rol rengi</span>
                        <input
                          type="color"
                          value={selectedRole.color}
                          onChange={(event) =>
                            setRoleItems((current) =>
                              current.map((role) =>
                                role.id === selectedRole.id
                                  ? { ...role, color: event.target.value }
                                  : role,
                              ),
                            )
                          }
                        />
                      </label>
                      {selectedRole.id.includes(":custom:") && (
                        <button type="button" onClick={() => void deleteSelectedRole()}>
                          Rolü sil
                        </button>
                      )}
                    </div>
                  )}
                  <div className="permission-list">
                    {permissionOptions.map((permission) => {
                      const checked = Boolean(selectedRole && (selectedRole.permissions & permission.bit));
                      const locked = Boolean(selectedRole?.id.endsWith(":owner"));
                      return (
                        <label key={permission.bit} className={locked ? "locked" : ""}>
                          <span><strong>{permission.label}</strong><small>{permission.detail}</small></span>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked || !selectedRole}
                            onChange={() => toggleRolePermission(permission.bit)}
                          />
                          <i />
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="member-role-panel">
                  <div className="permission-heading">
                    <div>
                      <strong>Bu role sahip üyeler</strong>
                      <span>Bir üyeye birden fazla rol verebilirsin. Kuzen rolü herkeste temel olarak bulunur.</span>
                    </div>
                  </div>
                  <div className="member-role-grid">
                    {members.map((member) => (
                      <label key={member.id}>
                        <span>
                          <Avatar name={member.name} tone={toneFor(member.id)} size="sm" imageUrl={member.avatarUrl} />
                          <b>{member.name}</b>
                          <small>{member.roles?.map((role) => role.name).join(" · ") || "Kuzen"}</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(
                            selectedRole &&
                              (selectedRole.id.endsWith(":member") ||
                                roleAssignments.some(
                                  (item) =>
                                    item.memberTag === member.tag &&
                                    item.roleId === selectedRole.id,
                                )),
                          )}
                          disabled={
                            !selectedRole ||
                            selectedRole.id.endsWith(":owner") ||
                            selectedRole.id.endsWith(":member") ||
                            member.role?.id.endsWith(":owner")
                          }
                          onChange={() =>
                            selectedRole &&
                            toggleMemberRole(member.tag, selectedRole.id)
                          }
                        />
                        <i />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!rolesCanManage && !rolesLoading && (
              <p className="owner-note">Bu ayarları yalnızca bu topluluğun doğrulanmış Kurucu hesabı değiştirebilir.</p>
            )}
            <button className="primary-button" disabled={rolesLoading || rolesSaving || !rolesCanManage} onClick={saveRoles}>
              {rolesSaving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
            </button>
          </section>
        </div>
      )}

      {modal === "channelSettings" && selected && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form
            className="modal-card settings-modal"
            onSubmit={saveChannelSettings}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">KANAL AYARLARI</span>
            <h2>#{selected.name}</h2>
            <p>Kanalın adını, açıklamasını ve mesaj hızını buradan yönet.</p>
            <label className="settings-field">
              <span>Kanal adı</span>
              <input
                required
                minLength={1}
                maxLength={32}
                value={channelSettingsName}
                onChange={(event) => setChannelSettingsName(event.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>Kanal konusu</span>
              <textarea
                maxLength={160}
                rows={3}
                value={channelSettingsTopic}
                onChange={(event) => setChannelSettingsTopic(event.target.value)}
                placeholder="Bu kanalda neler konuşulur?"
              />
            </label>
            {selected.kind === "text" && (
              <label className="settings-field">
                <span>Yavaş mod</span>
                <select
                  value={channelSlowMode}
                  onChange={(event) => setChannelSlowMode(Number(event.target.value))}
                >
                  <option value={0}>Kapalı</option>
                  <option value={5}>5 saniye</option>
                  <option value={10}>10 saniye</option>
                  <option value={30}>30 saniye</option>
                  <option value={60}>1 dakika</option>
                  <option value={300}>5 dakika</option>
                  <option value={3600}>1 saat</option>
                </select>
              </label>
            )}
            {selected.kind === "voice" && (
              <div className="voice-channel-settings">
                <label className="settings-field">
                  <span>Ses kalitesi</span>
                  <select
                    value={channelBitrate}
                    onChange={(event) => setChannelBitrate(Number(event.target.value))}
                  >
                    <option value={32_000}>32 kbps · Ekonomik</option>
                    <option value={64_000}>64 kbps · Dengeli</option>
                    {voiceBitrateLimit >= 96_000 && <option value={96_000}>96 kbps · Yüksek</option>}
                    {voiceBitrateLimit >= 128_000 && <option value={128_000}>128 kbps · Stüdyo</option>}
                    {voiceBitrateLimit >= 192_000 && <option value={192_000}>192 kbps · Aura Net</option>}
                    {voiceBitrateLimit >= 256_000 && <option value={256_000}>256 kbps · Aura HD</option>}
                    {voiceBitrateLimit >= 384_000 && <option value={384_000}>384 kbps · Sahip laboratuvarı</option>}
                  </select>
                  <small>
                    {profile?.isOwner
                      ? "Sahip hesabı test sınırı: 384 kbps"
                      : serverAuraMembership?.active
                      ? `Aura Topluluk ${serverAuraMembership.tier} sınırı: ${voiceBitrateLimit / 1000} kbps`
                      : "Temel topluluk sınırı: 64 kbps"}
                  </small>
                </label>
                <label className="settings-field">
                  <span>Kullanıcı sınırı</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={channelUserLimit}
                    onChange={(event) => setChannelUserLimit(Number(event.target.value))}
                  />
                  <small>0 seçersen sınır uygulanmaz.</small>
                </label>
                <label className="settings-field">
                  <span>Ses bölgesi</span>
                  <select
                    value={channelRegion}
                    onChange={(event) => setChannelRegion(event.target.value)}
                  >
                    <option value="auto">Otomatik</option>
                    <option value="eu-central">Avrupa Merkez</option>
                    <option value="eu-west">Avrupa Batı</option>
                    <option value="me">Orta Doğu</option>
                  </select>
                </label>
              </div>
            )}

            <section className="channel-permission-editor">
              <div>
                <strong>Rol bazlı oda izinleri</strong>
                <small>Boş bırakılan izin rolün sunucu ayarından miras alınır.</small>
              </div>
              {channelPermissionsLoading ? (
                <div className="roles-loading">Oda izinleri yükleniyor…</div>
              ) : (
                <div className="channel-overwrite-list">
                  {channelPermissionRoles
                    .filter((role) => !role.id.endsWith(":owner"))
                    .map((role) => {
                      const overwrite = channelPermissionOverwrites.find(
                        (item) => item.roleId === role.id,
                      );
                      return (
                        <article key={role.id}>
                          <header>
                            <i style={{ background: role.color }} />
                            <strong>{role.name}</strong>
                          </header>
                          <div>
                            {channelPermissionOptions
                              .filter((permission) =>
                                (permission.kinds as readonly string[]).includes(
                                  selected.kind,
                                ),
                              )
                              .map((permission) => {
                                const state =
                                  overwrite &&
                                  (overwrite.allowPermissions & permission.bit) !== 0
                                    ? "allow"
                                    : overwrite &&
                                        (overwrite.denyPermissions & permission.bit) !== 0
                                      ? "deny"
                                      : "inherit";
                                return (
                                  <label key={permission.bit}>
                                    <span>{permission.label}</span>
                                    <span className="tri-state">
                                      {(["deny", "inherit", "allow"] as const).map(
                                        (value) => (
                                          <button
                                            type="button"
                                            key={value}
                                            className={state === value ? `active ${value}` : ""}
                                            onClick={() =>
                                              setChannelRolePermission(
                                                role.id,
                                                permission.bit,
                                                value,
                                              )
                                            }
                                            aria-label={`${role.name} · ${permission.label} · ${value}`}
                                          >
                                            {value === "deny"
                                              ? "×"
                                              : value === "allow"
                                                ? "✓"
                                                : "—"}
                                          </button>
                                        ),
                                      )}
                                    </span>
                                  </label>
                                );
                              })}
                          </div>
                        </article>
                      );
                    })}
                </div>
              )}
            </section>
            <div className="modal-actions">
              <button type="button" onClick={() => setModal(null)}>Vazgeç</button>
              <button className="primary-button">Değişiklikleri kaydet</button>
            </div>
          </form>
        </div>
      )}

      {modal === "channelNotifications" && notificationChannel && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form
            className="modal-card channel-notification-modal"
            onSubmit={saveChannelNotifications}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">BİLDİRİM AYARLARI</span>
            <h2>#{notificationChannel.name}</h2>
            <p>Sesli uyarılar ile okunmamış işaretini ayrı ayrı kontrol et.</p>
            <div className="notification-levels">
              {([
                ["all", "Tüm mesajlar", "Bu odadaki her yeni mesajı önemli say."],
                ["mentions", "Yalnızca bahsetmeler", "Sana veya herkese bahsedildiğinde uyar."],
                ["none", "Tamamen sessiz", "Bahsetmeler dahil hiçbir işaret gösterme."],
              ] as const).map(([value, title, detail]) => (
                <label key={value} className={notificationLevel === value ? "active" : ""}>
                  <input
                    type="radio"
                    name="notification-level"
                    value={value}
                    checked={notificationLevel === value}
                    onChange={() => setNotificationLevel(value)}
                  />
                  <i>{value === "all" ? "●" : value === "mentions" ? "@" : "×"}</i>
                  <span><strong>{title}</strong><small>{detail}</small></span>
                  <b />
                </label>
              ))}
            </div>
            <label className={`unread-setting ${notificationLevel === "none" ? "disabled" : ""}`}>
              <span><strong>Okunmamış mesaj işareti</strong><small>Yeni mesaj varsa kanalın yanında sakin bir nokta göster.</small></span>
              <input
                type="checkbox"
                checked={notificationShowUnread}
                disabled={notificationLevel === "none"}
                onChange={(event) => setNotificationShowUnread(event.target.checked)}
              />
              <i />
            </label>
            <div className="notification-preview">
              <span>#</span>
              <strong>{notificationChannel.name}</strong>
              {notificationLevel !== "none" && notificationShowUnread && <i className={`unread-dot ${notificationLevel}`} />}
              {notificationLevel === "mentions" && <em className="mention-badge">2</em>}
              <small>Önizleme</small>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setModal(null)}>Vazgeç</button>
              <button className="primary-button">Bildirimleri kaydet</button>
            </div>
          </form>
        </div>
      )}

      {modal === "aura" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card aura-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <div className="aura-hero">
              <div className="aura-orb"><span>K</span><i /></div>
              <div>
                <span className="eyebrow">KUZENS AURA</span>
                <h2>Topluluk deneyimini parlat.</h2>
                <p>Destekçilere özel görünüm, daha güçlü paylaşım ve erken erişim ayrıcalıkları.</p>
              </div>
              <div className={`aura-status ${auraMembership?.active ? "active" : ""}`}>
                <span>{auraMembership?.active ? "ETKİN" : "ÜCRETSİZ"}</span>
                <strong>
                  {auraMembership?.active
                    ? auraMembership.expiresAt
                      ? new Date(auraMembership.expiresAt).toLocaleDateString("tr-TR")
                      : "Süresiz"
                    : "Aura kapalı"}
                </strong>
              </div>
            </div>

            <div className="aura-body">
              <div className="aura-main">
                <div className="aura-plans">
                  <article><span>1 AY</span><strong>Başlangıç</strong><small>Kısa süreli destek kodu</small></article>
                  <article className="featured"><i>POPÜLER</i><span>3 AY</span><strong>Parıltı</strong><small>Topluluk için dengeli paket</small></article>
                  <article><span>1 YIL</span><strong>Yıldız</strong><small>Uzun süreli Aura erişimi</small></article>
                </div>
                <section className="aura-perks">
                  <div><span>AYRICALIKLAR</span><small>Ücretsiz özellikler asla kısıtlanmaz.</small></div>
                  <ul>
                    {auraPerks.map((perk) => <li key={perk}><i>✓</i>{perk}</li>)}
                  </ul>
                </section>
                <section className={`server-aura-card ${serverAuraMembership?.active ? "active" : ""}`}>
                  <div className="server-aura-card-head">
                    <span className="server-aura-mark">{activeServer.icon}</span>
                    <div>
                      <small>AURA TOPLULUK</small>
                      <strong>{activeServer.name}</strong>
                      <p>
                        {serverAuraMembership?.active
                          ? `Seviye ${serverAuraMembership.tier} etkin`
                          : "Topluluk yükseltmesi etkin değil"}
                      </p>
                    </div>
                    <b>{serverAuraMembership?.active ? "AKTİF" : "TEMEL"}</b>
                  </div>
                  <ul>
                    {serverAuraPerks.map((perk) => <li key={perk}><i>✦</i>{perk}</li>)}
                  </ul>
                </section>
                <form className="aura-redeem" onSubmit={redeemAura}>
                  <div>
                    <strong>Bir Aura kodun mu var?</strong>
                    <small>Kodu yalnızca resmî Kuzens satışından veya kurucudan al.</small>
                  </div>
                  <input
                    value={auraRedeemCode}
                    onChange={(event) => setAuraRedeemCode(event.target.value.toLocaleUpperCase("en-US"))}
                    placeholder="AURA-XXXX-XXXX-XXXX"
                    maxLength={19}
                    aria-label="Aura kodu"
                  />
                  <button disabled={auraBusy || auraRedeemCode.length < 16}>Etkinleştir</button>
                </form>
                <p className="aura-payment-note">
                  Kartla otomatik ödeme için bir ödeme kuruluşu hesabı gerekir. Aylık sabit gider oluşturmadan
                  başlamak için satış kodları hazır: ödemeyi aldıktan sonra tek kullanımlık kodu teslim edebilirsin.
                </p>
              </div>

              {profile?.isOwner && (
                <aside className="aura-owner">
                  <div className="aura-owner-title">
                    <span>SAHİP MERKEZİ</span>
                    <strong>Aura yönetimi</strong>
                    <small>Kod sat, hediye et veya üyeliği geri al.</small>
                  </div>
                  <form onSubmit={createAuraCode}>
                    <label>
                      <span>Kod süresi</span>
                      <select
                        value={auraCodeDuration}
                        onChange={(event) =>
                          setAuraCodeDuration(Number(event.target.value) as 30 | 90 | 365)
                        }
                      >
                        <option value={30}>30 gün</option>
                        <option value={90}>90 gün</option>
                        <option value={365}>365 gün</option>
                      </select>
                    </label>
                    <label>
                      <span>Kullanım hakkı</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={auraMaxUses}
                        onChange={(event) => setAuraMaxUses(Number(event.target.value))}
                      />
                    </label>
                    <button disabled={auraBusy}>Satış kodu üret</button>
                  </form>
                  {freshAuraCode && (
                    <button
                      className="fresh-aura-code"
                      onClick={() => void navigator.clipboard.writeText(freshAuraCode)}
                    >
                      <span>YENİ KOD · panoya kopyalandı</span>
                      <strong>{freshAuraCode}</strong>
                    </button>
                  )}
                  <form onSubmit={grantAura}>
                    <label className="owner-username">
                      <span>Kullanıcıya Aura ver</span>
                      <input
                        value={auraGrantUsername}
                        onChange={(event) => setAuraGrantUsername(event.target.value.replace(/^@/, ""))}
                        placeholder="kullanici_adi"
                      />
                    </label>
                    <label>
                      <span>Süre</span>
                      <select
                        value={auraDuration}
                        onChange={(event) =>
                          setAuraDuration(Number(event.target.value) as 30 | 90 | 365 | 0)
                        }
                      >
                        <option value={30}>30 gün</option>
                        <option value={90}>90 gün</option>
                        <option value={365}>365 gün</option>
                        <option value={0}>Süresiz</option>
                      </select>
                    </label>
                    <button disabled={auraBusy || auraGrantUsername.length < 3}>Aura ver</button>
                  </form>
                  <section className="aura-server-owner">
                    <div>
                      <span>Topluluğa Aura ver</span>
                      <small>{activeServer.name}</small>
                    </div>
                    <label>
                      <span>Seviye</span>
                      <select
                        value={auraServerTier}
                        onChange={(event) =>
                          setAuraServerTier(Number(event.target.value) as 1 | 2 | 3)
                        }
                      >
                        <option value={1}>Seviye 1</option>
                        <option value={2}>Seviye 2</option>
                        <option value={3}>Seviye 3</option>
                      </select>
                    </label>
                    <button type="button" disabled={auraBusy} onClick={() => void grantServerAura()}>
                      Etkinleştir
                    </button>
                    {serverAuraMembership?.active && (
                      <button
                        type="button"
                        className="danger-outline"
                        disabled={auraBusy}
                        onClick={() => void revokeServerAura()}
                      >
                        Kaldır
                      </button>
                    )}
                  </section>
                  <div className="aura-owner-list aura-server-list">
                    <span>AURA TOPLULUKLARI · {auraServers.length}</span>
                    {auraServers.slice(0, 6).map((server) => (
                      <article key={server.id}>
                        <span className="server-aura-list-icon">{server.serverName.slice(0, 2)}</span>
                        <div>
                          <strong>{server.serverName}</strong>
                          <small>Seviye {server.tier} · {server.expiresAt ? new Date(server.expiresAt).toLocaleDateString("tr-TR") : "Süresiz"}</small>
                        </div>
                        <button
                          onClick={() =>
                            void auraAction(
                              { action: "revoke-server", serverId: server.serverId },
                              `${server.serverName} için Aura kaldırıldı.`,
                            )
                          }
                        >
                          Kaldır
                        </button>
                      </article>
                    ))}
                  </div>
                  <div className="aura-owner-list">
                    <span>ETKİN ÜYELİKLER · {auraMembers.length}</span>
                    {auraMembers.slice(0, 8).map((member) => (
                      <article key={member.id}>
                        <Avatar name={member.displayName} tone={toneFor(member.profileId)} size="sm" />
                        <div><strong>{member.displayName}</strong><small>@{member.username} · {member.expiresAt ? new Date(member.expiresAt).toLocaleDateString("tr-TR") : "Süresiz"}</small></div>
                        <button
                          onClick={() =>
                            void auraAction(
                              { action: "revoke", username: member.username },
                              `@${member.username} için Aura kaldırıldı.`,
                            )
                          }
                        >
                          Kaldır
                        </button>
                      </article>
                    ))}
                  </div>
                  <div className="aura-code-list">
                    <span>SON KODLAR</span>
                    {auraCodes.slice(0, 6).map((code) => (
                      <article key={code.id} className={!code.active ? "disabled" : ""}>
                        <div><strong>{code.codeHint}</strong><small>{code.durationDays} gün · {code.uses}/{code.maxUses} kullanım</small></div>
                        {code.active && (
                          <button
                            onClick={() =>
                              void auraAction(
                                { action: "disable-code", codeId: code.id },
                                "Aura kodu kapatıldı.",
                              )
                            }
                          >
                            Kapat
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                </aside>
              )}
            </div>
          </section>
        </div>
      )}

      {modal === "preferences" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form
            className="modal-card preferences-modal"
            onSubmit={savePreferences}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">UYGULAMA AYARLARI</span>
            <h2>Görünüm ve ses</h2>
            <p>Kuzens’i daha okunaklı, daha sakin veya daha hızlı kullanmak için cihazına özel ayarları seç.</p>

            <section className="preference-section">
              <div className="preference-heading"><span>ERİŞİLEBİLİRLİK</span><small>Yalnızca bu cihazda saklanır</small></div>
              <div className="font-size-picker">
                {([
                  ["small", "Küçük", "Aa"],
                  ["normal", "Normal", "Aa"],
                  ["large", "Büyük", "Aa"],
                ] as const).map(([value, label, preview]) => (
                  <button
                    type="button"
                    key={value}
                    className={`${preferences.fontSize === value ? "active" : ""} preview-${value}`}
                    onClick={() => setPreferences((current) => ({ ...current, fontSize: value }))}
                  >
                    <strong>{preview}</strong><span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="preference-toggles">
                <label>
                  <span><strong>Kompakt mesaj görünümü</strong><small>Daha çok mesajı aynı ekranda gösterir.</small></span>
                  <input
                    type="checkbox"
                    checked={preferences.density === "compact"}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        density: event.target.checked ? "compact" : "comfortable",
                      }))
                    }
                  />
                  <i />
                </label>
                <label>
                  <span><strong>Yüksek kontrast</strong><small>Metin ve sınırların görünürlüğünü artırır.</small></span>
                  <input
                    type="checkbox"
                    checked={preferences.highContrast}
                    onChange={(event) =>
                      setPreferences((current) => ({ ...current, highContrast: event.target.checked }))
                    }
                  />
                  <i />
                </label>
                <label>
                  <span><strong>Hareketi azalt</strong><small>Geçiş ve animasyonları kapatır.</small></span>
                  <input
                    type="checkbox"
                    checked={preferences.reducedMotion}
                    onChange={(event) =>
                      setPreferences((current) => ({ ...current, reducedMotion: event.target.checked }))
                    }
                  />
                  <i />
                </label>
              </div>
            </section>

            <section className="preference-section">
              <div className="preference-heading"><span>KLAVYE KISAYOLLARI</span><small>Hızlı ve erişilebilir gezinme</small></div>
              <div className="shortcut-list">
                <div><span>Mesajlarda ara</span><kbd>CTRL / ⌘ + K</kbd></div>
                <div><span>Önceki / sonraki metin odası</span><kbd>ALT + ↑ / ↓</kbd></div>
                <div><span>Mikrofonu aç / kapat</span><kbd>CTRL / ⌘ + SHIFT + M</kbd></div>
                <div><span>Pencere veya menüyü kapat</span><kbd>ESC</kbd></div>
              </div>
            </section>

            <section className="preference-section">
              <div className="preference-heading"><span>SES VE MİKROFON</span><small>Tarayıcı destekli ses işleme</small></div>
              <label className="settings-field">
                <span>Giriş aygıtı</span>
                <select
                  value={preferences.inputDeviceId}
                  onChange={(event) =>
                    setPreferences((current) => ({ ...current, inputDeviceId: event.target.value }))
                  }
                >
                  <option value="">Sistem varsayılanı</option>
                  {audioDevices.map((device, index) => (
                    <option key={device.deviceId || index} value={device.deviceId}>
                      {device.label || `Mikrofon ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="preference-toggles">
                <label>
                  <span><strong>Bas-konuş</strong><small>Boşluk tuşuna basılı tuttuğunda mikrofon açılır.</small></span>
                  <input
                    type="checkbox"
                    checked={preferences.pushToTalk}
                    onChange={(event) =>
                      setPreferences((current) => ({ ...current, pushToTalk: event.target.checked }))
                    }
                  />
                  <i />
                </label>
                <label>
                  <span><strong>Yankı engelleme</strong><small>Hoparlör sesinin mikrofona geri dönmesini azaltır.</small></span>
                  <input
                    type="checkbox"
                    checked={preferences.echoCancellation}
                    onChange={(event) =>
                      setPreferences((current) => ({ ...current, echoCancellation: event.target.checked }))
                    }
                  />
                  <i />
                </label>
                <label>
                  <span><strong>Gürültü azaltma</strong><small>Fan ve sabit arka plan seslerini bastırır.</small></span>
                  <input
                    type="checkbox"
                    checked={preferences.noiseSuppression}
                    onChange={(event) =>
                      setPreferences((current) => ({ ...current, noiseSuppression: event.target.checked }))
                    }
                  />
                  <i />
                </label>
                <label>
                  <span><strong>Otomatik mikrofon kazancı</strong><small>Ses düzeyini konuşmana göre dengeler.</small></span>
                  <input
                    type="checkbox"
                    checked={preferences.autoGainControl}
                    onChange={(event) =>
                      setPreferences((current) => ({ ...current, autoGainControl: event.target.checked }))
                    }
                  />
                  <i />
                </label>
              </div>
              {preferences.pushToTalk && (
                <div className={`ptt-preview ${pttPressed ? "active" : ""}`}>
                  <kbd>BOŞLUK</kbd>
                  <span>{pttPressed ? "Mikrofon açık — konuşabilirsin" : "Konuşmak için basılı tut"}</span>
                </div>
              )}
            </section>

            <div className="modal-actions">
              <button type="button" onClick={() => setPreferences(defaultPreferences)}>Varsayılana dön</button>
              <button type="button" onClick={() => setModal(null)}>Vazgeç</button>
              <button className="primary-button">Ayarları kaydet</button>
            </div>
          </form>
        </div>
      )}

      {modal === "account" && profile && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card account-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setModal(null)}
              aria-label="Kapat"
            >
              ×
            </button>
            <aside className="settings-navigation">
              <div className="settings-account">
                <Avatar name={profile.displayName} tone="purple" size="lg" imageUrl={profile.avatarUrl} status={profile.presenceStatus || "online"} />
                <div>
                  <strong>{profile.displayName}</strong>
                  <span>@{profile.username}</span>
                  {profile.isOwner && <small>KUZENS KURUCU</small>}
                </div>
              </div>
              <button onClick={openProfileSettings}><span>◉</span>Profil</button>
              <button onClick={() => void openPreferences()}><span>◐</span>Görünüm ve ses</button>
              <button onClick={openFriends}><span>♧</span>Arkadaşlar ve gizlilik</button>
              <button onClick={openAura}><span>✦</span>Kuzens Aura</button>
              <a href="/hukuk"><span>⌁</span>Gizlilik ve hukuk</a>
              <a href="/signout-with-chatgpt?return_to=/"><span>↪</span>Oturumu kapat</a>
            </aside>

            <div className="account-content">
              <span className="eyebrow">KULLANICI AYARLARI</span>
              <h2>Hesabım</h2>
              <p>Profilini, cihaz ayarlarını, gizliliğini ve hesap yaşam döngüsünü tek merkezden yönet.</p>

              <div className="account-summary-card">
                <div className="account-banner" />
                <Avatar name={profile.displayName} tone="purple" size="lg" imageUrl={profile.avatarUrl} status={profile.presenceStatus || "online"} />
                <div>
                  <strong>{profile.displayName}</strong>
                  <span>@{profile.username}</span>
                  <small>
                    {auraMembership?.active
                      ? "Kuzens Aura etkin"
                      : "Ücretsiz Kuzens hesabı"}
                  </small>
                </div>
                <button type="button" onClick={openProfileSettings}>
                  Profili düzenle
                </button>
              </div>

              <div className="account-action-grid">
                <button type="button" onClick={() => void openPreferences()}>
                  <span>◐</span>
                  <strong>Görünüm ve ses</strong>
                  <small>Mikrofon, bas-konuş, yazı ve erişilebilirlik</small>
                </button>
                <button type="button" onClick={openAura}>
                  <span>✦</span>
                  <strong>Kuzens Aura</strong>
                  <small>Üyeliğin, kodların ve destekçi ayrıcalıkları</small>
                </button>
                <button type="button" onClick={openDirectMessages}>
                  <span>✉</span>
                  <strong>Mesaj gizliliği</strong>
                  <small>Kimlerin sana özel mesaj gönderebileceğini seç</small>
                </button>
              </div>

              <form className="account-danger-zone" onSubmit={deleteAccount}>
                <div>
                  <span>TEHLİKELİ BÖLGE</span>
                  <strong>Hesabı kalıcı olarak sil</strong>
                  <p>
                    Kişisel verilerin, üyeliklerin ve özel mesajların silinir.
                    Gönderdiğin topluluk mesajları “Silinen hesap” adıyla kalır.
                  </p>
                </div>
                <label>
                  <span>Kullanıcı adın</span>
                  <input
                    value={accountDeleteUsername}
                    onChange={(event) =>
                      setAccountDeleteUsername(
                        event.target.value
                          .toLocaleLowerCase("en-US")
                          .replace(/^@/, ""),
                      )
                    }
                    placeholder={profile.username}
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>Onay ifadesi</span>
                  <input
                    value={accountDeleteConfirmation}
                    onChange={(event) =>
                      setAccountDeleteConfirmation(event.target.value)
                    }
                    placeholder="HESABIMI SİL"
                    autoComplete="off"
                  />
                </label>
                <button
                  className="danger-button"
                  disabled={
                    accountDeleting ||
                    accountDeleteUsername !== profile.username ||
                    accountDeleteConfirmation !== "HESABIMI SİL"
                  }
                >
                  {accountDeleting ? "Hesap siliniyor…" : "Hesabımı sil"}
                </button>
              </form>
            </div>
          </section>
        </div>
      )}

      {modal === "profile" && profile && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form
            className="modal-card profile-settings-modal"
            onSubmit={saveProfile}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <div className="profile-settings-preview">
              <Avatar
                name={profileDisplayName || profile.displayName}
                tone="purple"
                size="lg"
                imageUrl={profileAvatarPreview}
                status={profilePresence}
              />
              <div>
                <strong>{profileDisplayName || profile.displayName}</strong>
                <span>@{profileUsername || profile.username}</span>
                <small>{profileCustomStatus || "Bir durum belirle"}</small>
              </div>
            </div>
            <span className="eyebrow">KULLANICI AYARLARI</span>
            <h2>Profilini düzenle</h2>
            <div className="avatar-upload-panel">
              <div>
                <strong>Profil fotoğrafı</strong>
                <span>Fotoğraf güvenli biçimde kare kırpılır ve yalnızca Kuzens üyelerine gösterilir.</span>
              </div>
              <label className="secondary-button avatar-file-button">
                {profileAvatarPreview ? "Fotoğrafı değiştir" : "Fotoğraf ekle"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={selectProfileAvatar}
                />
              </label>
              {profileAvatarPreview && (
                <button
                  type="button"
                  className="ghost-danger-button"
                  onClick={() => {
                    setProfileAvatarPreview(null);
                    setProfileAvatarDataUrl(null);
                    setProfileRemoveAvatar(true);
                  }}
                >
                  Kaldır
                </button>
              )}
            </div>
            <div className="settings-grid">
              <label className="settings-field">
                <span>Görünen ad</span>
                <input minLength={2} maxLength={32} required value={profileDisplayName} onChange={(event) => setProfileDisplayName(event.target.value)} />
              </label>
              <label className="settings-field">
                <span>Kullanıcı adı</span>
                <input minLength={3} maxLength={24} pattern="[a-z0-9_]+" required value={profileUsername} onChange={(event) => setProfileUsername(event.target.value.toLocaleLowerCase("en-US").replace(/[^a-z0-9_]/g, ""))} />
              </label>
            </div>
            <label className="settings-field">
              <span>Özel durum</span>
              <input maxLength={80} value={profileCustomStatus} onChange={(event) => setProfileCustomStatus(event.target.value)} placeholder="Ne yapıyorsun?" />
            </label>
            <label className="settings-field">
              <span>Çevrimiçi görünüm</span>
              <select value={profilePresence} onChange={(event) => setProfilePresence(event.target.value as typeof profilePresence)}>
                <option value="online">Çevrimiçi</option>
                <option value="idle">Boşta</option>
                <option value="dnd">Rahatsız etmeyin</option>
                <option value="invisible">Görünmez</option>
              </select>
            </label>
            <div className="presence-preview" aria-live="polite">
              <i className={`presence-dot presence-${profilePresence}`} />
              <div>
                <strong>{profilePresence === "online" ? "Çevrimiçi" : profilePresence === "idle" ? "Boşta" : profilePresence === "dnd" ? "Rahatsız etmeyin" : "Görünmez"}</strong>
                <span>{profilePresence === "dnd" ? "Bildirim uyarıları sessize alınır." : profilePresence === "invisible" ? "Başkalarına çevrimdışı görünürsün." : "Durumun profil fotoğrafının altında gösterilir."}</span>
              </div>
            </div>
            <label className="settings-field">
              <span>Hakkımda</span>
              <textarea maxLength={190} rows={4} value={profileBio} onChange={(event) => setProfileBio(event.target.value)} placeholder="Kendinden biraz bahset…" />
            </label>
            <button className="primary-button" disabled={profileSaving}>
              {profileSaving ? "Kaydediliyor…" : "Profili kaydet"}
            </button>
          </form>
        </div>
      )}

      {modal === "memberProfile" && viewingMember && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card member-profile-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <div className="member-profile-banner" />
            <Avatar
              name={viewingMember.name}
              tone={toneFor(viewingMember.id)}
              size="lg"
              imageUrl={viewingMember.avatarUrl}
              status={viewingMember.presenceStatus || (viewingMember.online ? "online" : "offline")}
            />
            <h2>{viewingMember.name}</h2>
            <span className="member-profile-tag">{viewingMember.tag}</span>
            <div className="member-profile-details">
              <div>
                <span>DURUM</span>
                <p>{memberStatus(viewingMember)}</p>
              </div>
              <div>
                <span>HAKKINDA</span>
                <p>{viewingMember.bio || "Bu kullanıcı henüz kendinden bahsetmedi."}</p>
              </div>
              <div>
                <span>ROL</span>
                <p style={{ color: viewingMember.role?.color || "#bcb4c7" }}>
                  {viewingMember.role?.name || "Kuzen"}
                </p>
              </div>
            </div>
            <div className="member-profile-actions">
              <button onClick={() => { insertMention(viewingMember.tag); setModal(null); }}>@ Bahset</button>
              {viewingMember.id !== profile?.id && (
                <>
                  <button onClick={() => void startDirectMessage(viewingMember)}>Mesaj gönder</button>
                  <button onClick={() => void requestFriend(viewingMember)}>Arkadaş ekle</button>
                  <button className="danger" onClick={() => void friendAction("block", viewingMember.id)}>Engelle</button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {modal === "guide" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card guide-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            {guideLoading ? (
              <div className="roles-loading">Başlangıç rehberi yükleniyor…</div>
            ) : (
              <>
                <div className="guide-hero">
                  <div className="guide-icon">{activeServer.icon}</div>
                  <div>
                    <span className="eyebrow">{activeServer.name.toLocaleUpperCase("tr-TR")} REHBERİ</span>
                    <h2>Aramıza hoş geldin.</h2>
                    <p>{serverGuide.welcomeMessage}</p>
                  </div>
                  <strong>{guideCompletedSteps.length}/3</strong>
                </div>
                <div className="guide-progress"><i style={{ width: `${(guideCompletedSteps.length / 3) * 100}%` }} /></div>
                <div className="guide-steps">
                  <article className={guideCompletedSteps.includes("rules") ? "done" : ""}>
                    <span>{guideCompletedSteps.includes("rules") ? "✓" : "1"}</span>
                    <div><strong>Kuralları incele</strong><p>Topluluğun güvenli ve keyifli kalması için temel kuralları oku.</p></div>
                    <a href="/hukuk/topluluk-kurallari" target="_blank" onClick={() => void completeGuideStep("rules")}>Kuralları aç</a>
                  </article>
                  <article className={guideCompletedSteps.includes("favorite") ? "done" : ""}>
                    <span>{guideCompletedSteps.includes("favorite") ? "✓" : "2"}</span>
                    <div><strong>Bir odayı favorile</strong><p>Sık kullandığın odaya sağ tıklayıp favorilerine ekle.</p></div>
                    <button
                      type="button"
                      onClick={() => {
                        const first = textChannels[0];
                        if (first && !favoriteChannelIds.has(first.id)) toggleFavoriteChannel(first);
                        void completeGuideStep("favorite");
                      }}
                    >
                      {favoriteChannels.length ? "Tamamla" : "İlk odayı ekle"}
                    </button>
                  </article>
                  <article className={guideCompletedSteps.includes("hello") ? "done" : ""}>
                    <span>{guideCompletedSteps.includes("hello") ? "✓" : "3"}</span>
                    <div><strong>Kendini tanıt</strong><p>#genel odasına geç ve kuzenlere kısa bir selam bırak.</p></div>
                    <button
                      type="button"
                      onClick={() => {
                        const general = textChannels.find((channel) => channel.id === serverGuide.rulesChannelId) || textChannels[0];
                        if (general) setActiveChannel(general.id);
                        setDraft("Selam kuzenler! Ben ");
                        setModal(null);
                      }}
                    >
                      Mesajını hazırla
                    </button>
                  </article>
                </div>
                {guideCanManage && (
                  <div className="guide-owner-settings">
                    <div><span className="eyebrow">YÖNETİCİ AYARI</span><strong>Rehberi özelleştir</strong></div>
                    <label className="settings-field">
                      <span>Karşılama mesajı</span>
                      <textarea
                        maxLength={500}
                        value={serverGuide.welcomeMessage}
                        onChange={(event) => setServerGuide((current) => ({ ...current, welcomeMessage: event.target.value }))}
                      />
                    </label>
                    <label className="settings-field">
                      <span>Kurallar / başlangıç odası</span>
                      <select
                        value={serverGuide.rulesChannelId || ""}
                        onChange={(event) => setServerGuide((current) => ({ ...current, rulesChannelId: event.target.value || null }))}
                      >
                        <option value="">Otomatik seç</option>
                        {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                      </select>
                    </label>
                    <button className="primary-button" type="button" disabled={guideSaving} onClick={() => void saveServerGuide()}>
                      {guideSaving ? "Kaydediliyor…" : "Rehber ayarlarını kaydet"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {modal === "events" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card events-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <div className="events-heading">
              <div>
                <span className="eyebrow">TOPLULUK TAKVİMİ</span>
                <h2>Etkinlikler</h2>
                <p>Planla, katılım topla ve hatırlatmanı kendi takvimine ekle.</p>
              </div>
              <span className="events-count">{eventOccurrences.length} plan</span>
            </div>
            {eventsLoading ? (
              <div className="roles-loading">Etkinlikler yükleniyor…</div>
            ) : (
              <div className={`events-layout ${eventsCanManage ? "can-manage" : ""}`}>
                <div className="event-calendar-panel">
                  <div className="calendar-toolbar">
                    <button
                      type="button"
                      aria-label="Önceki ay"
                      onClick={() => {
                        const next = new Date(`${eventMonth}T12:00:00`);
                        next.setMonth(next.getMonth() - 1);
                        setEventMonth(`${localDateKey(new Date(next.getFullYear(), next.getMonth(), 1))}`);
                      }}
                    >
                      ‹
                    </button>
                    <strong>
                      {new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(
                        new Date(`${eventMonth}T12:00:00`),
                      )}
                    </strong>
                    <button
                      type="button"
                      aria-label="Sonraki ay"
                      onClick={() => {
                        const next = new Date(`${eventMonth}T12:00:00`);
                        next.setMonth(next.getMonth() + 1);
                        setEventMonth(`${localDateKey(new Date(next.getFullYear(), next.getMonth(), 1))}`);
                      }}
                    >
                      ›
                    </button>
                  </div>
                  <div className="calendar-weekdays">
                    {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => <span key={day}>{day}</span>)}
                  </div>
                  <div className="calendar-grid">
                    {eventCalendarDays.map(({ date, current }) => {
                      const key = localDateKey(date);
                      const count = eventOccurrences.filter(
                        (occurrence) => localDateKey(occurrence.startsAt) === key,
                      ).length;
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`${current ? "" : "outside"} ${eventSelectedDay === key ? "selected" : ""} ${key === localDateKey(new Date()) ? "today" : ""}`}
                          onClick={() => setEventSelectedDay((currentDay) => currentDay === key ? "" : key)}
                          aria-label={`${key}${count ? `, ${count} etkinlik` : ""}`}
                        >
                          <span>{date.getDate()}</span>
                          {count > 0 && <i>{count}</i>}
                        </button>
                      );
                    })}
                  </div>
                  {eventSelectedDay && (
                    <button type="button" className="calendar-clear" onClick={() => setEventSelectedDay("")}>
                      Tüm yaklaşanları göster
                    </button>
                  )}
                </div>

                <div className="event-list" aria-live="polite">
                  <div className="event-list-head">
                    <strong>{eventSelectedDay ? "Seçilen gün" : "Yaklaşan etkinlikler"}</strong>
                    <small>{visibleEventOccurrences.length} sonuç</small>
                  </div>
                  {visibleEventOccurrences.length === 0 && (
                    <div className="event-empty">
                      <span>◫</span>
                      <strong>Bu aralıkta etkinlik yok</strong>
                      <p>Takvimden başka bir gün seçebilir veya yeni bir etkinlik planlayabilirsin.</p>
                    </div>
                  )}
                  {visibleEventOccurrences.slice(0, 40).map((occurrence) => (
                    <article className="event-card" key={occurrence.occurrenceId}>
                      <div className="event-date-tile">
                        <span>{new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(new Date(occurrence.startsAt)).toLocaleUpperCase("tr-TR")}</span>
                        <strong>{new Date(occurrence.startsAt).getDate()}</strong>
                      </div>
                      <div className="event-card-main">
                        <div className="event-card-title">
                          <div>
                            <strong>{occurrence.event.title}</strong>
                            <small>{eventDateLabel(occurrence.startsAt)} · {timeLabel(occurrence.endsAt)}</small>
                          </div>
                          {occurrence.event.recurrence !== "none" && (
                            <em>{occurrence.event.recurrence === "weekly" ? "Haftalık" : "Aylık"}</em>
                          )}
                        </div>
                        {occurrence.event.description && <p>{occurrence.event.description}</p>}
                        <div className="event-meta">
                          {occurrence.event.location && <span>⌖ {occurrence.event.location}</span>}
                          {occurrence.event.channelId && (
                            <span># {channels.find((channel) => channel.id === occurrence.event.channelId)?.name || "oda"}</span>
                          )}
                          <span>✓ {occurrence.event.counts.going} katılıyor</span>
                          <span>☆ {occurrence.event.counts.interested} ilgili</span>
                        </div>
                        <div className="event-actions">
                          <button
                            type="button"
                            className={occurrence.event.myRsvp?.response === "going" ? "active" : ""}
                            onClick={() => void rsvpEvent(occurrence.event, "going")}
                          >
                            Katılacağım
                          </button>
                          <button
                            type="button"
                            className={occurrence.event.myRsvp?.response === "interested" ? "active" : ""}
                            onClick={() => void rsvpEvent(occurrence.event, "interested")}
                          >
                            İlgileniyorum
                          </button>
                          <select
                            aria-label="Hatırlatma"
                            value={occurrence.event.myRsvp?.reminderMinutes ?? 30}
                            onChange={(event) =>
                              void rsvpEvent(
                                occurrence.event,
                                occurrence.event.myRsvp?.response || "interested",
                                Number(event.target.value),
                              )
                            }
                          >
                            <option value={0}>Hatırlatma yok</option>
                            <option value={10}>10 dk önce</option>
                            <option value={30}>30 dk önce</option>
                            <option value={60}>1 saat önce</option>
                            <option value={1440}>1 gün önce</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => downloadEventCalendar(occurrence.event, occurrence.startsAt, occurrence.endsAt)}
                          >
                            Takvime ekle
                          </button>
                          {(eventsCanManage || occurrence.event.creatorProfileId === profile?.id) && (
                            <button type="button" className="event-cancel" onClick={() => void cancelEvent(occurrence.event)}>
                              İptal et
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {eventsCanManage && (
                  <form className="event-create" onSubmit={createEvent}>
                    <div>
                      <span className="eyebrow">YENİ PLAN</span>
                      <h3>Etkinlik oluştur</h3>
                    </div>
                    <label>
                      Başlık
                      <input required minLength={2} maxLength={80} value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Cuma oyun gecesi" />
                    </label>
                    <label>
                      Açıklama
                      <textarea maxLength={1000} value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} placeholder="Ne yapacağız, kimler katılabilir?" />
                    </label>
                    <div className="event-form-row">
                      <label>
                        Başlangıç
                        <input required type="datetime-local" value={eventStartsAt} onChange={(event) => setEventStartsAt(event.target.value)} />
                      </label>
                      <label>
                        Bitiş
                        <input required type="datetime-local" value={eventEndsAt} onChange={(event) => setEventEndsAt(event.target.value)} />
                      </label>
                    </div>
                    <div className="event-form-row">
                      <label>
                        Tekrar
                        <select value={eventRecurrence} onChange={(event) => setEventRecurrence(event.target.value as "none" | "weekly" | "monthly")}>
                          <option value="none">Tek sefer</option>
                          <option value="weekly">Her hafta</option>
                          <option value="monthly">Her ay</option>
                        </select>
                      </label>
                      <label>
                        Oda
                        <select value={eventChannelId} onChange={(event) => setEventChannelId(event.target.value)}>
                          <option value="">Oda seçme</option>
                          {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.kind === "text" ? "#" : "◖"} {channel.name}</option>)}
                        </select>
                      </label>
                    </div>
                    <label>
                      Konum veya bağlantı
                      <input maxLength={200} value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} placeholder="Muhabbet odası veya https://…" />
                    </label>
                    <button className="primary-button" disabled={eventCreating}>
                      {eventCreating ? "Planlanıyor…" : "Etkinliği planla"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {modal === "automod" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form
            className="modal-card automod-modal"
            onSubmit={saveAutoMod}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">TOPLULUK GÜVENLİĞİ</span>
            <h2>AutoMod</h2>
            <p>Mesajı yayınlanmadan önce denetler; engellenen işlemin nedenini denetim kaydına ekler.</p>
            {autoModLoading ? (
              <div className="roles-loading">AutoMod ayarları yükleniyor…</div>
            ) : (
              <>
                <label className="automod-master">
                  <span>
                    <strong>AutoMod etkin</strong>
                    <small>Tüm kuralları tek anahtarla aç veya geçici olarak durdur.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={autoModSettings.enabled}
                    onChange={(event) => setAutoModSettings((current) => ({ ...current, enabled: event.target.checked }))}
                  />
                </label>
                <div className="automod-grid">
                  <label className="automod-rule">
                    <input
                      type="checkbox"
                      checked={autoModSettings.blockInviteLinks}
                      onChange={(event) => setAutoModSettings((current) => ({ ...current, blockInviteLinks: event.target.checked }))}
                    />
                    <span><strong>Dış davetleri engelle</strong><small>Discord sunucu davetlerinin paylaşılmasını önler.</small></span>
                  </label>
                  <label className="automod-rule">
                    <input
                      type="checkbox"
                      checked={autoModSettings.blockDuplicateMessages}
                      onChange={(event) => setAutoModSettings((current) => ({ ...current, blockDuplicateMessages: event.target.checked }))}
                    />
                    <span><strong>Tekrarlı spamı engelle</strong><small>30 saniyede üçüncü aynı mesajı durdurur.</small></span>
                  </label>
                </div>
                <label className="settings-field">
                  <span>Mesaj başına etiket sınırı</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={autoModSettings.maxMentions}
                    onChange={(event) => setAutoModSettings((current) => ({ ...current, maxMentions: Number(event.target.value) }))}
                  />
                  <small>@everyone yetkisi ayrıca rol sistemiyle korunur.</small>
                </label>
                <label className="settings-field">
                  <span>Özel kelime veya ifadeler</span>
                  <textarea
                    maxLength={2000}
                    value={autoModSettings.blockedTerms}
                    onChange={(event) => setAutoModSettings((current) => ({ ...current, blockedTerms: event.target.value }))}
                    placeholder={"Her satıra bir ifade yaz\nörnek ifade"}
                  />
                  <small>En fazla 100 ifade; normalleştirilmiş eşleşme kullanılır, düzenli ifade çalıştırılmaz.</small>
                </label>
                <fieldset className="automod-exemptions">
                  <legend>İstisna odaları</legend>
                  <p>Güvendiğin bot veya yönetim odalarında filtreyi atlayabilirsin.</p>
                  <div>
                    {textChannels.map((channel) => (
                      <label key={channel.id}>
                        <input
                          type="checkbox"
                          checked={autoModSettings.exemptChannelIds.includes(channel.id)}
                          onChange={(event) =>
                            setAutoModSettings((current) => ({
                              ...current,
                              exemptChannelIds: event.target.checked
                                ? [...current.exemptChannelIds, channel.id]
                                : current.exemptChannelIds.filter((id) => id !== channel.id),
                            }))
                          }
                        />
                        <span># {channel.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="automod-note">
                  <span>◎</span>
                  <p><strong>Şeffaf ve geri izlenebilir</strong> Engellenen mesajın içeriği saklanmaz; yalnızca kural türü ve kanal denetim kaydına yazılır.</p>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setModal(null)}>Vazgeç</button>
                  <button className="primary-button" disabled={autoModSaving}>
                    {autoModSaving ? "Kaydediliyor…" : "Kuralları kaydet"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {modal === "auditLog" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card audit-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">YÖNETİM GEÇMİŞİ</span>
            <h2>Denetim kaydı</h2>
            <p>Toplulukta yapılan kritik yönetim işlemleri değiştirilemez bir geçmiş olarak burada görünür.</p>
            <div className="audit-list">
              {auditLoading ? (
                <div className="roles-loading">Denetim kaydı yükleniyor…</div>
              ) : auditEntries.length ? (
                auditEntries.map((entry) => (
                  <article key={entry.id}>
                    <Avatar name={entry.actorName} tone={toneFor(entry.actorProfileId)} size="sm" />
                    <div>
                      <p><strong>{entry.actorName}</strong> {auditLabel(entry.action)}</p>
                      <span>@{entry.actorUsername}{entry.targetId ? ` · ${entry.targetId}` : ""}</span>
                      {entry.detail && <small>{entry.detail}</small>}
                    </div>
                    <time>
                      {new Intl.DateTimeFormat("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(entry.createdAt))}
                    </time>
                  </article>
                ))
              ) : (
                <div className="empty-search">
                  <span>✓</span>
                  <strong>Henüz kayıt yok</strong>
                  <p>İlk yönetim işlemi burada görünecek.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {modal === "thread" && (
        <div className="modal-backdrop thread-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card thread-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            {threadLoading ? (
              <div className="roles-loading">Konu başlığı yükleniyor…</div>
            ) : activeThread ? (
              <>
                <header className="thread-head">
                  <div>
                    <span className="eyebrow">#{activeThread.channelName} · KONU BAŞLIĞI</span>
                    <h2>{activeThread.title}</h2>
                    <p>{activeThread.archived ? "Arşivlendi" : activeThread.locked ? "Yanıtlara kapalı" : "Kalıcı ve görünür"}</p>
                  </div>
                  {threadCanManage && (
                    <div className="thread-admin">
                      <button type="button" onClick={() => void updateThreadState({ locked: !activeThread.locked })}>
                        {activeThread.locked ? "Kilidi aç" : "Kilitle"}
                      </button>
                      <button type="button" onClick={() => void updateThreadState({ archived: !activeThread.archived })}>
                        {activeThread.archived ? "Arşivden çıkar" : "Arşivle"}
                      </button>
                    </div>
                  )}
                </header>
                <div className="thread-scroll">
                  {activeThread.parent && (
                    <article className="thread-parent">
                      {activeThread.parent.blockedAuthor &&
                      !revealedBlockedMessages.has(activeThread.parent.id) ? (
                        <button
                          type="button"
                          className="blocked-message-reveal"
                          onClick={() =>
                            setRevealedBlockedMessages((current) => {
                              const next = new Set(current);
                              next.add(activeThread.parent!.id);
                              return next;
                            })
                          }
                        >
                          <span>Engellenen kullanıcıdan başlangıç mesajı</span>
                          <strong>Bir kez göster</strong>
                        </button>
                      ) : (
                        <>
                          <header><strong>{activeThread.parent.authorName}</strong><span>{activeThread.parent.authorTag}</span><time>{timeLabel(activeThread.parent.createdAt)}</time></header>
                          <p>{activeThread.parent.content}</p>
                        </>
                      )}
                    </article>
                  )}
                  <div className="thread-divider"><span>{threadReplies.length} YANIT</span></div>
                  {threadReplies.map((reply) => (
                    <article className="thread-reply" key={reply.id}>
                      {reply.blockedAuthor &&
                      !revealedBlockedMessages.has(reply.id) ? (
                        <button
                          type="button"
                          className="blocked-message-reveal"
                          onClick={() =>
                            setRevealedBlockedMessages((current) => {
                              const next = new Set(current);
                              next.add(reply.id);
                              return next;
                            })
                          }
                        >
                          <span>Engellenen kullanıcıdan konu yanıtı</span>
                          <strong>Bir kez göster</strong>
                        </button>
                      ) : (
                        <>
                          <Avatar name={reply.authorName} tone={toneFor(reply.authorProfileId)} size="sm" />
                          <div>
                            <header><strong>{reply.authorName}</strong><span>@{reply.authorUsername}</span><time>{timeLabel(reply.createdAt)}</time></header>
                            <p className={reply.deletedAt ? "deleted" : ""}>{reply.deletedAt ? "Bu yanıt silindi." : reply.content}</p>
                          </div>
                          {!reply.deletedAt &&
                            (reply.authorProfileId === profile?.id || canManageMessages) && (
                              <button type="button" onClick={() => void deleteThreadReply(reply)} aria-label="Yanıtı sil">×</button>
                            )}
                        </>
                      )}
                    </article>
                  ))}
                  {!threadReplies.length && (
                    <div className="thread-empty">İlk yanıtı sen ver; konu ana sohbeti bölmeden burada büyüsün.</div>
                  )}
                </div>
                {!activeThread.locked && !activeThread.archived ? (
                  <form className="thread-composer" onSubmit={sendThreadReply}>
                    <textarea
                      value={threadDraft}
                      onChange={(event) => setThreadDraft(event.target.value)}
                      maxLength={2000}
                      rows={1}
                      placeholder={`${activeThread.title} konusuna yanıt ver`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <button disabled={!threadDraft.trim()}>Gönder</button>
                  </form>
                ) : (
                  <div className="thread-closed">Bu konu başlığı yeni yanıtlara kapalı.</div>
                )}
              </>
            ) : (
              <div className="thread-empty">Konu başlığı bulunamadı.</div>
            )}
          </section>
        </div>
      )}

      {modal === "poll" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <form
            className="modal-card poll-modal"
            onSubmit={createPoll}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">YENİ İÇERİK</span>
            <h2>Anket oluştur</h2>
            <p>Topluluğun fikrini bot kullanmadan, tek bir mesaj içinde topla.</p>
            <label className="settings-field">
              <span>Soru</span>
              <input
                autoFocus
                required
                minLength={2}
                maxLength={200}
                value={pollQuestion}
                onChange={(event) => setPollQuestion(event.target.value)}
                placeholder="Bu akşam ne oynayalım?"
              />
            </label>
            <div className="poll-option-editor">
              <span>SEÇENEKLER</span>
              {pollOptionDrafts.map((option, index) => (
                <label key={index}>
                  <b>{index + 1}</b>
                  <input
                    required={index < 2}
                    maxLength={80}
                    value={option}
                    onChange={(event) =>
                      setPollOptionDrafts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder={`Seçenek ${index + 1}`}
                  />
                  {pollOptionDrafts.length > 2 && (
                    <button
                      type="button"
                      aria-label={`${index + 1}. seçeneği kaldır`}
                      onClick={() =>
                        setPollOptionDrafts((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      ×
                    </button>
                  )}
                </label>
              ))}
              {pollOptionDrafts.length < 10 && (
                <button
                  type="button"
                  className="poll-add-option"
                  onClick={() => setPollOptionDrafts((current) => [...current, ""])}
                >
                  + Seçenek ekle
                </button>
              )}
            </div>
            <div className="poll-settings-row">
              <label className="settings-field">
                <span>Süre</span>
                <select value={pollDurationHours} onChange={(event) => setPollDurationHours(Number(event.target.value))}>
                  <option value={1}>1 saat</option>
                  <option value={6}>6 saat</option>
                  <option value={24}>1 gün</option>
                  <option value={72}>3 gün</option>
                  <option value={168}>1 hafta</option>
                </select>
              </label>
              <label className="poll-multiple">
                <span><strong>Çoklu seçim</strong><small>Kullanıcı birden fazla seçeneğe oy verebilir.</small></span>
                <input type="checkbox" checked={pollAllowMultiple} onChange={(event) => setPollAllowMultiple(event.target.checked)} />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setModal(null)}>Vazgeç</button>
              <button
                className="primary-button"
                disabled={
                  pollCreating ||
                  pollQuestion.trim().length < 2 ||
                  pollOptionDrafts.filter((option) => option.trim()).length < 2
                }
              >
                {pollCreating ? "Yayınlanıyor…" : "Anketi yayınla"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === "bookmarks" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <section
            className="modal-card bookmarks-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Kapat">×</button>
            <span className="eyebrow">KİŞİSEL ALAN</span>
            <h2>Sonra Bak</h2>
            <p>Önemli mesajları kaydet, not düş ve istediğin zamanda hatırlat.</p>
            {bookmarksLoading ? (
              <div className="roles-loading">Kayıtlı mesajlar yükleniyor…</div>
            ) : savedMessages.length ? (
              <div className="bookmark-list">
                {savedMessages.map((item) => (
                  <article className={item.reminderDue ? "due" : ""} key={item.id}>
                    <header>
                      <div>
                        <strong>{item.message.authorName}</strong>
                        <span>{item.message.serverName} · #{item.message.channelName}</span>
                      </div>
                      <time>{eventDateLabel(item.message.createdAt)}</time>
                    </header>
                    <blockquote>{item.message.content}</blockquote>
                    {item.note && <p className="bookmark-note">“{item.note}”</p>}
                    {item.remindAt && (
                      <div className={`bookmark-reminder ${item.reminderDue ? "due" : ""}`}>
                        {item.reminderDue ? "⏰ Hatırlatma zamanı geldi" : `◷ ${eventDateLabel(item.remindAt)}`}
                      </div>
                    )}
                    <footer>
                      <button type="button" onClick={() => void jumpToBookmark(item)}>Mesaja git</button>
                      <button
                        type="button"
                        onClick={() => {
                          const note = window.prompt("Bu kayıt için kişisel not", item.note);
                          if (note !== null) void updateBookmark(item, undefined, note.slice(0, 240));
                        }}
                      >
                        Not
                      </button>
                      <select
                        defaultValue=""
                        aria-label="Hatırlatma ayarla"
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value) void updateBookmark(item, value === "none" ? null : Number(value));
                          event.currentTarget.value = "";
                        }}
                      >
                        <option value="" disabled>Hatırlat…</option>
                        <option value={10}>10 dakika sonra</option>
                        <option value={60}>1 saat sonra</option>
                        <option value={1440}>Yarın</option>
                        <option value={10080}>1 hafta sonra</option>
                        <option value="none">Hatırlatmayı kaldır</option>
                      </select>
                      <button type="button" className="danger" onClick={() => void removeBookmark(item)}>Kaldır</button>
                    </footer>
                  </article>
                ))}
              </div>
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
            <div className="notification-list">
              {notifications.length ? (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => void openNotification(notification)}
                  >
                    <span className="notification-avatar">{initials(notification.authorName)}</span>
                    <span>
                      <strong>{notification.authorName}</strong>
                      <small>{notification.serverName} · #{notification.channelName}</small>
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
                <span>ÜCRETSİZ HESAP</span>
                <h1>Kuzens hesabını oluştur</h1>
                <p>Şifre istemiyoruz; güvenli giriş mevcut doğrulanmış hesabın üzerinden yapılır.</p>
              </div>
              <div className="registration-trust">
                <span>✓</span>
                <div>
                  <strong>Doğrulanmış kimlik oturumu</strong>
                  <small>Parolan Kuzens sunucularına gönderilmez veya kaydedilmez.</small>
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
              <div className="legal-checks">
                <label><input name="birthConfirmed" type="checkbox" required /><i /><span>18 yaşını doldurduğumu doğruluyorum.</span></label>
                <label><input name="termsAccepted" type="checkbox" required /><i /><span><a href="/hukuk/kullanim-kosullari" target="_blank">Kullanım Koşulları</a>nı kabul ediyorum.</span></label>
                <label><input name="communityAccepted" type="checkbox" required /><i /><span><a href="/hukuk/topluluk-kurallari" target="_blank">Topluluk Kuralları</a>nı kabul ediyorum.</span></label>
                <label><input name="noticeRead" type="checkbox" required /><i /><span><a href="/hukuk/aydinlatma" target="_blank">KVKK Aydınlatma Metni</a>ni okudum. Bu bir açık rıza beyanı değildir.</span></label>
              </div>
              {registrationError && <div className="registration-error">{registrationError}</div>}
              <button className="registration-submit" disabled={registrationSubmitting}>
                {registrationSubmitting ? "Hesabın oluşturuluyor…" : "Hesabı oluştur ve devam et"}
              </button>
              <p className="registration-foot">Gizliliğini nasıl koruduğumuzu <a href="/hukuk/gizlilik" target="_blank">Gizlilik Politikası</a>nda anlatıyoruz.</p>
            </form>
          </div>
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
              <i />
              <button onClick={openRoles}><span>♢</span>Roller ve yetkiler</button>
              {ownsActiveServer && (
                <button onClick={openServerSettings}><span>⚙</span>Topluluk ayarları</button>
              )}
              {(permissions & 63) !== 0 && (
                <button onClick={() => void openAuditLog()}><span>◎</span>Denetim kaydı</button>
              )}
              {canManageServer && (
                <button onClick={() => void openAutoMod()}><span>⌁</span>AutoMod ayarları</button>
              )}
              <button onClick={openAura}><span>✦</span>Kuzens Aura</button>
            </>
          )}
          {contextMenu.kind === "channel" && contextMenu.channel && (
            <>
              <span className="context-title">#{contextMenu.channel.name}</span>
              <button onClick={() => toggleFavoriteChannel(contextMenu.channel!)}><span>★</span>{favoriteChannelIds.has(contextMenu.channel.id) ? "Favorilerden çıkar" : "Favorilere ekle"}</button>
              {contextMenu.channel.kind === "text" && (
                <>
                  <button onClick={() => { void markChannelRead(contextMenu.channel!); setToast({ text: "Kanal okundu işaretlendi.", tone: "success" }); }}><span>✓</span>Okundu işaretle</button>
                  <button onClick={() => openChannelNotifications(contextMenu.channel!)}><span>♢</span>Bildirim ayarları</button>
                </>
              )}
              <button onClick={() => void copyInvite()}><span>↗</span>Davet oluştur</button>
              <button onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/?sunucu=${activeServerId}&kanal=${contextMenu.channel!.id}`); setToast({ text: "Kanal bağlantısı kopyalandı.", tone: "success" }); }}><span>⛓</span>Bağlantıyı kopyala</button>
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
              <button onClick={() => { void navigator.clipboard.writeText(contextMenu.message!.content); setToast({ text: "Mesaj metni kopyalandı.", tone: "success" }); }}><span>▣</span>Metni kopyala</button>
              <button onClick={() => void copyMessageLink(contextMenu.message!)}><span>⛓</span>Mesaj bağlantısını kopyala</button>
              <button onClick={() => void saveBookmark(contextMenu.message!)}><span>☆</span>Sonra için kaydet</button>
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
                </>
              )}
              {(canKickMembers || canBanMembers) &&
                contextMenu.member.id !== profile?.id &&
                !contextMenu.member.role?.id.endsWith(":owner") && (
                  <>
                    <i />
                    {canKickMembers && <button className="danger" onClick={() => void moderateMember(contextMenu.member!, "kick")}><span>↗</span>Topluluktan çıkar</button>}
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
