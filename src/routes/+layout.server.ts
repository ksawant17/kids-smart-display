import { getConfig } from '#lib/server/config';
import { getSchoolEvents } from '#lib/server/schoolFeed';
import { getScreen } from '#lib/server/screen';

/** Config + school calendar for every page (re-run at midnight via invalidateAll). */
export async function load() {
	const config = getConfig();
	return {
		kids: config.kids,
		locationName: config.location.name,
		school: { startHour: config.school.startHour, endHour: config.school.endHour },
		wardrobe: config.wardrobe,
		weatherRefreshMinutes: config.weather.refreshMinutes,
		kiosk: config.kiosk,
		screenConfig: config.screen,
		bedtime: config.bedtime,
		screen: getScreen(),
		schoolEvents: await getSchoolEvents()
	};
}
