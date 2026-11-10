// PIN da gestão guardado neste aparelho (digita uma vez por aparelho).
const KEY = 'a2-owner-pin';

export function getOwnerPin(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function setOwnerPin(pin: string | null) {
  try {
    if (pin) localStorage.setItem(KEY, pin);
    else localStorage.removeItem(KEY);
  } catch {
    /* sem storage */
  }
}
