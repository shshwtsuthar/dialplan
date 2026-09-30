// The page is light while the sun is up in San Diego and dark at night.

export const SUNRISE = 6;
export const SUNSET = 18;

export function themeAt(hour: number): 'light' | 'dark' {
  const h = ((hour % 24) + 24) % 24;
  return h >= SUNRISE && h < SUNSET ? 'light' : 'dark';
}
