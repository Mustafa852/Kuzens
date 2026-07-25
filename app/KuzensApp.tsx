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
  const voiceStream = useRef<MediaStream | null>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const previewVideo = useRef<HTMLVideoElement | null>(null);
  const messagesEnd = useRef<HTMLDivElement | null>(null);

  const selected = channels.find((channel) => channel.id === activeChannel) || channels[0];
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
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
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
      authorName: "Savaş",
      authorTag: "@savas",
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

  async function copyInvite() {
    const invite = `${window.location.origin}/davet/kuzens-7F2K`;
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
        <button className="rail-help" aria-label="Yardım">
          ?
        </button>
      </aside>

      <aside className={`channel-sidebar ${mobileChannels ? "mobile-open" : ""}`}>
        <header className="server-header">
          <div>
            <span className="eyebrow">TOPLULUK</span>
            <strong>Kuzens</strong>
          </div>
          <button className="icon-button" aria-label="Sunucu menüsü" onClick={() => setModal("roles")}>
            •••
          </button>
        </header>

        <div className="server-actions">
          <button onClick={copyInvite}><span>↗</span> Arkadaşlarını davet et</button>
          <button onClick={() => setModal("roles")}><span>♢</span> Roller ve yetkiler</button>
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
          <Avatar name="Savaş" tone="purple" online />
          <div><strong>Savaş</strong><small>@savas</small></div>
          <button className={muted ? "control-active" : ""} onClick={toggleMute} aria-label="Mikrofonu aç veya kapat">μ</button>
          <button className={deafened ? "control-active" : ""} onClick={() => setDeafened((value) => !value)} aria-label="Sesi aç veya kapat">◉</button>
          <button aria-label="Ayarlar" onClick={() => setToast({ text: "Ayarlar bölümü sıradaki adımda." })}>⚙</button>
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
            <>
              <button className="header-action" aria-label="Bildirimler">♢<i /></button>
              <button className="header-action" aria-label="Sabitlenenler">⌁</button>
            </>
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
            <div className="message-list">
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
              <div ref={messagesEnd} />
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
            <p>Rol sırası, üyelerin neleri yönetebileceğini belirler.</p>
            <div className="role-list">
              <div><i className="role-owner" /><span><strong>Kurucu</strong><small>Tüm yetkiler</small></span><b>1 üye</b></div>
              <div><i className="role-mod" /><span><strong>Moderatör</strong><small>Mesaj ve üye yönetimi</small></span><b>2 üye</b></div>
              <div><i className="role-member" /><span><strong>Kuzen</strong><small>Standart topluluk erişimi</small></span><b>5 üye</b></div>
            </div>
            <button className="primary-button" onClick={() => { setModal(null); setToast({ text: "Yetki editörü sıradaki geliştirme adımında." }); }}>Yetkileri düzenle</button>
          </section>
        </div>
      )}

      {toast && <div className={`toast ${toast.tone || ""}`}><span>{toast.tone === "success" ? "✓" : toast.tone === "danger" ? "!" : "i"}</span>{toast.text}</div>}
    </main>
  );
}
