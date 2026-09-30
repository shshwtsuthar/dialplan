import { describe, expect, it } from 'vitest';
import { placeOf } from './places';

describe('placeOf', () => {
  it('places North American numbers by area code', () => {
    expect(placeOf('+12125550123')?.city).toBe('New York');
    expect(placeOf('+12065550188')?.city).toBe('Seattle');
    expect(placeOf('+13125550142')?.city).toBe('Chicago');
    expect(placeOf('+16195550100')?.city).toBe('San Diego');
    expect(placeOf('+18585550142')?.city).toBe('San Diego');
  });

  it('places London numbers', () => {
    expect(placeOf('+442079460123')?.city).toBe('London');
  });

  it('knows nothing about withheld or unlisted numbers', () => {
    expect(placeOf('anonymous')).toBeUndefined();
    expect(placeOf('+19075550100')).toBeUndefined();
    expect(placeOf('+33123456789')).toBeUndefined();
  });

  it('gives coordinates as longitude, then latitude', () => {
    const [lon, lat] = placeOf('+16195550100')!.coordinates;
    expect(lon).toBeCloseTo(-117.16, 1);
    expect(lat).toBeCloseTo(32.72, 1);
  });
});
