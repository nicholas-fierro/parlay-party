import type { User } from "../types";

export const USERS: User[] = [
  { id: "nick", name: "Nick", email: "nick@example.com", color: "#a3e635" },
  { id: "alex", name: "Alex", email: "alex@example.com", color: "#f472b6" },
  { id: "sam", name: "Sam", email: "sam@example.com", color: "#60a5fa" },
  { id: "jordan", name: "Jordan", email: "jordan@example.com", color: "#fbbf24" },
  { id: "taylor", name: "Taylor", email: "taylor@example.com", color: "#34d399" },
];

export const USER_BY_ID: Record<string, User> = Object.fromEntries(USERS.map((u) => [u.id, u]));
