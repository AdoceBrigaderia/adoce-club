const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*+-_?";
const ALL = `${LOWERCASE}${UPPERCASE}${DIGITS}${SYMBOLS}`;

function secureIndex(maxExclusive: number) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 256) {
    throw new Error("Limite inválido para geração segura.");
  }

  const rejectionLimit = 256 - (256 % maxExclusive);
  const bytes = new Uint8Array(1);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= rejectionLimit);
  return bytes[0] % maxExclusive;
}

function pick(alphabet: string) {
  return alphabet[secureIndex(alphabet.length)];
}

export function generateTemporaryPassword(length = 20) {
  if (!Number.isInteger(length) || length < 12 || length > 64) {
    throw new Error("A senha temporária deve ter entre 12 e 64 caracteres.");
  }

  const characters = [
    pick(LOWERCASE),
    pick(UPPERCASE),
    pick(DIGITS),
    pick(SYMBOLS),
  ];

  while (characters.length < length) characters.push(pick(ALL));

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}

export function isStrongTemporaryPassword(password: string) {
  return password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}
