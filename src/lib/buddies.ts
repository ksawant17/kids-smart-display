/** Animal buddies a kid can pick (config: kids[].avatar), drawn by components/Buddy.svelte. */
export const BUDDIES = ['bear', 'monkey', 'fox', 'bunny', 'panda', 'cat', 'dino'] as const;
export type BuddyKind = (typeof BUDDIES)[number];
export const isBuddy = (v: unknown): v is BuddyKind => (BUDDIES as readonly unknown[]).includes(v);

/** Clothes colours handed out to kids who don't set their own. */
export const BUDDY_COLORS = ['#b388ff', '#3b82f6', '#f472b6', '#22c55e', '#f59e0b', '#14b8a6'];
