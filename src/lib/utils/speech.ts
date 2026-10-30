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

/**
 * Text as it should be spoken: no emoji, and units in words, so "71°F" is
 * "71 degrees Fahrenheit" instead of "71 F".
 */
export function forSpeech(text: string): string {
	return withoutEmoji(text)
		.replace(/(\d)\s*°\s*F\b/g, '$1 degrees Fahrenheit')
		.replace(/(\d)\s*°\s*C\b/g, '$1 degrees Celsius')
		.replace(/(\d)\s*°/g, '$1 degrees')
		.replace(/(\d)\s*mph\b/gi, '$1 miles per hour');
}

export function withoutEmoji(text: string): string {
	return text
		.replace(EMOJI, '')
		.replace(SMILEY, '$1')
		.replace(/\s+([.,!?])/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
}
