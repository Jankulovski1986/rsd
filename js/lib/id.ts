// Generate a compact ID: timestamp (YYYYMMDDHHmmss) + random suffix (default 4 chars).
export function generateFriendlyId(suffixLength = 4): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne 0/1/O/I zur Vermeidung von Verwechslungen
  let suffix = "";
  for (let i = 0; i < suffixLength; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `${ts}-${suffix}`;
}

// Nur den zufälligen Teil erzeugen (z.B. für andere Kombinationen).
export function randomSuffix(length = 4): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
