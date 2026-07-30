const LOWERCASE_PARTICLES = new Set([
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
]);

const ROMAN_SUFFIXES = new Set([
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
]);

export const CUSTOMER_NAME_NORMALIZED_EVENT = "adoce:customer-name-normalized";

function capitalizeSegment(segment: string) {
  if (!segment) return segment;
  const lower = segment.toLocaleLowerCase("pt-BR");
  return `${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}`;
}

function normalizeCompoundWord(word: string) {
  return word
    .split(/([-’'])/u)
    .map((segment) =>
      segment === "-" || segment === "'" || segment === "’"
        ? segment
        : capitalizeSegment(segment),
    )
    .join("");
}

export function normalizeCustomerName(value: string) {
  const clean = value
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();

  if (!clean) return "";

  return clean
    .split(" ")
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (ROMAN_SUFFIXES.has(lower)) return lower.toLocaleUpperCase("pt-BR");
      if (index > 0 && LOWERCASE_PARTICLES.has(lower)) return lower;
      return normalizeCompoundWord(word);
    })
    .join(" ");
}

export function shouldNormalizeCustomerName(value: string) {
  const clean = value.replace(/\s+/gu, " ").trim();
  return Boolean(clean) && normalizeCustomerName(clean) !== clean;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(input, value);
}

function showNormalizationNotice(name: string) {
  const id = "adoce-customer-name-normalized-notice";
  const current = document.getElementById(id);
  const notice = current || document.createElement("div");
  notice.id = id;
  notice.className = "customer-name-normalized-notice";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.textContent = `Ajustamos seu nome para: ${name}`;
  if (!current) document.body.appendChild(notice);
  window.setTimeout(() => notice.remove(), 4200);
}

function isCustomerNameInput(target: EventTarget | null): target is HTMLInputElement {
  if (!(target instanceof HTMLInputElement)) return false;
  if (target.disabled || target.readOnly) return false;
  if (target.type !== "text" && target.type !== "search") return false;
  return (
    target.dataset.personName === "true" ||
    target.autocomplete.toLocaleLowerCase() === "name"
  );
}

export function installCustomerNameNormalization(root: Document = document) {
  const normalizeOnBlur = (event: Event) => {
    if (!isCustomerNameInput(event.target)) return;
    const input = event.target;
    const previous = input.value;
    const normalized = normalizeCustomerName(previous);
    if (!normalized || normalized === previous) return;

    setNativeInputValue(input, normalized);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    showNormalizationNotice(normalized);
    window.dispatchEvent(
      new CustomEvent(CUSTOMER_NAME_NORMALIZED_EVENT, {
        detail: { previous, normalized },
      }),
    );
  };

  root.addEventListener("blur", normalizeOnBlur, true);
  return () => root.removeEventListener("blur", normalizeOnBlur, true);
}
