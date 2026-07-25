"use client";

import {
  FormEvent,
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
  position: number;
};

type ChatMessage = {
  id: string;
  channelId: string;
  authorProfileId?: string | null;
  authorName: string;
  authorTag: string;
  content: string;
  replyToId?: string | null;
  pinned?: boolean;
  mentionedMe?: boolean;
  reactions?: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
};

type Toast = { text: string; tone?: "success" | "danger" };

type Profile = {
  id: string;
  displayName: string;
  username: string;
  bio?: string;
  customStatus?: string;
  presenceStatus?: "online" | "idle" | "dnd" | "invisible";
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
  role: { id: string; name: string; color: string } | null;
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
  ownerProfileId?: string | null;
};

type FriendItem = {
  id: string;
  status: "pending" | "accepted" | "blocked";
  direction: "incoming" | "outgoing";
  profile: { id: string; name: string; tag: string };
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

function LinkEmbed({ content }: { content: string }) {
  const urlText = content.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  if (!urlText) return null;
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    return null;
  }
  const isYouTube = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname);
  const isSteam = /(^|\.)steampowered\.com$|(^|\.)steamcommunity\.com$/i.test(url.hostname);
  if (!isYouTube && !isSteam) return null;
  const youtubeId = isYouTube
    ? url.hostname.includes("youtu.be")
      ? url.pathname.split("/")[1]
      : url.searchParams.get("v") || url.pathname.match(/\/shorts\/([^/]+)/)?.[1]
    : null;
  const steamId = isSteam ? url.pathname.match(/\/app\/(\d+)/)?.[1] : null;
  const imageUrl = youtubeId
    ? `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`
    : steamId
      ? `https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/header.jpg`
      : null;

  return (
    <a className="link-embed" href={url.toString()} target="_blank" rel="noreferrer noopener">
      <div
        className={`embed-art ${isYouTube ? "youtube" : "steam"}`}
        style={imageUrl ? { backgroundImage: `linear-gradient(145deg, rgba(0,0,0,.12), rgba(0,0,0,.58)), url("${imageUrl}")` } : undefined}
      >
        <span>{isYouTube ? "▶" : "STEAM"}</span>
        <div className="embed-art-glow" />
      </div>
      <div className="embed-copy">
        <span className="embed-source">{isYouTube ? "YOUTUBE" : "STEAM"}</span>
        <strong>{isYouTube ? "Oyun Gecesi — takım hazır mı?" : "Haftanın birlikte oynananları"}</strong>
        <p>{isYouTube ? "Kuzens topluluğundan paylaşılan video" : "Topluluğun konuştuğu oyun ve içerikler"}</p>
      </div>
    </a>
  );
}

function Avatar({
  name,
  tone = "purple",
  size = "md",
  online,
}: {
  name: string;
  tone?: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}) {
  return (
    <span className={`avatar avatar-${tone} avatar-${size}`} aria-label={name}>
      {initials(name)}
      {typeof online === "boolean" && <i className={online ? "is-online" : ""} />}
    </span>
  );
}

function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const element = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (element.current) element.current.srcObject = stream;
  }, [stream]);
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
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [modal, setModal] = useState<
    "channel" | "channelSettings" | "roles" | "server" | "friends" | "profile" | "memberProfile" | "notifications" | null
  >(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [newServerName, setNewServerName] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelKind, setNewChannelKind] = useState<"text" | "voice">("text");
  const [channelSettingsName, setChannelSettingsName] = useState("");
  const [channelSettingsTopic, setChannelSettingsTopic] = useState("");
  const [channelSlowMode, setChannelSlowMode] = useState(0);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileCustomStatus, setProfileCustomStatus] = useState("");
  const [profilePresence, setProfilePresence] = useState<
    "online" | "idle" | "dnd" | "invisible"
  >("online");
  const [profileSaving, setProfileSaving] = useState(false);
  const [notifications, setNotifications] = useState<MentionNotification[]>([]);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [mobileChannels, setMobileChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [registrationName, setRegistrationName] = useState("");
  const [registrationUsername, setRegistrationUsername] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);
  const [roleItems, setRoleItems] = useState<Role[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [rolesCanManage, setRolesCanManage] = useState(false);
  const [friendItems, setFriendItems] = useState<FriendItem[]>([]);
  const [friendUsername, setFriendUsername] = useState("");
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const voiceStream = useRef<MediaStream | null>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const previewVideo = useRef<HTMLVideoElement | null>(null);
  const messageList = useRef<HTMLDivElement | null>(null);
  const rtcSyncAt = useRef(new Date(Date.now() - 30_000).toISOString());
  const rtcChannelId = useRef<string | null>(null);
  const peerConnections = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const makingOffers = useRef(new Set<string>());

  const selected = channels.find((channel) => channel.id === activeChannel) || channels[0];
  const activeServer =
    servers.find((server) => server.id === activeServerId) ||
    ({ id: "kuzens", name: "Kuzens", icon: "KZ" } satisfies CommunityServer);
  const selectedRole = roleItems.find((role) => role.id === selectedRoleId);
  const defaultMemberRoleId = roleItems.find((role) => role.id.endsWith(":member"))?.id || "";
  const textChannels = channels.filter((channel) => channel.kind === "text");
  const voiceChannels = channels.filter((channel) => channel.kind === "voice");
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
  const canManageMessages = (permissions & 8) !== 0;
  const canKickMembers = (permissions & 16) !== 0;
  const canBanMembers = (permissions & 32) !== 0;
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
    const normalized = search.trim().toLocaleLowerCase("tr-TR");
    return messages.filter(
      (message) =>
        message.channelId === activeChannel &&
        (!showPinnedOnly || message.pinned) &&
        (!normalized ||
          message.content.toLocaleLowerCase("tr-TR").includes(normalized) ||
          message.authorName.toLocaleLowerCase("tr-TR").includes(normalized)),
    );
  }, [activeChannel, messages, search, showPinnedOnly]);

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
          voiceChannelId:
            voiceConnected && selected?.kind === "voice" ? activeChannel : null,
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
  }, [activeChannel, activeServerId, profile, selected?.kind, sharing, voiceConnected]);

  useEffect(() => {
    const list = messageList.current;
    if (!list) return;
    list.scrollTo({
      top: list.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleMessages.length]);

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
    if (!selected || selected.kind !== "voice") return;
    const response = await apiFetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serverId: activeServerId,
        channelId: selected.id,
        recipientProfileId,
        type,
        payload,
      }),
    });
    if (!response.ok) {
      throw new Error(await responseError(response, "Ses bağlantısı kurulamadı."));
    }
  }, [activeServerId, selected]);

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
    if (!voiceConnected || !profile || selected?.kind !== "voice") {
      peerConnections.current.forEach((_, profileId) => closePeer(profileId));
      rtcSyncAt.current = new Date(Date.now() - 30_000).toISOString();
      rtcChannelId.current = null;
      return;
    }
    if (rtcChannelId.current !== selected.id) {
      peerConnections.current.forEach((_, profileId) => closePeer(profileId));
      rtcSyncAt.current = new Date(Date.now() - 30_000).toISOString();
      rtcChannelId.current = selected.id;
    }
    const participantIds = new Set(
      members
        .filter(
          (member) =>
            member.voiceChannelId === selected.id && member.id !== profile.id,
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
        channel: selected.id,
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
  }, [activeServerId, applyRtcSignal, closePeer, getOrCreatePeer, members, profile, selected, voiceConnected]);

  async function toggleVoice() {
    if (voiceConnected) {
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
      setSharing(false);
      peerConnections.current.forEach((_, profileId) => closePeer(profileId));
      setVoiceConnected(false);
      setToast({ text: "Sesli odadan ayrıldın." });
      return;
    }

    if (!selected || selected.kind !== "voice") return;
    if ((permissions & 64) === 0) {
      setToast({ text: "Bu ses odasına katılma yetkin yok.", tone: "danger" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      voiceStream.current = stream;
      const presence = await apiFetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverId: activeServerId,
          voiceChannelId: selected.id,
          sharing: false,
        }),
      });
      if (!presence.ok) {
        stream.getTracks().forEach((track) => track.stop());
        voiceStream.current = null;
        throw new Error(await responseError(presence, "Ses odasına bağlanılamadı."));
      }
      setVoiceConnected(true);
      setMuted(false);
      setToast({ text: `${selected.name} odasına bağlandın.`, tone: "success" });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : "Mikrofon izni verilmedi.",
        tone: "danger",
      });
    }
  }

  function toggleMute() {
    const next = !muted;
    voiceStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }

  async function toggleShare() {
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
          voiceChannelId: activeChannel,
          sharing: false,
        }),
      }).catch(() => undefined);
      return;
    }

    if (!voiceConnected || selected?.kind !== "voice") {
      setToast({ text: "Önce bir ses odasına bağlanmalısın.", tone: "danger" });
      return;
    }
    if ((permissions & 128) === 0) {
      setToast({ text: "Ekran paylaşma yetkin yok.", tone: "danger" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
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
          voiceChannelId: activeChannel,
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
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setToast({
        text: error instanceof Error ? error.message : "Mesaj gönderilemedi.",
        tone: "danger",
      });
    }
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

  function openChannelSettings(channel: Channel) {
    setActiveChannel(channel.id);
    setChannelSettingsName(channel.name);
    setChannelSettingsTopic(channel.topic || "");
    setChannelSlowMode(channel.slowModeSeconds || 0);
    setContextMenu(null);
    setModal("channelSettings");
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
      }),
    });
    if (!response.ok) {
      setToast({ text: await responseError(response, "Kanal ayarları kaydedilemedi."), tone: "danger" });
      return;
    }
    const data = (await response.json()) as { channel: Channel };
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
    setModal("profile");
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

  function updateMemberRole(memberTag: string, roleId: string) {
    setRoleAssignments((current) => {
      const existing = current.find((item) => item.memberTag === memberTag);
      if (existing) {
        return current.map((item) => (item.memberTag === memberTag ? { ...item, roleId } : item));
      }
      return [
        ...current,
        {
          id: `${activeServerId}:${memberTag}`,
          serverId: activeServerId,
          memberTag,
          roleId,
        },
      ];
    });
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
          serverId: activeServerId,
          roleId: selectedRole.id,
          permissions: selectedRole.permissions,
          assignments: members.map((member) => ({
            memberTag: member.tag,
            roleId:
              roleAssignments.find((item) => item.memberTag === member.tag)?.roleId ||
              roleItems.find((role) => role.id.endsWith(":member"))?.id,
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
    if (voiceConnected) await toggleVoice();
    setActiveServerId(serverId);
    setMessages([]);
    setMembers([]);
    setPermissions(0);
    setShowPinnedOnly(false);
  }

  function chooseChannel(channel: Channel) {
    if (voiceConnected && channel.kind !== "voice") {
      void toggleVoice();
    }
    setActiveChannel(channel.id);
    setMobileChannels(false);
    if (channel.kind === "voice" && !voiceConnected) {
      setToast({ text: "Katılmak için üstteki “Sese katıl” düğmesine bas." });
    }
  }

  return (
    <main className="app-shell">
      <aside className="server-rail" aria-label="Sunucular">
        <button className="brand-mark" aria-label="Kuzens ana sayfa">
          K<span>.</span>
        </button>
        <div className="rail-line" />
        {servers.map((server) => (
          <button
            className={`server-badge ${server.id === activeServerId ? "active" : ""}`}
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
            <span className="eyebrow">TOPLULUK</span>
            <strong>{activeServer.name}</strong>
          </div>
          <button className="icon-button" aria-label="Sunucu menüsü" onClick={openRoles}>
            •••
          </button>
        </header>

        <div className="server-actions">
          <button onClick={copyInvite}><span>↗</span> Arkadaşlarını davet et</button>
          <button onClick={openRoles}><span>♢</span> Roller ve yetkiler</button>
          {ownsActiveServer && activeServerId !== "kuzens" && (
            <button onClick={() => void deleteActiveServer()}><span>×</span> Topluluğu sil</button>
          )}
        </div>

        <nav className="channel-scroll" aria-label="Odalar">
          <div className="channel-section">
            <div className="section-label">
              <span>METİN ODALARI</span>
              {canManageChannels && (
                <button aria-label="Metin odası oluştur" onClick={() => { setNewChannelKind("text"); setModal("channel"); }}>+</button>
              )}
            </div>
            {textChannels.map((channel) => (
              <button
                className={`channel-row ${activeChannel === channel.id ? "active" : ""}`}
                key={channel.id}
                onClick={() => chooseChannel(channel)}
                onContextMenu={(event) =>
                  openContextMenu(event, { kind: "channel", channel })
                }
              >
                <span className="channel-symbol">#</span>
                <span>{channel.name}</span>
                {channel.id === "genel" && <em>12</em>}
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
                          onContextMenu={(event) =>
                            openContextMenu(event, { kind: "member", member })
                          }
                        >
                          <Avatar name={member.name} size="sm" tone={toneFor(member.id)} />
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
              <div><strong>Ses bağlantısı iyi</strong><small>{selected?.name} / {activeServer.name}</small></div>
            </div>
            <button onClick={toggleVoice} aria-label="Sesli odadan ayrıl">×</button>
          </section>
        )}

        <footer className="user-dock" onDoubleClick={openProfileSettings}>
          <Avatar name={profile?.displayName || "Savaş"} tone="purple" online />
          <button className="user-profile-button" onClick={openProfileSettings}>
            <strong>{profile?.displayName || "Savaş"}</strong>
            <small>{profile?.customStatus || `@${profile?.username || "savas"}`}</small>
          </button>
          <button className={muted ? "control-active" : ""} onClick={toggleMute} aria-label="Mikrofonu aç veya kapat">μ</button>
          <button className={deafened ? "control-active" : ""} onClick={() => setDeafened((value) => !value)} aria-label="Sesi aç veya kapat">◉</button>
          <a className="dock-link" href="/hukuk" aria-label="Hukuk ve güven merkezi">§</a>
        </footer>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <button className="mobile-menu" onClick={() => setMobileChannels((value) => !value)} aria-label="Odaları aç">
            ☰
          </button>
          <span className="header-channel-icon">{selected?.kind === "voice" ? "◖" : "#"}</span>
          <div className="channel-heading">
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
            onClick={() => {
              setModal("notifications");
              void loadNotifications();
            }}
            aria-label={`Bildirimler, ${notifications.length} okunmamış`}
          >
            ♢
            {notifications.length > 0 && <b>{Math.min(99, notifications.length)}</b>}
          </button>
          <label className="search-box">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Mesajlarda ara"
              aria-label="Mesajlarda ara"
            />
            <kbd>⌘ K</kbd>
          </label>
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
                  onContextMenu={(event) =>
                    openContextMenu(event, { kind: "member", member })
                  }
                >
                  <div className="speaker-orbit">
                    <Avatar name={member.name} tone={toneFor(member.id)} size="lg" />
                  </div>
                  <strong>{member.name}</strong>
                  <span>{member.id === profile?.id ? "Sen" : memberStatus(member)}</span>
                  <button aria-label={`${member.name} ses düzeyi`}>•••</button>
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

            <div className="remote-audio" aria-hidden="true">
              {Object.entries(remoteStreams).map(([memberId, stream]) => (
                <RemoteAudio key={memberId} stream={stream} muted={deafened} />
              ))}
            </div>

            <div className="voice-controls">
              <button className={muted ? "danger" : ""} onClick={toggleMute}><span>μ</span>{muted ? "Mikrofon kapalı" : "Mikrofon"}</button>
              <button className={deafened ? "danger" : ""} onClick={() => setDeafened((value) => !value)}><span>◉</span>{deafened ? "Ses kapalı" : "Kulaklık"}</button>
              <button className={sharing ? "active" : ""} onClick={toggleShare}><span>▣</span>Ekran paylaş</button>
              <button className={voiceConnected ? "hangup" : "connect"} onClick={toggleVoice}><span>{voiceConnected ? "×" : "◖"}</span>{voiceConnected ? "Ayrıl" : "Bağlan"}</button>
            </div>
            <p className="privacy-note">Sesin tarayıcının yankı ve gürültü engellemesiyle işlenir. Kayıt yapılmaz.</p>
          </div>
        ) : (
          <>
            <div className="message-list" ref={messageList}>
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
                    {!compact && <Avatar name={message.authorName} tone={message.authorName === "Savaş" ? "purple" : message.authorName === "Ece" ? "pink" : message.authorName === "Batu" ? "blue" : "orange"} />}
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
                      <p className={message.deletedAt ? "deleted-message" : ""}>
                        <MessageText
                          content={message.content}
                          members={members}
                          onMention={insertMention}
                        />
                        {message.editedAt && !message.deletedAt && <small> (düzenlendi)</small>}
                      </p>
                      {!message.deletedAt && <LinkEmbed content={message.content} />}
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
                    </div>
                    {!message.id.startsWith("local-") && !message.deletedAt && (
                      <div className="message-tools">
                        {(message.authorProfileId === profile?.id ||
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
                      <Avatar name={member.name} tone={toneFor(member.id)} size="sm" />
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
                <button type="button" aria-label="Dosya ekle">+</button>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
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
              onContextMenu={(event) =>
                openContextMenu(event, { kind: "member", member })
              }
            >
              <Avatar name={member.name} tone={toneFor(member.id)} online />
              <span className="member-copy"><strong>{member.name}</strong><small>{memberStatus(member)}</small></span>
              {member.id !== profile?.id && !member.role?.id.endsWith(":owner") && (
                <span className="member-moderation">
                  {canKickMembers && (
                    <button
                      onClick={() => void moderateMember(member, "kick")}
                      title="Topluluktan çıkar"
                      aria-label={`${member.name} kullanıcısını topluluktan çıkar`}
                    >
                      Çıkar
                    </button>
                  )}
                  {canBanMembers && (
                    <button
                      className="danger"
                      onClick={() => void moderateMember(member, "ban")}
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
              onContextMenu={(event) =>
                openContextMenu(event, { kind: "member", member })
              }
            >
              <Avatar name={member.name} tone={toneFor(member.id)} online={false} />
              <span className="member-copy"><strong>{member.name}</strong><small>{memberStatus(member)}</small></span>
              {member.id !== profile?.id && !member.role?.id.endsWith(":owner") && (
                <span className="member-moderation">
                  {canKickMembers && (
                    <button
                      onClick={() => void moderateMember(member, "kick")}
                      title="Topluluktan çıkar"
                      aria-label={`${member.name} kullanıcısını topluluktan çıkar`}
                    >
                      Çıkar
                    </button>
                  )}
                  {canBanMembers && (
                    <button
                      className="danger"
                      onClick={() => void moderateMember(member, "ban")}
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
                  <Avatar name={member.name} tone={toneFor(member.id)} online={false} />
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
                    <b>{selectedRole ? permissionOptions.filter((item) => (selectedRole.permissions & item.bit) !== 0).length : 0}/8 açık</b>
                  </div>
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
                    <div><strong>Üye rolleri</strong><span>Her üyenin temel rolünü seç.</span></div>
                  </div>
                  <div className="member-role-grid">
                    {members.map((member) => (
                      <label key={member.id}>
                        <span><Avatar name={member.name} tone={toneFor(member.id)} size="sm" /><b>{member.name}</b></span>
                        <select
                          value={roleAssignments.find((item) => item.memberTag === member.tag)?.roleId || defaultMemberRoleId}
                          disabled={member.role?.id.endsWith(":owner")}
                          onChange={(event) => updateMemberRole(member.tag, event.target.value)}
                        >
                          {roleItems
                            .filter(
                              (role) =>
                                !role.id.endsWith(":owner") ||
                                member.role?.id.endsWith(":owner"),
                            )
                            .map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                        </select>
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
            <div className="modal-actions">
              <button type="button" onClick={() => setModal(null)}>Vazgeç</button>
              <button className="primary-button">Değişiklikleri kaydet</button>
            </div>
          </form>
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
              <Avatar name={profileDisplayName || profile.displayName} tone="purple" size="lg" online />
              <div>
                <strong>{profileDisplayName || profile.displayName}</strong>
                <span>@{profileUsername || profile.username}</span>
                <small>{profileCustomStatus || "Bir durum belirle"}</small>
              </div>
            </div>
            <span className="eyebrow">KULLANICI AYARLARI</span>
            <h2>Profilini düzenle</h2>
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
              online={viewingMember.online}
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
                <button onClick={() => void requestFriend(viewingMember)}>Arkadaş ekle</button>
              )}
            </div>
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
          <div className="registration-loader"><span>K.</span><p>Hesabın hazırlanıyor…</p></div>
        </div>
      )}

      {profile === null && (
        <div className="registration-gate">
          <div className="registration-card">
            <aside className="registration-brand">
              <span className="registration-logo">K.</span>
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
              <button onClick={() => { setNewChannelKind("text"); setModal("channel"); }}><span>#</span>Metin kanalı oluştur</button>
              <button onClick={() => { setNewChannelKind("voice"); setModal("channel"); }}><span>◖</span>Ses kanalı oluştur</button>
              <i />
              <button onClick={openRoles}><span>♢</span>Roller ve yetkiler</button>
            </>
          )}
          {contextMenu.kind === "channel" && contextMenu.channel && (
            <>
              <span className="context-title">#{contextMenu.channel.name}</span>
              <button onClick={() => { chooseChannel(contextMenu.channel!); setToast({ text: "Kanal okundu işaretlendi.", tone: "success" }); }}><span>✓</span>Okundu işaretle</button>
              <button onClick={() => void copyInvite()}><span>↗</span>Davet oluştur</button>
              <button onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/?sunucu=${activeServerId}&kanal=${contextMenu.channel!.id}`); setToast({ text: "Kanal bağlantısı kopyalandı.", tone: "success" }); }}><span>⛓</span>Bağlantıyı kopyala</button>
              {canManageChannels && (
                <>
                  <i />
                  <button onClick={() => openChannelSettings(contextMenu.channel!)}><span>⚙</span>Kanalı düzenle</button>
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
                <Avatar name={contextMenu.member.name} tone={toneFor(contextMenu.member.id)} size="sm" online={contextMenu.member.online} />
                <span><strong>{contextMenu.member.name}</strong><small>{contextMenu.member.tag}</small></span>
              </div>
              <button onClick={() => { setViewingMember(contextMenu.member!); setModal("memberProfile"); }}><span>◉</span>Profili görüntüle</button>
              <button onClick={() => insertMention(contextMenu.member!.tag)}><span>@</span>Bahset</button>
              {contextMenu.member.id !== profile?.id && (
                <button onClick={() => void requestFriend(contextMenu.member!)}><span>＋</span>Arkadaş ekle</button>
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

      {toast && <div className={`toast ${toast.tone || ""}`}><span>{toast.tone === "success" ? "✓" : toast.tone === "danger" ? "!" : "i"}</span>{toast.text}</div>}
    </main>
  );
}
