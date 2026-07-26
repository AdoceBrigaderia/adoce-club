import { getBffSession } from "./services/bff-auth";

const RETURN_KEY = "adoce-customer-checkin-return";

export function rememberCustomerCheckInReturn(hash = window.location.hash) {
  if (!hash.startsWith("#check-in")) return;
  sessionStorage.setItem(RETURN_KEY, hash);
}

export function pendingCustomerCheckInReturn() {
  const value = sessionStorage.getItem(RETURN_KEY) || "";
  return value.startsWith("#check-in") ? value : "";
}

export function clearCustomerCheckInReturn() {
  sessionStorage.removeItem(RETURN_KEY);
}

export function installCustomerCheckInReturn() {
  const remember = () => rememberCustomerCheckInReturn();
  const resume = async () => {
    if (!window.location.hash.startsWith("#minha-conta")) return;
    const target = pendingCustomerCheckInReturn();
    if (!target) return;
    const session = await getBffSession().catch(() => null);
    if (!session || session.user.surface !== "client") return;
    clearCustomerCheckInReturn();
    window.location.hash = target.slice(1);
  };

  remember();
  window.addEventListener("hashchange", remember);
  window.addEventListener("hashchange", resume);
  window.addEventListener("adoce-profile-ready", resume);
  return () => {
    window.removeEventListener("hashchange", remember);
    window.removeEventListener("hashchange", resume);
    window.removeEventListener("adoce-profile-ready", resume);
  };
}
