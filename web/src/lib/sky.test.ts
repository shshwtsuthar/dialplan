import { describe, expect, it } from 'vitest';
import { mix, skyAt } from './sky';

describe('sky', () => {
  it('is day from 06:00 to 18:00, with the sun crossing once', () => {
    expect(skyAt(5.99).isDay).toBe(false);
    expect(skyAt(6).sun).toBe(0);
    expect(skyAt(12).sun).toBe(0.5);
    expect(skyAt(18).isDay).toBe(false);
    expect(skyAt(18).sun).toBeNull();
  });

  it('shows stars only at night', () => {
    expect(skyAt(0).stars).toBe(1);
    expect(skyAt(12).stars).toBe(0);
    expect(skyAt(22).stars).toBe(1);
    expect(skyAt(5.75).stars).toBeGreaterThan(0);
    expect(skyAt(5.75).stars).toBeLessThan(1);
  });

  it('wraps around midnight', () => {
    expect(skyAt(24)).toEqual(skyAt(0));
    expect(skyAt(-1)).toEqual(skyAt(23));
  });

  it('blends colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#102030', 0.3)).toBe('#102030');
  });
});
