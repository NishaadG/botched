/** Aliases, colours and round prompts. Everyone (bot included) gets a random alias, so nobody can tell who is who. */

export const ALIASES = [
  { alias: "Teal Otter", color: "#2dd4bf", avatar: "🦦" },
  { alias: "Mango Fox", color: "#fb923c", avatar: "🦊" },
  { alias: "Violet Owl", color: "#a78bfa", avatar: "🦉" },
  { alias: "Lime Frog", color: "#a3e635", avatar: "🐸" },
  { alias: "Rose Panda", color: "#f472b6", avatar: "🐼" },
  { alias: "Sky Whale", color: "#38bdf8", avatar: "🐳" },
  { alias: "Gold Lion", color: "#facc15", avatar: "🦁" },
  { alias: "Coral Crab", color: "#f87171", avatar: "🦀" },
  { alias: "Mint Koala", color: "#6ee7b7", avatar: "🐨" },
  { alias: "Plum Bat", color: "#c084fc", avatar: "🦇" },
];

export const PROMPTS = [
  "What's the most chaotic thing that happened in your last group trip?",
  "Defend your most unpopular food opinion.",
  "What did you do last Sunday? Be honest.",
  "Describe your morning routine in the worst possible way.",
  "What's a small thing that instantly ruins your day?",
  "Which app on your phone do you use way too much, and why?",
  "Tell the group about the worst teacher or boss you've had.",
  "What's your go-to excuse when you're running late?",
  "If you had to eat one street food every day forever, which one?",
  "What's the last thing you googled? No lying.",
  "Rate your sleep schedule out of 10 and explain.",
  "What's a movie everyone loves that you secretly can't stand?",
  "What would you do with a random Wednesday off?",
  "What's the most useless skill you have?",
  "Describe your phone's lock screen without saying what it is.",
];

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
