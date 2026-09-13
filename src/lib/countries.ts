// Common countries with flag emojis (ISO-3166 alpha-2 -> flag)
export type Country = { code: string; name: string; flag: string };

const codes: [string, string][] = [
  ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"],
  ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"],
  ["SE", "Sweden"], ["NO", "Norway"], ["FI", "Finland"], ["DK", "Denmark"], ["IE", "Ireland"],
  ["CH", "Switzerland"], ["AT", "Austria"], ["BE", "Belgium"], ["PT", "Portugal"], ["PL", "Poland"],
  ["CZ", "Czechia"], ["GR", "Greece"], ["TR", "Turkey"], ["RU", "Russia"], ["UA", "Ukraine"],
  ["IL", "Israel"], ["AE", "United Arab Emirates"], ["SA", "Saudi Arabia"], ["IN", "India"],
  ["PK", "Pakistan"], ["BD", "Bangladesh"], ["CN", "China"], ["JP", "Japan"], ["KR", "South Korea"],
  ["SG", "Singapore"], ["MY", "Malaysia"], ["TH", "Thailand"], ["VN", "Vietnam"], ["ID", "Indonesia"],
  ["PH", "Philippines"], ["NZ", "New Zealand"], ["ZA", "South Africa"], ["NG", "Nigeria"],
  ["KE", "Kenya"], ["EG", "Egypt"], ["MA", "Morocco"], ["MX", "Mexico"], ["BR", "Brazil"],
  ["AR", "Argentina"], ["CL", "Chile"], ["CO", "Colombia"], ["PE", "Peru"], ["UY", "Uruguay"],
  ["VE", "Venezuela"], ["HK", "Hong Kong"], ["TW", "Taiwan"], ["RO", "Romania"], ["HU", "Hungary"],
  ["BG", "Bulgaria"], ["HR", "Croatia"], ["RS", "Serbia"], ["SK", "Slovakia"], ["SI", "Slovenia"],
  ["EE", "Estonia"], ["LV", "Latvia"], ["LT", "Lithuania"], ["IS", "Iceland"], ["LU", "Luxembourg"],
];

function flagFromCode(code: string) {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

export const COUNTRIES: Country[] = codes
  .map(([code, name]) => ({ code, name, flag: flagFromCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function flagForCountryName(name: string): string {
  const c = COUNTRIES.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return c?.flag ?? "🌍";
}
