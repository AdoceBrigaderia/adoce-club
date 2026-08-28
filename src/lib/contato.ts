export function formatarTelefoneBR(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

export function nomeLegivel(value: string) {
  return value.trim().replace(/([a-zà-öø-ÿ])([A-ZÀ-ÖØ-Þ])/g, "$1 $2");
}

export function nomeCompletoValido(value: string) {
  return value.trim().split(/\s+/).filter((part) => part.length >= 2).length >= 2;
}
