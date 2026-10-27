<script lang="ts">
	/**
	 * Festive trim strung across the top of the idle screen, the way a home
	 * is decorated for the day:
	 *   - a toran (marigolds + mango leaves) on Marathi / Hindu festival days,
	 *   - bunting in the day's colours (Holi, Independence Day, July 4th...),
	 *   - string lights for Christmas and New Year,
	 *   - and akash kandil (star lanterns) all through Diwali.
	 *
	 * Drawn once as inline SVG (8 swags across the 800px frame); only the
	 * lanterns' sway and the lights' twinkle animate (transform / opacity).
	 */
	let { id, festiveDay }: { id: string; festiveDay: boolean } = $props();

	const TORAN = new Set([
		'sankranti', 'maha-shivratri', 'padwa', 'ram-navami', 'hanuman-jayanti', 'akshaya-tritiya',
		'ashadhi-ekadashi', 'guru-purnima', 'nag-panchami', 'rakhi', 'gokulashtami', 'pola', 'ganesh',
		'navratri', 'dasara', 'kojagiri', 'diwali', 'tripuri-purnima'
	]);
	const BUNTING: Record<string, string[]> = {
		holi: ['#EC4899', '#22C55E', '#FACC15', '#3B82F6', '#A855F7'],
		republic: ['#FF9933', '#FFFFFF', '#138808'],
		'india-independence': ['#FF9933', '#FFFFFF', '#138808'],
		eid: ['#16A34A', '#FACC15', '#FFFFFF'],
		easter: ['#F9A8D4', '#C4B5FD', '#FDE68A', '#86EFAC'],
		'mothers-day': ['#F472B6', '#FFFFFF', '#FB7185'],
		valentines: ['#F472B6', '#FFFFFF', '#E11D48'],
		'fathers-day': ['#3B82F6', '#FACC15', '#FFFFFF'],
		stpatricks: ['#16A34A', '#4ADE80', '#FACC15'],
		july4: ['#DC2626', '#FFFFFF', '#2563EB'],
		halloween: ['#F97316', '#7C3AED', '#1F2937'],
		thanksgiving: ['#B45309', '#F59E0B', '#DC2626']
	};
	const LIGHTS = new Set(['christmas', 'winter']);
	const BULBS = ['#EF4444', '#22C55E', '#FACC15', '#3B82F6'];

	const kind = $derived(
		!festiveDay ? null : TORAN.has(id) ? 'toran' : LIGHTS.has(id) ? 'lights' : 'bunting'
	);
	const colors = $derived(BUNTING[id] ?? ['#F97316', '#FACC15', '#22C55E', '#3B82F6']);

	// ---- geometry: hooks every 100px at y=6, each swag dips 16px ----
	const HOOKS = Array.from({ length: 9 }, (_, i) => i * 100);
	const at = (x0: number, t: number) => ({ x: x0 + 100 * t, y: 6 + 64 * t * (1 - t) });
	const rope = HOOKS.slice(0, -1)
		.map((x) => `M${x},6 Q${x + 50},38 ${x + 100},6`)
		.join(' ');
	const along = (n: number) =>
		HOOKS.slice(0, -1).flatMap((x, s) =>
			Array.from({ length: n }, (_, i) => ({ ...at(x, (i + 1) / (n + 1)), i: s * n + i }))
		);
	const MARIGOLDS = along(8);
	const FLAGS = along(5);
	const LAMPS = along(5);
	const LEAF = 'M0,0 Q5,13 0,26 Q-5,13 0,0 Z';
</script>

{#if kind}
	<svg class="trim" viewBox="0 0 800 60" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
		{#if kind === 'toran'}
			<!-- mango leaves hang at each hook, marigolds along the string -->
			{#each HOOKS as x (x)}
				<g transform="translate({x},4)">
					{#each [-24, 0, 24] as a (a)}
						<g transform="rotate({a})">
							<path d={LEAF} fill="#16A34A" stroke="#334155" stroke-width="1.6" />
							<path d="M0,3 L0,22" stroke="#86EFAC" stroke-width="1.4" />
						</g>
					{/each}
				</g>
			{/each}
			<path d={rope} fill="none" stroke="#92400E" stroke-width="2" />
			{#each MARIGOLDS as m (m.i)}
				<circle cx={m.x} cy={m.y} r="6.5" fill={m.i % 3 === 1 ? '#FACC15' : '#F97316'} stroke="#334155" stroke-width="1.6" />
				<circle cx={m.x} cy={m.y} r="2.6" fill={m.i % 3 === 1 ? '#EA580C' : '#FDE047'} />
			{/each}
			<!-- a short drop of marigolds from the middle of every swag -->
			{#each HOOKS.slice(0, -1) as x (x)}
				<line x1={x + 50} y1="22" x2={x + 50} y2="44" stroke="#92400E" stroke-width="1.5" />
				<circle cx={x + 50} cy="33" r="5.5" fill="#FACC15" stroke="#334155" stroke-width="1.5" />
				<circle cx={x + 50} cy="45" r="6" fill="#F97316" stroke="#334155" stroke-width="1.5" />
			{/each}
		{:else if kind === 'bunting'}
			<path d={rope} fill="none" stroke="#334155" stroke-width="2" />
			{#each FLAGS as f (f.i)}
				<path
					d="M{f.x - 9},{f.y} L{f.x + 9},{f.y} L{f.x},{f.y + 22} Z"
					fill={colors[f.i % colors.length]}
					stroke="#334155"
					stroke-width="2"
					stroke-linejoin="round"
				/>
			{/each}
		{:else}
			<path d={rope} fill="none" stroke="#1E293B" stroke-width="2" />
			{#each LAMPS as l (l.i)}
				<g class="bulb" class:alt={l.i % 2 === 1}>
					<rect x={l.x - 3} y={l.y} width="6" height="5" rx="1" fill="#475569" />
					<ellipse cx={l.x} cy={l.y + 12} rx="5" ry="7.5" fill={BULBS[l.i % BULBS.length]} stroke="#334155" stroke-width="1.5" />
				</g>
			{/each}
		{/if}
	</svg>
{/if}

{#if id === 'diwali'}
	<!-- akash kandil: star lanterns hung up for the whole Diwali week -->
	{#each [{ left: '12%', len: 40, delay: 0 }, { left: '86%', len: 44, delay: -1.7 }] as k (k.left)}
		<svg class="kandil" style="left:{k.left}; animation-delay:{k.delay}s" viewBox="0 0 60 {k.len + 74}" width="72" height={(k.len + 74) * 1.2} aria-hidden="true">
			<defs>
				<radialGradient id="kandil-glow" cx="50%" cy="50%" r="50%">
					<stop offset="0" stop-color="#FFF7AE" />
					<stop offset=".5" stop-color="#FDBA4D" />
					<stop offset="1" stop-color="#EA580C" />
				</radialGradient>
			</defs>
			<line x1="30" y1="0" x2="30" y2={k.len} stroke="#334155" stroke-width="2" />
			<g transform="translate(30,{k.len + 24})">
				<polygon
					points="0,-23 6.5,-9 22,-7 10.5,3.5 13.5,19 0,11 -13.5,19 -10.5,3.5 -22,-7 -6.5,-9"
					fill="url(#kandil-glow)"
					stroke="#334155"
					stroke-width="2.5"
					stroke-linejoin="round"
				/>
				<circle r="5" fill="#FFF7AE" stroke="#334155" stroke-width="1.5" />
				<!-- paper tails -->
				{#each [-9, -3, 3, 9] as x, i (x)}
					<path
						d="M{x},14 q2.5,8 0,16 q-2.5,8 0,16"
						fill="none"
						stroke={i % 2 ? '#FACC15' : '#DC2626'}
						stroke-width="3.5"
						stroke-linecap="round"
					/>
				{/each}
			</g>
		</svg>
	{/each}
{/if}

<style>
	.trim {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 60px;
		pointer-events: none;
		filter: drop-shadow(2px 3px 0 rgba(15, 23, 42, 0.25));
	}
	.bulb {
		animation: twinkle 2.4s ease-in-out infinite;
	}
	.bulb.alt {
		animation-delay: -1.2s;
	}
	.kandil {
		position: absolute;
		top: 0;
		margin-left: -36px;
		pointer-events: none;
		transform-origin: 50% 0;
		animation: sway 4.5s ease-in-out infinite;
		will-change: transform;
		filter: drop-shadow(2px 3px 0 rgba(15, 23, 42, 0.3));
	}
	@keyframes sway {
		0%,
		100% {
			transform: rotate(-5deg);
		}
		50% {
			transform: rotate(5deg);
		}
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bulb,
		.kandil {
			animation: none;
		}
	}
</style>
