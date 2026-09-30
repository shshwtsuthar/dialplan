import { describe, expect, it } from 'vitest';
import { stagePhase, type StageMarks } from './replay';

const none: StageMarks = { landed: false, finished: false, skipped: false };

describe('stagePhase', () => {
  it('is idle before the first call', () => {
    expect(stagePhase(undefined, none)).toBe('idle');
  });

  it('flies to the business, checks the rules there, then settles', () => {
    expect(stagePhase('full', none)).toBe('flying');
    expect(stagePhase('full', { ...none, landed: true })).toBe('checking');
    expect(stagePhase('full', { ...none, landed: true, finished: true })).toBe('done');
  });

  it('only checks the rules when the call is re-routed', () => {
    expect(stagePhase('checks', none)).toBe('checking');
    expect(stagePhase('checks', { ...none, finished: true })).toBe('done');
  });

  it('settles at once when skipped', () => {
    expect(stagePhase('full', { ...none, skipped: true })).toBe('done');
  });
});
