"use client";

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";
import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { getKuzensFirebaseAuth } from "./firebase-client";
import "./auth.css";

type AuthMode = "login" | "register" | "verify";
type ChallengePurpose = "registration" | "login";

type ChallengeState = {
  id: string;
  purpose: ChallengePurpose;
  maskedEmail: string;
  expiresAt: number;
};

function authErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) {
    return "E-posta veya şifre hatalı.";
  }
  if (code.includes("email-already-in-use")) return "Bu e-posta zaten kayıtlı.";
  if (code.includes("invalid-email")) return "Geçerli bir e-posta adresi yaz.";
  if (code.includes("weak-password")) return "Daha güçlü bir şifre seç.";
  if (code.includes("too-many-requests")) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
  if (code.includes("network-request-failed")) return "İnternet bağlantısı kurulamadı.";
  return error instanceof Error ? error.message : "İşlem tamamlanamadı.";
}

async function authRequest(
  path: string,
  body: unknown,
  user?: User | null,
) {
  const headers = new Headers({
    "content-type": "application/json",
    "x-kuzens-request": "1",
  });
  if (user) headers.set("authorization", `Bearer ${await user.getIdToken(true)}`);
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    authenticated?: boolean;
    challengeId?: string;
    codeRequired?: boolean;
    expiresAt?: number;
    maskedEmail?: string;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}

export function KuzensAuthGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [birthConfirmed, setBirthConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [communityAccepted, setCommunityAccepted] = useState(false);
  const [noticeRead, setNoticeRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const codeInput = useRef<HTMLInputElement>(null);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 10,
      letter: /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password),
      number: /\d/.test(password),
    }),
    [password],
  );

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (response) => (await response.json()) as { authenticated?: boolean })
      .then((data) => setAuthenticated(data.authenticated === true))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (mode === "verify") codeInput.current?.focus();
  }, [mode]);

  async function finishLogin(user: User) {
    const result = await authRequest("/api/auth/login", { action: "complete" }, user);
    if (result.codeRequired && result.challengeId && result.expiresAt) {
      setChallenge({
        id: result.challengeId,
        purpose: "login",
        maskedEmail: result.maskedEmail || email,
        expiresAt: result.expiresAt,
      });
      setMode("verify");
      setNotice("Giriş doğrulama kodunu e-posta adresine gönderdik.");
      return;
    }
    setAuthenticated(true);
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const auth = await getKuzensFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await finishLogin(credential.user);
    } catch (loginError) {
      setError(authErrorMessage(loginError));
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!Object.values(passwordChecks).every(Boolean)) {
      setError("Şifren en az 10 karakter olmalı; harf ve rakam içermeli.");
      return;
    }
    if (password !== passwordAgain) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }
    if (!birthConfirmed || !termsAccepted || !communityAccepted || !noticeRead) {
      setError("Kayıt için zorunlu onayları tamamlamalısın.");
      return;
    }

    setBusy(true);
    try {
      const auth = await getKuzensFirebaseAuth();
      let user: User;
      try {
        user = (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
      } catch (createError) {
        const createCode =
          typeof createError === "object" && createError && "code" in createError
            ? String((createError as { code?: unknown }).code || "")
            : "";
        if (!createCode.includes("email-already-in-use")) throw createError;
        user = (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
      }

      const result = await authRequest(
        "/api/auth/register",
        {
          action: "start",
          birthConfirmed: true,
          termsAccepted,
          noticeRead,
          communityAccepted,
        },
        user,
      );
      if (!result.challengeId || !result.expiresAt) throw new Error("Doğrulama kodu oluşturulamadı.");
      setChallenge({
        id: result.challengeId,
        purpose: "registration",
        maskedEmail: result.maskedEmail || email,
        expiresAt: result.expiresAt,
      });
      setCode("");
      setMode("verify");
      setNotice("6 haneli doğrulama kodunu e-posta adresine gönderdik.");
    } catch (registrationError) {
      setError(authErrorMessage(registrationError));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || !/^[0-9]{6}$/.test(code)) {
      setError("E-postandaki 6 haneli kodu yaz.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const auth = await getKuzensFirebaseAuth();
      if (!auth.currentUser) throw new Error("Oturum süresi doldu. Yeniden giriş yap.");
      const path = challenge.purpose === "registration" ? "/api/auth/register" : "/api/auth/login";
      const result = await authRequest(
        path,
        { action: "verify", challengeId: challenge.id, code },
        auth.currentUser,
      );
      if (!result.authenticated) throw new Error("Oturum açılamadı.");
      setAuthenticated(true);
    } catch (verificationError) {
      setError(authErrorMessage(verificationError));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      const auth = await getKuzensFirebaseAuth();
      if (!auth.currentUser) throw new Error("Oturum süresi doldu. Yeniden giriş yap.");
      const path = challenge.purpose === "registration" ? "/api/auth/register" : "/api/auth/login";
      const body =
        challenge.purpose === "registration"
          ? {
              action: "start",
              birthConfirmed: true,
              termsAccepted,
              noticeRead,
              communityAccepted,
            }
          : { action: "complete" };
      const result = await authRequest(path, body, auth.currentUser);
      if (!result.challengeId || !result.expiresAt) throw new Error("Yeni kod gönderilemedi.");
      setChallenge({ ...challenge, id: result.challengeId, expiresAt: result.expiresAt });
      setCode("");
      setNotice("Yeni doğrulama kodu gönderildi.");
    } catch (resendError) {
      setError(authErrorMessage(resendError));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError("Önce e-posta adresini yaz.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const auth = await getKuzensFirebaseAuth();
      await sendPasswordResetEmail(auth, email.trim());
      setNotice("Hesap bulunuyorsa şifre yenileme bağlantısı e-postana gönderildi.");
    } catch (resetError) {
      setError(authErrorMessage(resetError));
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="auth-loading" role="status">
        <span>K</span>
        <p>Kuzens güvenli biçimde hazırlanıyor…</p>
      </div>
    );
  }
  if (authenticated) return <>{children}</>;

  return (
    <main className="auth-shell">
      <section className="auth-visual" aria-label="Kuzens">
        <div className="auth-mark">K.</div>
        <div className="auth-visual-copy">
          <span>KUZENS’E HOŞ GELDİN</span>
          <h1>Birlikte kalmanın<br />en kolay yolu.</h1>
          <p>Mesajlaş, sesli odalara katıl ve topluluğunu kendi kurallarınla yönet.</p>
        </div>
        <div className="auth-security-note"><i>✓</i><span><b>Güvenli oturum</b>Şifren Kuzens veritabanında tutulmaz.</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          {mode !== "verify" && (
            <div className="auth-tabs" role="tablist" aria-label="Hesap işlemleri">
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Giriş yap</button>
              <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); setNotice(""); }}>Kayıt ol</button>
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={submitLogin}>
              <header><span>TEKRAR HOŞ GELDİN</span><h2>Kuzens’e giriş yap</h2><p>Toplulukların ve arkadaşların seni bekliyor.</p></header>
              <label>E-POSTA<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@eposta.com" /></label>
              <label>ŞİFRE<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Şifren" /></label>
              <button className="auth-link" type="button" onClick={() => void resetPassword()} disabled={busy}>Şifremi unuttum</button>
              {notice && <div className="auth-message success">{notice}</div>}
              {error && <div className="auth-message error">{error}</div>}
              <button className="auth-submit" disabled={busy}>{busy ? "Giriş yapılıyor…" : "Giriş yap"}</button>
              <p className="auth-switch">Hesabın yok mu? <button type="button" onClick={() => setMode("register")}>Kayıt ol</button></p>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={submitRegistration}>
              <header><span>ÜCRETSİZ HESAP</span><h2>Kuzens hesabını oluştur</h2><p>E-postanı doğrula, ardından profilini tamamla.</p></header>
              <label>E-POSTA<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@eposta.com" /></label>
              <div className="auth-field-grid">
                <label>ŞİFRE<input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="En az 10 karakter" /></label>
                <label>ŞİFRE TEKRAR<input type="password" required minLength={10} autoComplete="new-password" value={passwordAgain} onChange={(event) => setPasswordAgain(event.target.value)} placeholder="Şifreni yeniden yaz" /></label>
              </div>
              <div className="password-rules" aria-live="polite">
                <span className={passwordChecks.length ? "ok" : ""}>10+ karakter</span>
                <span className={passwordChecks.letter ? "ok" : ""}>Harf</span>
                <span className={passwordChecks.number ? "ok" : ""}>Rakam</span>
              </div>
              <div className="auth-consents">
                <label><input type="checkbox" checked={birthConfirmed} onChange={(event) => setBirthConfirmed(event.target.checked)} /><i /><span>18 yaşını doldurduğumu doğruluyorum.</span></label>
                <label><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><i /><span><a href="/hukuk/kullanim-kosullari" target="_blank">Kullanım Koşulları</a>nı kabul ediyorum.</span></label>
                <label><input type="checkbox" checked={communityAccepted} onChange={(event) => setCommunityAccepted(event.target.checked)} /><i /><span><a href="/hukuk/topluluk-kurallari" target="_blank">Topluluk Kuralları</a>nı kabul ediyorum.</span></label>
                <label><input type="checkbox" checked={noticeRead} onChange={(event) => setNoticeRead(event.target.checked)} /><i /><span><a href="/hukuk/aydinlatma" target="_blank">KVKK Aydınlatma Metni</a>ni okudum. Bu onay, açık rıza beyanı değildir.</span></label>
              </div>
              {notice && <div className="auth-message success">{notice}</div>}
              {error && <div className="auth-message error">{error}</div>}
              <button className="auth-submit" disabled={busy}>{busy ? "Kod gönderiliyor…" : "Kayıt ol ve kodu gönder"}</button>
              <p className="auth-switch">Zaten hesabın var mı? <button type="button" onClick={() => setMode("login")}>Giriş yap</button></p>
            </form>
          )}

          {mode === "verify" && challenge && (
            <form onSubmit={submitCode} className="auth-verification">
              <button className="auth-back" type="button" onClick={() => { setMode(challenge.purpose === "registration" ? "register" : "login"); setChallenge(null); setCode(""); setError(""); }}>← Geri dön</button>
              <div className="auth-code-icon">✦</div>
              <header><span>E-POSTA DOĞRULAMA</span><h2>6 haneli kodu yaz</h2><p><b>{challenge.maskedEmail}</b> adresine gönderdiğimiz kod 10 dakika geçerli.</p></header>
              <input ref={codeInput} className="auth-code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-label="Doğrulama kodu" placeholder="000000" />
              {notice && <div className="auth-message success">{notice}</div>}
              {error && <div className="auth-message error">{error}</div>}
              <button className="auth-submit" disabled={busy || code.length !== 6}>{busy ? "Doğrulanıyor…" : "Kodu doğrula ve devam et"}</button>
              <button className="auth-resend" type="button" onClick={() => void resendCode()} disabled={busy}>Yeni kod gönder</button>
            </form>
          )}

          <footer>Devam ederek <a href="/hukuk/gizlilik" target="_blank">Gizlilik Politikası</a>nı inceleyebilirsin.</footer>
        </div>
      </section>
    </main>
  );
}
