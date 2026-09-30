// A placed call replays on the globe in the Result column: it flies to the
// business, then runs down the dialplan's rules there, then the result
// settles in. A re-routed call is already at the business, so it only
// checks the rules again.

export type Replay = 'full' | 'checks';
export type StagePhase = 'idle' | 'flying' | 'checking' | 'done';

export interface StageMarks {
  /** The globe has landed on the business. */
  landed: boolean;
  /** The call has run down the rules to its destination. */
  finished: boolean;
  skipped: boolean;
}

export function stagePhase(replay: Replay | undefined, marks: StageMarks): StagePhase {
  if (!replay) return 'idle';
  if (marks.skipped || marks.finished) return 'done';
  return replay === 'checks' || marks.landed ? 'checking' : 'flying';
}
