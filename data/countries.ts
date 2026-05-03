import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale as Parameters<typeof countries.registerLocale>[0]);

export interface CountryOption {
  code: string;
  name: string;
}

const raw = countries.getNames('en', { select: 'official' });

export const COUNTRY_OPTIONS: CountryOption[] = Object.entries(raw)
  .map(([code, name]) => ({ code, name: String(name) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
