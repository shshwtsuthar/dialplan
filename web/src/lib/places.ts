// Where a call comes from, as far as its number tells: the country code and,
// in North America, the area code. Only the demo's callers and the business
// itself are listed; any other number has no known place.

export type LonLat = [longitude: number, latitude: number];

export interface Place {
  city: string;
  coordinates: LonLat;
}

export const SAN_DIEGO: Place = { city: 'San Diego', coordinates: [-117.1611, 32.7157] };

const PREFIXES: Record<string, Place> = {
  '+1206': { city: 'Seattle', coordinates: [-122.3321, 47.6062] },
  '+1212': { city: 'New York', coordinates: [-74.006, 40.7128] },
  '+1312': { city: 'Chicago', coordinates: [-87.6298, 41.8781] },
  '+1619': SAN_DIEGO,
  '+1858': SAN_DIEGO,
  '+4420': { city: 'London', coordinates: [-0.1278, 51.5074] },
};

export function placeOf(number: string): Place | undefined {
  return PREFIXES[number.slice(0, 5)];
}
