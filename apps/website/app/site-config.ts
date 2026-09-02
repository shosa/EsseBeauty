const appUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000/login";
const demoEmail = process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "info@essebeauty.it";
const subject = encodeURIComponent("Richiesta demo EsseBeauty");
const body = encodeURIComponent("Buongiorno, vorrei scoprire EsseBeauty e richiedere una demo.");

export const SITE_CONFIG = {
  appUrl,
  demoEmail,
  demoMailto: `mailto:${demoEmail}?subject=${subject}&body=${body}`,
} as const;
