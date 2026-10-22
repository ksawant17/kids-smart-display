import { getConfig } from '#lib/server/config';
import { getSchoolEvents } from '#lib/server/schoolFeed';
import { getScreen } from '#lib/server/screen';
import { getKept, refillIfDue } from '#lib/server/content';

/** Config + school calendar for every page (re-run at midnight via invalidateAll). */
export async function load() {
	const config = getConfig();
	// new quote/fact candidates for the Grown-ups tab, once a day, in the background
	refillIfDue();
	return {
		kids: config.kids,
		locationName: config.location.name,
		// the Marathi calendar + festival themes are worked out for here
		place: { latitude: config.location.latitude, longitude: config.location.longitude },
		school: { startHour: config.school.startHour, endHour: config.school.endHour },
		wardrobe: config.wardrobe,
		weatherRefreshMinutes: config.weather.refreshMinutes,
		kiosk: config.kiosk,
		screenConfig: config.screen,
		bedtime: config.bedtime,
		// quotes and facts a grown-up kept (Grown-ups tab -> New Content)
		content: getKept(),
		screen: getScreen(),
		schoolEvents: await getSchoolEvents()
	};
}
