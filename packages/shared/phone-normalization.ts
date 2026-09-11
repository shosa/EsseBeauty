export function normalizePhoneE164(value: string | null | undefined, defaultCallingCode = "39"): string | null {
  const input = value?.trim() ?? "";
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  const countryCode = defaultCallingCode.replace(/\D/g, "");
  if (!digits || !countryCode) return null;

  let internationalDigits: string;
  if (input.startsWith("+")) internationalDigits = digits;
  else if (input.startsWith("00")) internationalDigits = digits.slice(2);
  else if (digits.startsWith(countryCode) && digits.length >= 10) internationalDigits = digits;
  else internationalDigits = `${countryCode}${digits}`;

  return internationalDigits.length >= 8 && internationalDigits.length <= 15
    ? `+${internationalDigits}`
    : null;
}
