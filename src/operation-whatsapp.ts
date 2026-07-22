const digitsOnly = (value: string) => value.replace(/\D/g, "");

export function operationWhatsAppUrl(
  phone: string,
  message = "",
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
) {
  const digits = digitsOnly(phone);
  const query = `${digits ? `phone=${digits}` : ""}${message ? `${digits ? "&" : ""}text=${encodeURIComponent(message)}` : ""}`;
  const webUrl = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  if (!/Android/i.test(userAgent)) return webUrl;

  const installBusinessUrl = "https://play.google.com/store/apps/details?id=com.whatsapp.w4b";
  return `intent://send?${query}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(installBusinessUrl)};end`;
}

export function openOperationWhatsApp(
  phone: string,
  message = "",
  popup?: Window | null,
) {
  const url = operationWhatsAppUrl(phone, message);
  if (popup) popup.location.href = url;
  else window.location.href = url;
}
