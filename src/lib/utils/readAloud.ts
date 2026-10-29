/**
 * What the 🔊 button reads for each kind of card. The kiosk asks for exactly
 * this text, and the server rebuilds the same texts from its own lists
 * (src/lib/server/readable.ts) to check it may say it, so nobody on the home
 * network can make the dashboard say anything else.
 */

const end = (s: string) => (/[.!?…]["”’']?$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

export const quoteSpeech = (q: { text: string; author: string }) => `${end(q.text)} By ${end(q.author)}`;

export const factSpeech = (f: { text: string }) => `Did you know? ${end(f.text)}`;

/** the question; with the punchline once it's been revealed */
export const jokeSpeech = (j: { q: string; a: string }, revealed: boolean) => (revealed ? `${end(j.q)} ${end(j.a)}` : end(j.q));

export const wordSpeech = (w: { word: string; meaning: string; sentence: string }) =>
	`Today's word is ${w.word}. It means ${end(w.meaning)} ${end(w.sentence)}`;

export const dinoSpeech = (d: { name: string; means: string; fact: string }) =>
	`${end(d.name)} Its name means ${end(d.means)} ${end(d.fact)}`;

export const storySpeech = (s: { title: string; paragraphs: string[] }) => [s.title, ...s.paragraphs].map(end).join(' ');
