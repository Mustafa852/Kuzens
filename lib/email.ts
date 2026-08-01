import { env } from "cloudflare:workers";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

export async function sendLoginCode(
  email: string,
  code: string,
  purpose: "registration" | "login",
) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.KUZENS_EMAIL_FROM?.trim();
  const replyTo = env.KUZENS_EMAIL_REPLY_TO?.trim();
  if (!apiKey || !from) throw new Error("E-posta gönderimi henüz yapılandırılmadı.");

  const title = purpose === "registration" ? "E-posta adresini doğrula" : "Girişini doğrula";
  const eyebrow = purpose === "registration" ? "KUZENS’E HOŞ GELDİN" : "GÜVENLİ GİRİŞ";
  const description = purpose === "registration"
    ? "Hesabını tamamlamak için aşağıdaki doğrulama kodunu Kuzens’e gir."
    : "Kuzens hesabına girişini tamamlamak için aşağıdaki doğrulama kodunu kullan.";
  const safeCode = escapeHtml(code);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      reply_to: replyTo || undefined,
      subject: "Kuzens doğrulama kodun",
      text: `${title}\n\n${description}\n\nDoğrulama kodun: ${code}\n\nKod 10 dakika geçerlidir ve yalnızca bir kez kullanılabilir. Bu kodu kimseyle paylaşma. Bu işlemi sen başlatmadıysan e-postayı yok say.\n\nKuzens Güvenlik Ekibi`,
      html: `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#090811;color:#f8f7ff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Kuzens doğrulama kodun hazır. Kod 10 dakika geçerlidir.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#090811;background-image:radial-gradient(circle at 50% 0%,#2d175a 0,#131021 38%,#090811 72%);">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
            <tr>
              <td align="center" style="padding:0 0 22px;">
                <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:17px;background-color:#7c5cff;background-image:linear-gradient(135deg,#a77bff,#6847ed);color:#ffffff;font-size:25px;font-weight:900;text-align:center;box-shadow:0 14px 34px rgba(124,92,255,.32);">K.</div>
                <div style="margin-top:12px;color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-.02em;">Kuzens</div>
              </td>
            </tr>
            <tr>
              <td style="padding:1px;border-radius:25px;background-color:#30294a;background-image:linear-gradient(135deg,rgba(167,123,255,.75),rgba(61,221,170,.28),rgba(255,255,255,.08));">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-radius:24px;background:#17141f;">
                  <tr>
                    <td align="center" style="padding:38px 32px 34px;">
                      <div style="color:#a98cff;font-size:11px;font-weight:800;letter-spacing:.18em;">${eyebrow}</div>
                      <h1 style="margin:12px 0 10px;color:#ffffff;font-size:27px;line-height:1.25;font-weight:800;letter-spacing:-.03em;">${title}</h1>
                      <p style="max-width:430px;margin:0 auto;color:#b9b3c8;font-size:15px;line-height:1.65;">${description}</p>
                      <div style="margin:28px 0 12px;padding:24px 14px;border:1px solid #42365f;border-radius:17px;background:#0e0c15;box-shadow:inset 0 0 24px rgba(124,92,255,.08);">
                        <div style="margin-bottom:9px;color:#777086;font-size:10px;font-weight:800;letter-spacing:.16em;">DOĞRULAMA KODU</div>
                        <div aria-label="Kuzens doğrulama kodu ${safeCode}" style="color:#ffffff;font-size:38px;line-height:1.15;font-weight:900;letter-spacing:.24em;font-variant-numeric:tabular-nums;user-select:all;-webkit-user-select:all;">${safeCode}</div>
                      </div>
                      <p style="margin:0;color:#817a91;font-size:12px;line-height:1.55;">Kodu seçip kopyalayabilir, siteye veya Kuzens uygulamasına yapıştırabilirsin.</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border-top:1px solid #2b2734;">
                        <tr>
                          <td style="padding-top:22px;color:#938ca2;font-size:12px;line-height:1.65;">
                            <strong style="color:#d8d3e3;">10 dakika geçerli</strong> · Tek kullanımlık<br>
                            Güvenliğin için bu kodu kimseyle paylaşma. Bu işlemi sen başlatmadıysan e-postayı yok sayabilirsin.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 12px 0;color:#676170;font-size:11px;line-height:1.6;">
                Kuzens Güvenlik Ekibi<br>
                Bu e-posta otomatik olarak gönderilmiştir.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Kuzens email error", response.status, detail.slice(0, 300));
    throw new Error("Doğrulama e-postası gönderilemedi.");
  }
}
