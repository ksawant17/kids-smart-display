# Kids Smart Display

A full-screen, touch-first dashboard for kids, built for a **Raspberry Pi 5**
and the **official 7" touchscreen (800×480)**. Each morning it answers what the
kids want to know: *What's the weather? Is there school today? What should I
wear?* In the evening it looks ahead to tomorrow. Each kid has an animal
buddy dressed for the weather, and there's a daily dinosaur, joke, word, math
puzzle and fun fact. It also watches for severe weather alerts and dims or
switches off the screen when nobody's around. A PIN-locked **Grown-ups** tab
handles the settings on the screen itself (or from a phone): notes for the
kids, names and buddies, weather place by ZIP code, school calendar, bedtime,
Wi-Fi, date & time, updates, restart and power off.

It's a **SvelteKit** app shown in **Chromium kiosk mode** inside the **cage**
Wayland compositor, so no desktop environment is needed. Everything is big,
colourful, sticker-styled and works with fat fingers; no mouse or keyboard.

| | |
|---|---|
| ![TODAY tab](docs/screenshots/today.png) | ![Full weather report](docs/screenshots/weather-report.png) |
| ![CALENDAR tab](docs/screenshots/calendar.png) | ![Calendar day details](docs/screenshots/calendar-day.png) |
| ![WARDROBE tab](docs/screenshots/wardrobe.png) | ![FUN tab: joke corner](docs/screenshots/fun.png) |
| ![QUOTE tab](docs/screenshots/quote.png) | ![Grown-ups tab](docs/screenshots/admin.png) |
| ![Grown-ups: a note for the kids](docs/screenshots/admin-notes.png) | ![Grown-ups: kids and buddies](docs/screenshots/admin-kids.png) |

*Screenshots use the example config (Alex & Sam), taken on an October evening:
night sky, Halloween decorations and witch hats.*

## Hardware

- Raspberry Pi 5 (a Pi 4 should work too) running Raspberry Pi OS Lite (64-bit)
- Official Raspberry Pi 7" DSI touchscreen (800×480)
- Network access for weather and the school calendar (it keeps working
  offline on the last data it downloaded)

## Quick start

```sh
git clone https://github.com/ksawant17/kids-smart-display.git kids-smart-dashboard
cd kids-smart-dashboard
npm ci
cp config/dashboard.example.json config/dashboard.json   # then edit: kids, location, school feed
npm run build
PORT=3000 node build/index.js                             # open http://<pi>:3000
```

Requires **Node.js 22+**. `config/dashboard.json` is git-ignored, so your
kids' names and location never end up in the repo. Without it, the example
config is used. To run it full-screen on the Pi at boot, see
[Running on the Pi](#running-on-the-pi).

## The five tabs

| Tab        | What it does |
|------------|--------------|
| **TODAY**  | Three big answers, one column each, every column a button: **Weather** (temperature, a kid-language sentence, the next hours, tomorrow at a glance; tap or swipe down for the full report), **School** (today's status, the next school event with a "sleeps" countdown; tap for that day in CALENDAR) and **What to Wear** (each kid's animal buddy dressed in the outfit, the outfit icons, and each kid's progress from the WARDROBE checklist; tap for WARDROBE). The top strip shows the quote of the day (tap for QUOTE), a red **weather alert** when there is one, or a **note from a grown-up** (Grown-ups tab). **From 6 PM all three columns switch to tomorrow together** under a "Getting ready for tomorrow" ribbon, so the screen never mixes days |
| **CALENDAR** | School month grid (red = no school, yellow = early release, green = first/last day, grey = weekend), swipe or ‹ › to change month, **Today** to jump back. **Tap any day** (or an Up Next row) for a popup with that day's school status, events (with break dates), and, within the week's forecast, the weather and what to wear. Plus "Up Next at School" with **"Tomorrow!" / "N sleeps" countdowns** (breaks under way stay listed until they end) and a **next-break countdown** |
| **QUOTE**  | Message of the day: one encouraging, correctly attributed quote, rotates at midnight |
| **WARDROBE** | Outfit planner for **today and the next 6 days** (‹ › arrows; opens on today, or tomorrow after 6 PM): the day's weather + a tap-to-check checklist **per kid**, saved per date. The kid's buddy **gets dressed as each item is ticked off** |
| **FUN**    | Five corners, each with a daily pick and an "another!" button: 🦖 **Dino** (how to say it, diet, size, era, fact) · 😂 **Joke** told by a kid's buddy, tap "Tell me!" for the punchline · 🔤 **Word of the day** (picture, pronunciation, meaning, sentence) · ➕ **Math** (Easy / Tricky, tap an answer to check it) · 💡 **Facts** |

The **full weather report** (on TODAY) is a slide-down card. A kid's animal
buddy (the kids take turns) "reports" the day, dressed for it, with a speech
bubble in kid language ("Chilly morning, warm afternoon. Rain likely after
lunch. Grab your umbrella!"). Below that, the hours appear as a **temperature
hill**: coloured dots from blue (cold) to red (hot), night hours shaded, and the
rain chance under each hour. Today shows the coming hours, Tomorrow 6 AM to 10 PM.
Fun tiles show a rain meter, wind in words (Calm / Breezy / Windy), the sun's arc
with sunrise, sunset and daylight, sun safety from the UV index, **air quality**
(US AQI) and **the moon** that night. Open it by
swiping down on the hero or tapping the hero or tomorrow card. Switch days with
the pills or a sideways swipe; close by swiping up, tapping ✕, or tapping
outside the card.
(URL shortcut for debugging: `http://<pi>:3000/?wx`, `?wx&d=1` for tomorrow.)

### Kiosk behaviour

- **Always fresh, never reloaded:** weather refreshes every
  `weather.refreshMinutes`; the date, quote, fact, dino, school banner and
  calendar roll over at midnight; config and the school calendar are re-read
  every hour.
- **Weather outages:** if Open-Meteo is unreachable the last good forecast is
  shown ("updated 7:40 AM") and the kiosk keeps retrying every minute.
- **Idle return:** after `kiosk.idleReturnSeconds` without a touch, the screen
  closes the weather report and goes back to TODAY.
- **Screen control:** **pull down from the top of the screen** (start on
  the greeting/clock bar) to open the quick menu with the
  **brightness slider**
  (10–100%, changes the real backlight live, remembered across restarts).
  With nobody touching it, the screen **dims to 10% after 10 minutes** and
  **turns off after an hour**; any touch wakes it straight back to the chosen
  brightness. That waking touch only wakes the screen and doesn't press
  anything underneath. "Screen Off" in the quick menu switches it
  off right away. Swipe the menu back up (or tap outside it) to close it.
- **Grown-ups (admin) tab:** "Grown-ups" in the quick menu opens the parent
  settings, locked with a 4-digit PIN (see below).
- **Bedtime:** with quiet hours on (admin tab), the screen stays dim at night,
  goes off a minute after the last touch, and wakes up by itself in the morning.
- **Notes from grown-ups** show in the TODAY banner (after weather alerts).
- **Updates reload themselves:** after a new build the kiosk page reloads on
  its own once the screen hasn't been touched for 20 seconds.
- **Weather alerts:** active National Weather Service alerts (winter storm, heat,
  thunderstorm...) take turns with the school status in the TODAY banner (red /
  orange / yellow by severity) with kid advice ("Bundle up! School might be
  closed, ask a grown-up."), and appear at the top of the weather report.
- **Holiday themes:** decorations in the header through each season (Halloween
  🎃 all October, Thanksgiving 🦃, winter ❄️, Valentine's, St. Patrick's, 4th of
  July), a greeting on the day itself ("Happy Halloween, …!") and seasonal hats
  on the buddies (witch hats, pom-pom beanies, New Year party hats).
- **The real moon:** at night the header shows tonight's moon phase.
- **Works offline:** fonts and every icon are served locally.
- **Sky that follows the day:** the background is peach at sunrise, cyan by
  day, orange-pink at sunset and a starry navy at night (from the real
  sunrise/sunset times).
- **Tabs by colour:** the active tab is full colour; the others are a pale
  version of their own colour, so kids can find them by colour.

## Configuration: `config/dashboard.json`

Everything specific to your family lives in one git-ignored file, created from
`config/dashboard.example.json` (override its path with `DASHBOARD_CONFIG`). Invalid or missing values fall back to safe defaults, so
a typo never takes the kiosk down. The kiosk picks up edits within the hour;
`sudo systemctl restart kids-smart-kiosk` applies them immediately.

| Key | Meaning |
|-----|---------|
| `kids[]` | `{ "name", "avatar", "color" }` per kid. `avatar` is an animal buddy: `bear`, `monkey`, `fox`, `bunny`, `panda`, `cat` or `dino`. It's drawn wearing the day's outfit (coat/hoodie/stripy shirt/tee, jeans/shorts, sneakers/rain boots, scarf, mittens, umbrella) in the kid's `color` (hex, e.g. `"#3b82f6"`). A Twemoji code such as `1f467-1f3fd` also works for a plain face (then run `npm run emoji`). Names drive the greeting, wardrobe tabs and page title. |
| `location` | `name`, `latitude`, `longitude` for the weather. Two decimals (~1 km) is plenty; there's no need for your exact address. |
| `school.icsUrl` | District "key dates" iCal feed (see below) |
| `school.refreshHours` | How often to re-download the feed (default 12) |
| `school.startHour` / `endHour` | School-day window (24h). The outfit uses the feels-like temperature and rain chance **inside** this window: the middle of that range picks the clothes, and a cool morning on a warm day adds a Light Jacket. |
| `weather.refreshMinutes` | Kiosk weather refresh (default 10) |
| `wardrobe` | `coldBelowF` (45), `coolUpToF` (60), `mildUpToF` (72), `rainChancePct` (40), `switchToTomorrowHour` (18 = from 6 PM on, show tomorrow's outfit) |
| `kiosk.idleReturnSeconds` | Return to TODAY after this idle time; `0` = never |
| `screen.brightness` | Starting brightness % (the slider's value is saved in `data/screen.json` and wins after that) |
| `screen.minBrightness` | Lowest slider value, so the screen can't be "lost" (default 10) |
| `screen.dimAfterMinutes` / `dimBrightness` | Dim after this idle time (default 10) to this % (default 10; never brighter than the chosen brightness). `0` = never dim |
| `screen.offAfterMinutes` | Backlight off after this idle time (default 60); `0` = never |
| `bedtime.enabled` / `start` / `end` | Quiet hours, "HH:MM" 24h (default off, 20:30–06:30): dim, off a minute after the last touch, back on at `end` |
| `location.zip` | Set by the admin tab's Weather Place (informational) |

Environment variables: only `PORT` (default 3000), `NWS_ALERTS_URL` (to test
with a fake alerts file), `DASHBOARD_CONFIG`,
`DASHBOARD_DATA` (runtime state: downloaded school calendar and saved brightness,
default `data/`) and `BACKLIGHT_DIR` (default `/sys/class/backlight`).

### Screen brightness hardware

The server drives the panel backlight through
`/sys/class/backlight/<device>/brightness` (the official 7" panel appears as
`11-0045`; `0` = off). That file is writable by the `video` group, so the
service user must be in it (`pi` is by default; check with `id`). On a
machine without a backlight, such as a desktop dev browser, the page
simulates dimming with a dark overlay instead. `GET/POST /api/screen`
(`{ "mode": "on" | "dim" | "off", "brightness": 1-100 }`) is the
underlying API.

### School calendar

The calendar comes from the school district's iCal "key dates" feed. The
example config uses Fairfax County Public Schools' official feed on Tandem:

```
https://app.tandem.co/US/VA/Fairfax-County-Public-Schools/?type=export&action=ical&export_type=key_dates&year=2026&page=2
```

(The `…&year=2026` link *without* `&page=2` is the "Subscribe" web page, not
the feed itself.) The server downloads it every `school.refreshHours`, saves the
last good copy to `data/school-calendar.ics`, and falls back to that copy, then
to the bundled snapshot `src/lib/data/school-calendar.seed.ics`, when offline.
Feed entries are mapped to kid-friendly events in
`src/lib/utils/schoolCalendar.ts` (`fromIcs`): holidays, breaks, teacher
workdays and staff-development days are **No School**, "…Early Release" is
**Early Release**, and so on.

**Another district?** Point `school.icsUrl` at its iCal feed (look for
"Subscribe" / "Add to calendar" / "iCal export" on the district calendar). The
mapping in `fromIcs` is keyword-based (holiday, break, workday, early release,
first/last day of school), so it works for most feeds; add a test to
`tests/schoolCalendar.test.ts` for any wording it gets wrong.

**Each new school year:** if Tandem publishes a new feed URL (e.g. `year=2027`),
update `school.icsUrl`. To refresh the offline snapshot, download the feed over
`src/lib/data/school-calendar.seed.ics` and rebuild. The TODAY banner says
"Summer Break!" between the last day of school and the next first day it knows about.

## Grown-ups (admin) tab

Pull down from the top of the screen → **Grown-ups**. The first time, it asks
you to make up a 4-digit PIN (stored hashed in `data/admin.json`; forgot it?
delete that file and make a new one). Five wrong tries lock it for 5 minutes.
It also works from a phone on the same Wi-Fi: `http://<pi-address>:3000/admin`
(add `?section=wifi` etc. to jump straight to a section). Leaving the page, or
the idle timer, locks it again. Text is typed on a big on-screen keyboard.

![Grown-ups: What to Wear settings](docs/screenshots/admin-wear.png)

| Tile | What it does |
| --- | --- |
| **Notes** | A note in the TODAY banner ("Library day! Bring your books"): pick a ready-made one or type your own, for today, tomorrow (from 6 PM tonight) or every day. Kept in `data/messages.json`; the kiosk checks every minute. |
| **Kids** | Names, animal buddy and clothes colour; add or remove kids (1–4). |
| **Weather Place** | Type a ZIP code → it finds the town (Open-Meteo geocoding, Zippopotam.us as a fallback) → "Use this place". Offers to switch the clock if the town is in another time zone. |
| **School** | The school calendar link (.ics / webcal; it is downloaded and checked before it's saved) and the school-day hours. |
| **What to Wear** | Coat / jacket / long-sleeve temperatures, the umbrella rain chance, and when TODAY switches to tomorrow's outfit. Saves as you tap. |
| **Bedtime** | Quiet hours: the screen goes dim, turns off a minute after the last touch, and turns itself back on at wake-up time. |
| **Screen** | Dim after / turn off after / go back to TODAY after. |
| **Date & Time** | US time zone, automatic internet time on/off, or set the date and time by hand. A new time zone restarts the kiosk browser. |
| **Wi-Fi** | Nearby networks with signal bars; tap one and type its password to join. |
| **Power** | Wi-Fi name, address, uptime, CPU temperature, free space; **Reload**, **Restart Pi**, **Power Off**. |
| **Updates** | Shows the installed version and new commits on GitHub; **Update now** runs `scripts/update.sh`. |
| **PIN** | Change the PIN. |

Everything except Notes and the PIN is saved in `config/dashboard.json`.

**One-time permission.** Restart / power off, the clock and Wi-Fi go through
systemd and NetworkManager, which need permission for the dashboard's user (a
polkit rule; until it is installed those buttons are greyed out with a note):

```sh
sudo cp system/polkit/50-kids-smart-dashboard.rules /etc/polkit-1/rules.d/
```

The rule lets user `pi` reboot, power off, set the time / time zone /
automatic time and join Wi-Fi networks without a password (edit the user name
inside if yours differs). `ADMIN_DRY_RUN=1` makes the server log those commands
instead of running them (handy for testing).

**Updates** (`scripts/update.sh`, also fine to run by hand): `git pull
--ff-only`, `npm ci` if `package-lock.json` changed, build into `build-next/`
while the old copy keeps running, swap it in (the previous one stays in
`build-old/`), then restart the server. The kiosk page checks for a new build
every minute and reloads itself once nobody is touching the screen. A checkout
with local edits is never updated from the tab (update it by hand).

## Content

| File | What |
|------|------|
| `src/lib/data/quotes.json` | `{ text, author, emoji }`: real, sourced quotes only |
| `src/lib/data/facts.json` | `{ text, emoji: [1-2 codes] }`: fact-checked, kid-friendly |
| `src/lib/data/dinos.json` | `{ name, say, means, lengthFt, diet, period, fact }` |

Each rotates once a day (`pickDaily`: days since 1970 % length, so the order
continues across New Year). Add entries freely; if you use a new emoji code,
run `npm run emoji` (see below).

## Icons

Every icon is an `<img>` from `static/emoji/<code>.svg` (`Emoji.svelte`),
never a text emoji, and nothing is loaded from the internet. Weather
sun/cloud icons are custom comic stickers (`sun.svg`, `cloud.svg`, …); the rest
are vendored [Twemoji 14](https://github.com/twitter/twemoji) SVGs
(© Twitter, Inc and other contributors, CC-BY 4.0).

`npm run emoji` scans `src/` and `config/` for emoji codes and downloads any
missing SVG; `tests/emoji.test.ts` fails if one is missing.

## Tech stack

- **SvelteKit 3** (Svelte 5 runes, TypeScript) + **Vite** + `@sveltejs/adapter-node`
- **Pure hand-written CSS** (no Tailwind): the "sticker" theme with hard
  drop-shadows, thick dark borders and the bundled Nunito font
- **Weather:** Open-Meteo (imperial units, 7-day forecast, `/api/weather`, 5-minute server cache),
  Open-Meteo air quality (US AQI; their pollen data only covers Europe), and
  National Weather Service alerts from `api.weather.gov` (US only, free, no key)
- **Moon phase:** calculated on the Pi (no network)
- **School calendar:** district iCal feed, parsed by a small built-in reader

## Layout

```
#pi-screen  — fixed 800×480 frame, edge to edge (sky background)
├── Header      greeting + date (left), live clock pill (right)
├── main        the active page
└── nav.tabs    five flush "file-folder" tabs; active tab is coloured,
                the rest are dimmed grey and sit slightly lower
```

## Running on the Pi

Two systemd **system** services (in `systemd/`):

- `kids-smart-server.service`: `node build/index.js` on port **3000**
  (the units assume user `pi`, the app in `/home/pi/kids-smart-dashboard` and
  Node at `~/.local/share/pi-node/current/bin/node`; adjust `User=`,
  `WorkingDirectory=` and `ExecStart=` if yours differ)
- `kids-smart-kiosk.service`: `seatd`-aware `cage` compositor running
  Chromium in `--kiosk --ozone-platform=wayland` mode pointed at
  `http://localhost:3000`

Deploy steps (as root / with sudo):

```sh
cd /home/pi/kids-smart-dashboard
npm ci
cp -n config/dashboard.example.json config/dashboard.json   # first time only; then edit it
npm run build
sudo apt install cage seatd chromium        # if not already installed
sudo systemctl enable --now seatd
npm run cursor                              # hide the mouse arrow on the touch screen (see below)
sudo cp systemd/*.service /etc/systemd/system/
sudo cp system/polkit/50-kids-smart-dashboard.rules /etc/polkit-1/rules.d/   # admin tab: power + clock
sudo systemctl daemon-reload
sudo systemctl enable --now kids-smart-server kids-smart-kiosk
```

After a code change: `npm run build && sudo systemctl restart kids-smart-server kids-smart-kiosk`
(or let `scripts/update.sh` do it without the 500s: it builds beside the running copy).
**Always restart after a build:** the running server keeps old code in memory
and serves 500 errors once `build/` is replaced underneath it.

`seatd` must be running for cage to grab the panel (cage's built-in seatd
can't open `/dev/tty0|1` on this Pi). The kiosk unit sets
`SEATD_SOCKET=unix:path=/run/seatd.sock`, `XDG_RUNTIME_DIR=/run/user/1000`,
and launches `cage -s` (the `-s` flag keeps a VT escape hatch).

**No mouse arrow:** with a touch-only panel, an arrow sits in the middle of
the screen (Chromium draws it once and never updates it, since no mouse ever
moves). `npm run cursor` installs blank copies of the `default` and `Adwaita`
cursor themes in `~/.local/share/icons` for the kiosk user, which hides it
(no root needed; restart the kiosk afterwards). `node scripts/blank-cursor.mjs
--remove` brings the arrow back. In the page, the cursor stays hidden until
a real mouse is moved around, so a plugged-in mouse still works for debugging.

`start-dashboard.sh` starts the same server + kiosk by hand (same flags as the
units) for when the services are not installed.

Useful operations:

```sh
sudo systemctl status kids-smart-server kids-smart-kiosk
sudo journalctl -u kids-smart-server -f     # [weather] / [school] / [config] warnings show up here
sudo systemctl restart kids-smart-server kids-smart-kiosk
```

## Development

```sh
npm install
npm run dev       # dev server on http://localhost:5173
npm run check     # svelte-check (should report 0 errors, 0 warnings)
npm run test      # vitest: calendar/feed, wardrobe, weather codes, config, screen, time, dinos, icons
npm run build     # production build → build/index.js
npm run emoji     # vendor any newly referenced Twemoji SVGs
npm run cursor    # (on the Pi) hide the kiosk's mouse arrow
```

Headless screenshots for layout checks (the panel framebuffer is owned by
cage/DRM, so check against a second server instead). Use
`BACKLIGHT_DIR` pointing at a scratch folder (with `panel/brightness` and
`panel/max_brightness` files) so a test server doesn't change the real screen:

```sh
BACKLIGHT_DIR=/tmp/fakebl PORT=3001 nohup ~/.local/share/pi-node/current/bin/node build/index.js &
chromium --headless=new --no-sandbox --disable-gpu \
  --window-size=800,480 --force-device-scale-factor=1 --hide-scrollbars \
  --virtual-time-budget=8000 --screenshot=/tmp/today.png http://localhost:3001/
```

## Source map

```
config/
├── dashboard.example.json   template settings (committed)
└── dashboard.json           your settings (git-ignored)
docs/screenshots/            README screenshots (taken with the example config)
src/
├── app.css                  the whole sticker theme (frame, header, cards, tabs)
├── lib/
│   ├── config.ts            config shape, defaults, validation
│   ├── clock.ts             shared ticking clock + todayKey (midnight rollover)
│   ├── weather.ts           shared self-refreshing weather store
│   ├── report.ts            open/close state of the full weather report
│   ├── screen.ts            idle dim/off rules + brightness panel state
│   ├── sky.ts               time-of-day background phase
│   ├── themes.ts            holiday themes (decorations, greetings, buddy hats)
│   ├── buddies.ts           animal buddy list + default clothes colours
│   ├── components/          Emoji, Buddy (dressed animal SVG), KidAvatar, Header, BottomNav,
│   │                        SectionTitle, WeatherReport, ScreenControl, Keypad
│   │   └── admin/           one *Section per admin tile, TextSheet (on-screen keyboard), Stepper
│   ├── admin.svelte.ts      the admin page's session (API calls, notes, lock)
│   ├── messages.ts          grown-up notes store (polled every minute)
│   ├── data/                quotes, facts, dinos, jokes, words, school-calendar.seed.ics
│   ├── server/              config loader/writer, TTL cache, school feed, backlight control,
│   │                        admin PIN + sessions, ZIP geocoding, notes,
│   │                        system (power/clock/Wi-Fi/health/updates)
│   └── utils/               ics, schoolCalendar, wardrobe, weatherCodes, time, dino,
│                            forecastStory (story/air/alerts), moon, mathPuzzle, admin, messages
└── routes/
    ├── +layout.server.ts    config + school events for every page
    ├── +layout.svelte       frame, header, nav, polling, idle return, screen dim/off/wake
    ├── +page.svelte         TODAY
    ├── calendar/ quote/ wardrobe/ fun/
    ├── admin/               Grown-ups tab (PIN gate + tiles)
    ├── api/weather/         Open-Meteo proxy (typed, cached, stale fallback)
    ├── api/screen/          backlight on/dim/off + brightness
    ├── api/messages/        grown-up notes for the TODAY banner
    └── api/admin/           admin: login, settings, zip, time, power, pin, messages, wifi, update
scripts/                     emoji vendoring, blank kiosk cursor, update.sh
tests/                       vitest suites
systemd/                     kids-smart-server.service, kids-smart-kiosk.service
system/polkit/               rule letting the dashboard restart/power off, set the clock, join Wi-Fi
sample-pages/                the original HTML mockups (design reference)
```

## License

[Apache License 2.0](LICENSE). Twemoji graphics in `static/emoji` are
© Twitter, Inc and other contributors, licensed CC-BY 4.0.
