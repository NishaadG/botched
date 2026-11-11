/**
 * Light masking for public text (lounge messages, feedback shown on /stats). Private game chat is left alone.
 * Deliberately small: catches the common slurs and swears in English and Hinglish without mangling normal words.
 */
const WORDS = [
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bitch", "bastard", "asshole", "dick", "cunt", "slut", "whore",
  "nigger", "nigga", "faggot", "retard", "chutiya", "chutiye", "madarchod", "behenchod", "bhenchod", "bc", "mc", "bsdk",
  "gandu", "randi", "lund", "lauda", "lavda", "harami",
];
const PATTERN = new RegExp(String.raw`\b(${WORDS.join("|")})\b`, "gi");

export function maskProfanity(text: string) {
  return text.replace(PATTERN, (w) => w[0] + "*".repeat(Math.max(1, w.length - 1)));
}

export const hasProfanity = (text: string) => new RegExp(PATTERN.source, "i").test(text);
