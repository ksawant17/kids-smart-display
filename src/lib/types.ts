/** Shared data types for the dashboard (shapes of /api/weather). */

export interface CurrentWeather {
	temp_f: number;
	feels_f: number;
	wind_mph: number;
	weather_code: number;
	humidity: number;
	is_day: number;
}

export interface HourEntry {
	time: string; // ISO with UTC offset
	temp_f: number;
	pop: number; // precipitation probability 0-100
	weather_code: number;
	is_day: number;
}

export interface DaySummary {
	date: string; // YYYY-MM-DD
	code: number;
	temp_max_f: number;
	temp_min_f: number;
	rain_max: number;
	wind_mph: number;
	/** UV index (daily max); null when unavailable */
	uv_max: number | null;
	humidity: number | null;
	sunrise: string | null;
	sunset: string | null;
	/** 6 AM - 10 PM in 2-hour steps */
	hours: HourEntry[];
	/** conditions during school hours (config.school.startHour..endHour) */
	school: { feels_min_f: number; feels_max_f: number; pop_max: number } | null;
}

export interface WeatherData {
	location: string;
	current: CurrentWeather;
	hourly: HourEntry[];
	days: DaySummary[]; // 7 days, [0] = today
	timezone: string;
	fetched_at: string;
	/** true when Open-Meteo was unreachable and this is the last good forecast */
	stale: boolean;
}
