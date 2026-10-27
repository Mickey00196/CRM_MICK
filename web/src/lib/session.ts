/** Who is signed in, as reported by /api/me. */
let userName = "";

export function setUserName(name: string | null | undefined) {
  userName = (name ?? "").trim();
}

/** First name for greetings, or "" when unknown. */
export function firstName(): string {
  return userName.split(/\s+/)[0] ?? "";
}
