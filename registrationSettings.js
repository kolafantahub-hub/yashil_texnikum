export const REGISTRATION_STORAGE_KEY = "yashil-texnikum-registration-v1";

export function normalizeTelegramBotUrl(value) {
  try {
    const url = new URL(value.trim());
    const isTelegramHost =
      url.hostname === "t.me" || url.hostname === "telegram.me";
    if (
      url.protocol !== "https:" ||
      !isTelegramHost ||
      !url.pathname.split("/").filter(Boolean).length ||
      url.username ||
      url.password ||
      url.port
    ) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

export function isRegistrationSettings(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.url === "string" &&
    typeof value.enabled === "boolean"
  );
}
