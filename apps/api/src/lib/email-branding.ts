export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

export interface BrandedEmailInput {
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  eyebrow: string;
  footerNote: string;
  title: string;
}

/**
 * The shared EsseBeauty email chrome (header mark, eyebrow, headline, optional CTA,
 * plain-link + footer note) — the same visual language as the review-invitation
 * email, factored out so reminder and campaign emails read as the same product
 * instead of a plain <h1>/<p> dump. Only bodyHtml is trusted, pre-escaped HTML from
 * the caller (it's meant to hold markup like <strong>); every other field —
 * eyebrow, title, footerNote, ctaLabel — is escaped here, so callers should pass
 * those as plain text.
 */
export function brandedEmailHtml(input: BrandedEmailInput): string {
  const title = escapeHtml(input.title);
  const eyebrow = escapeHtml(input.eyebrow);
  const ctaUrl = input.ctaUrl ? escapeAttribute(input.ctaUrl) : undefined;
  const ctaLabel = input.ctaLabel ? escapeHtml(input.ctaLabel) : undefined;

  return `<!doctype html>
<html lang="it">
  <body style="margin:0;background:#fbf7f2;color:#24161d;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fbf7f2;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;">
            <tr>
              <td style="padding:34px 28px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-family:Manrope,Georgia,serif;font-size:22px;font-weight:650;letter-spacing:-.03em;color:#24161d;">
                      <span style="display:inline-block;margin-right:10px;border-radius:11px;background:#6d244c;padding:7px 10px;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:900;line-height:1;">E</span>EsseBeauty
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 48px;">
                <p style="margin:0 0 20px;color:#6d244c;font-size:12px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;">${eyebrow}</p>
                <h1 style="max-width:560px;margin:0;font-family:Manrope,Georgia,serif;font-size:36px;line-height:1.08;font-weight:570;letter-spacing:-.03em;color:#24161d;">${title}</h1>
                <div style="max-width:560px;margin:22px 0 0;color:#4a3f43;font-size:16px;line-height:1.7;">${input.bodyHtml}</div>
                ${ctaUrl && ctaLabel ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:30px 0 0;">
                  <tr>
                    <td>
                      <a href="${ctaUrl}" style="display:inline-block;min-height:44px;border-radius:999px;background:#6d244c;padding:15px 25px;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 10px 24px rgba(109,36,76,.20);">${ctaLabel}</a>
                    </td>
                  </tr>
                </table>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 38px;border-top:1px solid #ecdfe3;">
                ${ctaUrl ? `<p style="margin:0 0 14px;color:#8b7d83;font-size:12px;line-height:1.6;">Se il pulsante non funziona, copia questo link nel browser:<br><a href="${ctaUrl}" style="color:#6d244c;word-break:break-all;">${ctaUrl}</a></p>` : ""}
                <p style="margin:0;color:#91858a;font-size:12px;line-height:1.5;">${escapeHtml(input.footerNote)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
