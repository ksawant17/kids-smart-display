/** The bedtime story picker on FUN: where the story happens and what it's about (`say`: for the AI). */

export const STORY_PLACES = [
	{ id: 'forest', label: 'Forest', say: 'in a forest', emoji: '1f332' },
	{ id: 'space', label: 'Space', say: 'in outer space', emoji: '1f680' },
	{ id: 'ocean', label: 'Sea', say: 'under the sea', emoji: '1f420' },
	{ id: 'castle', label: 'Castle', say: 'in a castle', emoji: '1f3f0' },
	{ id: 'dinos', label: 'Dino land', say: 'in a land of friendly dinosaurs', emoji: '1f995' },
	{ id: 'clouds', label: 'Clouds', say: 'up in the clouds', emoji: '2601' }
] as const;

export const STORY_THEMES = [
	{ id: 'friends', label: 'New friend', say: 'making a new friend', emoji: '1f91d' },
	{ id: 'brave', label: 'Brave', say: 'being brave', emoji: '1f4aa' },
	{ id: 'lost', label: 'Lost & found', say: 'finding something that was lost', emoji: '1f50d' },
	{ id: 'helping', label: 'Helping', say: 'helping someone', emoji: '1f49b' },
	{ id: 'silly', label: 'Silly day', say: 'a silly, funny day', emoji: '1f92a' },
	{ id: 'festival', label: 'Festival', say: 'celebrating a festival with family', emoji: '1fa94' }
] as const;

export const isStoryPlace = (v: unknown) => STORY_PLACES.some((p) => p.id === v);
export const isStoryTheme = (v: unknown) => STORY_THEMES.some((t) => t.id === v);
