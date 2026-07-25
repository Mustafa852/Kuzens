"use client";

import { FormEvent, useState } from "react";

export function PrivacyRequestForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/privacy-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicantName: form.get("applicantName"),
          email: form.get("email"),
          requestType: form.get("requestType"),
          details: form.get("details"),
        }),
      });
      const data = (await response.json()) as { requestId?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Başvuru alınamadı.");
      setStatus("done");
      setMessage(`Başvurun kayda alındı. Takip kodu: ${data.requestId}`);
      event.currentTarget.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Başvuru alınamadı.");
    }
  }

  return (
    <form className="privacy-form" onSubmit={submit}>
      <div className="form-row">
        <label>Ad soyad<input name="applicantName" minLength={2} maxLength={80} required /></label>
        <label>E-posta<input name="email" type="email" required /></label>
      </div>
      <label>
        Talep türü
        <select name="requestType" required defaultValue="">
          <option value="" disabled>Seçiniz</option>
          <option value="information">Bilgi ve erişim</option>
          <option value="correction">Düzeltme</option>
          <option value="deletion">Silme / yok etme</option>
          <option value="objection">İtiraz</option>
          <option value="other">Diğer</option>
        </select>
      </label>
      <label>
        Talebin
        <textarea name="details" minLength={10} maxLength={3000} rows={6} required placeholder="Talebini açık ve anlaşılır biçimde yaz." />
      </label>
      <p className="form-note">Kimliğinin doğrulanması için senden ek bilgi istenebilir. Başvurular en geç 30 gün içinde sonuçlandırılır.</p>
      <button disabled={status === "sending"}>{status === "sending" ? "Gönderiliyor…" : "Başvuruyu gönder"}</button>
      {message && <div className={`form-message ${status}`}>{message}</div>}
    </form>
  );
}
