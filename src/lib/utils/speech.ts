/**
 * Text for speaking (and for the AI's words on screen): no emoji or text
 * smileys. The voice reads "😊" out as "smiling face with smiling eyes",
 * and the kiosk has no emoji font to show them in plain text.
 */

// pictographs plus what glues them together: skin tones, joiners, variation
// selectors, keycaps and flags
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}‍︎️⃣]/gu;
// :) :-D ;P :( <3 ^_^ xD, standing on their own
const SMILEY = /(^|\s)(?:[:;=8][-'o^]?[()DPpOo3*|\\/[\]]+|<3+|\^_*\^|[xX]D+)(?=\s|[.,!?]|$)/g;

export function withoutEmoji(text: string): string {
	return text
		.replace(EMOJI, '')
		.replace(SMILEY, '$1')
		.replace(/\s+([.,!?])/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
}
