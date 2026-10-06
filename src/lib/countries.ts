// Pays d'une chasse : code ISO 3166-1 alpha-2 (ex. « FR »). Les noms sont
// fournis par le navigateur dans la langue active (Intl.DisplayNames) : aucune
// liste de noms à maintenir. Le pays est public, comme le lieu.
import type { Locale } from "./i18n";

/**
 * Codes ISO 3166-1 alpha-2 attribués, plus « XK » (Kosovo, code d'usage
 * courant, connu des navigateurs, sans attribution officielle).
 */
export const COUNTRY_CODES = (
  "XK " +
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ " +
  "BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM " +
  "DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS " +
  "GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN " +
  "KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ " +
  "MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM " +
  "PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV " +
  "SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI " +
  "VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const CODES = new Set(COUNTRY_CODES);

export const isCountryCode = (code: unknown): code is string =>
  typeof code === "string" && CODES.has(code);

const intlLocale = (locale: Locale) => (locale === "fr" ? "fr-FR" : "en-GB");

/** Nom du pays dans la langue demandée (le code si le navigateur ne le connaît pas). */
export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Pays triés par nom dans la langue demandée. */
export function sortedCountries(locale: Locale, codes: readonly string[] = COUNTRY_CODES) {
  const collator = new Intl.Collator(intlLocale(locale));
  return codes
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** Pays suggéré d'après la langue du navigateur (« fr-FR » → « FR »), sinon vide. */
export function guessCountry(): string {
  if (typeof navigator === "undefined") return "";
  const region = (navigator.language as string | undefined)?.split("-")[1]?.toUpperCase();
  return isCountryCode(region) ? region : "";
}
