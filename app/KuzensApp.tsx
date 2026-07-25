"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./kuzens.css";

type Channel = {
  id: string;
  serverId: string;
  name: string;
  kind: "text" | "voice";
  position: number;
};

type ChatMessage = {
  id: string;
  channelId: string;
  authorName: string;
  authorTag: string;
  content: string;
  createdAt: string;
};

type Toast = { text: string; tone?: "success" | "danger" };

type Profile = {
  id: string;
  displayName: string;
  username: string;
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

const seedMessages: ChatMessage[] = [
  {
    id: "seed-1",
    channelId: "genel",
    authorName: "Ece",
    authorTag: "@ecenur",
    content: "Akşam oyun gecesi var mı? Yeni oda baya iyi olmuş ✨",
    createdAt: "2026-07-25T18:42:00.000Z",
  },
  {
    id: "seed-2",
    channelId: "genel",
    authorName: "Batu",
    authorTag: "@batuhan",
    content: "Ben 21.30 gibi buradayım. Şunu da izleyin: https://youtube.com/watch?v=kuzens",
    createdAt: "2026-07-25T18:44:00.000Z",
  },
  {
    id: "seed-3",
    channelId: "genel",
    authorName: "Deniz",
    authorTag: "@deniz",
    content: "Tamamdır, Muhabbet odasına geçeriz. Ekran paylaşımı da deneriz.",
    createdAt: "2026-07-25T18:47:00.000Z",
  },
  {
    id: "seed-4",
    channelId: "oyun-gecesi",
    authorName: "Mert",
    authorTag: "@mert",
    content: "Bu akşam co-op listesi: Deep Rock, Lethal Company, Valheim.",
    createdAt: "2026-07-25T17:22:00.000Z",
  },
];

const members = [
  { name: "Ece", tag: "@ecenur", status: "Valorant oynuyor", tone: "pink", online: true },
  { name: "Batu", tag: "@batuhan", status: "Muhabbet odasında", tone: "blue", online: true },
  { name: "Deniz", tag: "@deniz", status: "YouTube izliyor", tone: "orange", online: true },
  { name: "Mert", tag: "@mert", status: "15 dk önce", tone: "green", online: false },
  { name: "Selin", tag: "@selin", status: "2 saat önce", tone: "purple", online: false },
];

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

function LinkEmbed({ content }: { content: string }) {
  const isYouTube = /youtu\.?be|youtube\.com/i.test(content);
  const isSteam = /store\.steampowered\.com|steamcommunity\.com/i.test(content);
  if (!isYouTube && !isSteam) return null;

  return (
    <article className="link-embed">
      <div className={`embed-art ${isYouTube ? "youtube" : "steam"}`}>
        <span>{isYouTube ? "▶" : "STEAM"}</span>
        <div className="embed-art-glow" />
      </div>
      <div className="embed-copy">
        <span className="embed-source">{isYouTube ? "YOUTUBE" : "STEAM"}</span>
        <strong>{isYouTube ? "Oyun Gecesi — takım hazır mı?" : "Haftanın birlikte oynananları"}</strong>
        <p>{isYouTube ? "Kuzens topluluğundan paylaşılan video" : "Topluluğun konuştuğu oyun ve içerikler"}</p>
      </div>
    </article>
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

export function KuzensApp() {
  const [channels, setChannels] = useState<Channel[]>(fallbackChannels);
  const [activeChannel, setActiveChannel] = useState("genel");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [modal, setModal] = useState<"channel" | "roles" | null>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelKind, setNewChannelKind] = useState<"text" | "voice">("text");
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
  const voiceStream = useRef<MediaStream | null>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const previewVideo = useRef<HTMLVideoElement | null>(null);
  const messageList = useRef<HTMLDivElement | null>(null);

  const selected = channels.find((channel) => channel.id === activeChannel) || channels[0];
  const selectedRole = roleItems.find((role) => role.id === selectedRoleId);
  const defaultMemberRoleId = roleItems.find((role) => role.id.endsWith(":member"))?.id || "";
  const textChannels = channels.filter((channel) => channel.kind === "text");
  const voiceChannels = channels.filter((channel) => channel.kind === "voice");

  const visibleMessages = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("tr-TR");
    return messages.filter(
      (message) =>
        message.channelId === activeChannel &&
        (!normalized ||
          message.content.toLocaleLowerCase("tr-TR").includes(normalized) ||
          message.authorName.toLocaleLowerCase("tr-TR").includes(normalized)),
    );
  }, [activeChannel, messages, search]);

  useEffect(() => {
    fetch("/api/profile")
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
    fetch("/api/channels")
      .then((response) => response.json())
      .then((data: { channels?: Channel[] }) => {
        if (data.channels?.length) setChannels(data.channels);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selected?.kind !== "text") return;
    let cancelled = false;
    setLoadingMessages(true);
    fetch(`/api/messages?channel=${encodeURIComponent(activeChannel)}`)
      .then((response) => response.json())
      .then((data: { messages?: ChatMessage[] }) => {
        if (!cancelled && data.messages?.length) {
          setMessages((current) => {
            const otherChannels = current.filter((message) => message.channelId !== activeChannel);
            return [...otherChannels, ...data.messages!];
          });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeChannel, selected?.kind]);

  useEffect(() => {
    const list = messageList.current;
    if (!list) return;
    list.scrollTo({
      top: list.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleMessages.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      voiceStream.current?.getTracks().forEach((track) => track.stop());
      displayStream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function toggleVoice() {
    if (voiceConnected) {
      voiceStream.current?.getTracks().forEach((track) => track.stop());
      voiceStream.current = null;
      setVoiceConnected(false);
      setToast({ text: "Sesli odadan ayrıldın." });
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
      setVoiceConnected(true);
      setMuted(false);
      setToast({ text: "Muhabbet odasına bağlandın.", tone: "success" });
    } catch {
      setToast({ text: "Mikrofon izni verilmedi.", tone: "danger" });
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
      displayStream.current?.getTracks().forEach((track) => track.stop());
      displayStream.current = null;
      if (previewVideo.current) previewVideo.current.srcObject = null;
      setSharing(false);
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
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setSharing(false);
        displayStream.current = null;
      });
      setSharing(true);
      setToast({ text: "Ekran paylaşımı başladı.", tone: "success" });
    } catch {
      setToast({ text: "Ekran paylaşımı iptal edildi.", tone: "danger" });
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
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setDraft("");

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId: activeChannel, content }),
      });
      if (!response.ok) throw new Error("save failed");
      const data = (await response.json()) as { message: ChatMessage };
      setMessages((current) =>
        current.map((message) => (message.id === optimistic.id ? data.message : message)),
      );
    } catch {
      setToast({ text: "Demo modunda: mesaj yalnızca bu oturumda.", tone: "danger" });
    }
  }

  async function createChannel(event: FormEvent) {
    event.preventDefault();
    const name = newChannelName.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, "-");
    if (!name) return;
    const optimistic: Channel = {
      id: `${name}-${Date.now()}`,
      serverId: "kuzens",
      name,
      kind: newChannelKind,
      position: channels.length,
    };
    setChannels((current) => [...current, optimistic]);
    setModal(null);
    setNewChannelName("");
    setActiveChannel(optimistic.id);

    try {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, kind: newChannelKind, serverId: "kuzens" }),
      });
      if (!response.ok) throw new Error("create failed");
      const data = (await response.json()) as { channel: Channel };
      setChannels((current) =>
        current.map((channel) => (channel.id === optimistic.id ? data.channel : channel)),
      );
      setActiveChannel(data.channel.id);
      setToast({ text: `#${data.channel.name} oluşturuldu.`, tone: "success" });
    } catch {
      setToast({ text: "Demo modunda: oda yalnızca bu oturumda.", tone: "danger" });
    }
  }

  async function registerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegistrationSubmitting(true);
    setRegistrationError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: registrationName,
          username: registrationUsername,
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
    try {
      const response = await fetch("/api/roles?server=kuzens");
      const data = (await response.json()) as {
        roles?: Role[];
        assignments?: RoleAssignment[];
      };
      const nextRoles = data.roles || [];
      setRoleItems(nextRoles);
      setRoleAssignments(data.assignments || []);
      setSelectedRoleId((current) => current || nextRoles[0]?.id || "");
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
          id: `kuzens:${memberTag}`,
          serverId: "kuzens",
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
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverId: "kuzens",
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

  async function copyInvite() {
    const invite = `${window.location.origin}/?davet=kuzens-7F2K`;
    try {
      await navigator.clipboard.writeText(invite);
      setToast({ text: "Davet bağlantısı kopyalandı.", tone: "success" });
    } catch {
      setToast({ text: invite });
    }
  }

  function chooseChannel(channel: Channel) {
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
        <button className="server-badge active" aria-label="Kuzens sunucusu">
          KZ
          <i />
        </button>
        <button className="server-badge friends" aria-label="Arkadaşlar">
          5
        </button>
        <button className="server-add" aria-label="Sunucu ekle" onClick={() => setToast({ text: "Sunucu oluşturma sihirbazı sıradaki adımda." })}>
          +
        </button>
        <div className="rail-spacer" />
        <a className="rail-help" href="/hukuk" aria-label="Hukuk ve güven merkezi">
          ?
        </a>
      </aside>

      <aside className={`channel-sidebar ${mobileChannels ? "mobile-open" : ""}`}>
        <header className="server-header">
          <div>
            <span className="eyebrow">TOPLULUK</span>
            <strong>Kuzens</strong>
          </div>
          <button className="icon-button" aria-label="Sunucu menüsü" onClick={openRoles}>
            •••
          </button>
        </header>

        <div className="server-actions">
          <button onClick={copyInvite}><span>↗</span> Arkadaşlarını davet et</button>
          <button onClick={openRoles}><span>♢</span> Roller ve yetkiler</button>
        </div>

        <nav className="channel-scroll" aria-label="Odalar">
          <div className="channel-section">
            <div className="section-label">
              <span>METİN ODALARI</span>
              <button aria-label="Metin odası oluştur" onClick={() => { setNewChannelKind("text"); setModal("channel"); }}>+</button>
            </div>
            {textChannels.map((channel) => (
              <button
                className={`channel-row ${activeChannel === channel.id ? "active" : ""}`}
                key={channel.id}
                onClick={() => chooseChannel(channel)}
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
              <button aria-label="Ses odası oluştur" onClick={() => { setNewChannelKind("voice"); setModal("channel"); }}>+</button>
            </div>
            {voiceChannels.map((channel) => (
              <div key={channel.id}>
                <button
                  className={`channel-row ${activeChannel === channel.id ? "active" : ""}`}
                  onClick={() => chooseChannel(channel)}
                >
                  <span className="channel-symbol">◖</span>
                  <span>{channel.name}</span>
                  {channel.id === "muhabbet" && <em className="live-dot">3</em>}
                </button>
                {channel.id === "muhabbet" && (
                  <div className="voice-members">
                    <span><Avatar name="Batu" size="sm" tone="blue" /> Batu <i>)))</i></span>
                    <span><Avatar name="Ece" size="sm" tone="pink" /> Ece</span>
                    <span><Avatar name="Deniz" size="sm" tone="orange" /> Deniz</span>
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
              <div><strong>Ses bağlantısı iyi</strong><small>Muhabbet / Kuzens</small></div>
            </div>
            <button onClick={toggleVoice} aria-label="Sesli odadan ayrıl">×</button>
          </section>
        )}

        <footer className="user-dock">
          <Avatar name={profile?.displayName || "Savaş"} tone="purple" online />
          <div><strong>{profile?.displayName || "Savaş"}</strong><small>@{profile?.username || "savas"}</small></div>
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
            <span>{selected?.kind === "voice" ? "Sesli buluşma odası" : "Kuzens topluluğunun ortak alanı"}</span>
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
            </div>
          )}
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
                <p>3 kişi konuşuyor · Düşük gecikmeli ses</p>
              </div>
              <div className="connection-grade"><i /> Bağlantı iyi</div>
            </div>

            <div className="speaker-grid">
              {members.slice(0, 3).map((member, index) => (
                <article className={`speaker-card ${index === 1 ? "speaking" : ""}`} key={member.name}>
                  <div className="speaker-orbit">
                    <Avatar name={member.name} tone={member.tone} size="lg" />
                  </div>
                  <strong>{member.name}</strong>
                  <span>{index === 1 ? "Konuşuyor" : "Dinliyor"}</span>
                  <button aria-label={`${member.name} ses düzeyi`}>•••</button>
                </article>
              ))}
              <article className={`screen-card ${sharing ? "sharing" : ""}`}>
                {sharing ? (
                  <video ref={previewVideo} autoPlay muted playsInline />
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
                  <article className={`message ${compact ? "compact" : ""}`} key={message.id}>
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
                      <p>{message.content}</p>
                      <LinkEmbed content={message.content} />
                    </div>
                    <div className="message-tools">
                      <button aria-label="Tepki ekle">☺</button>
                      <button aria-label="Yanıtla">↩</button>
                      <button aria-label="Daha fazla">•••</button>
                    </div>
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
              <div className="reply-hint"><span>✦</span> Kuzens’e hoş geldin — güzel bir şey söyle.</div>
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
          <span><i /> 3 çevrimiçi</span>
          <button onClick={copyInvite}>+ Davet et</button>
        </div>
        <div className="member-list">
          <span className="member-group">ÇEVRİMİÇİ — 3</span>
          {members.filter((member) => member.online).map((member) => (
            <button className="member-row" key={member.tag}>
              <Avatar name={member.name} tone={member.tone} online />
              <span><strong>{member.name}</strong><small>{member.status}</small></span>
            </button>
          ))}
          <span className="member-group">ÇEVRİMDIŞI — 2</span>
          {members.filter((member) => !member.online).map((member) => (
            <button className="member-row offline" key={member.tag}>
              <Avatar name={member.name} tone={member.tone} online={false} />
              <span><strong>{member.name}</strong><small>{member.status}</small></span>
            </button>
          ))}
        </div>
        <article className="community-card">
          <span>✦</span>
          <strong>Topluluğu büyüt</strong>
          <p>Davet bağlantını paylaş, kuzenleri bir araya getir.</p>
          <button onClick={copyInvite}>Bağlantıyı kopyala</button>
        </article>
      </aside>

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
                      <label key={member.tag}>
                        <span><Avatar name={member.name} tone={member.tone} size="sm" /><b>{member.name}</b></span>
                        <select
                          value={roleAssignments.find((item) => item.memberTag === member.tag)?.roleId || defaultMemberRoleId}
                          onChange={(event) => updateMemberRole(member.tag, event.target.value)}
                        >
                          {roleItems.map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!profile?.isOwner && !rolesLoading && (
              <p className="owner-note">Bu ayarları yalnızca ilk kayıt olan Kurucu hesabı değiştirebilir.</p>
            )}
            <button className="primary-button" disabled={rolesLoading || rolesSaving || !profile?.isOwner} onClick={saveRoles}>
              {rolesSaving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
            </button>
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

      {toast && <div className={`toast ${toast.tone || ""}`}><span>{toast.tone === "success" ? "✓" : toast.tone === "danger" ? "!" : "i"}</span>{toast.text}</div>}
    </main>
  );
}
