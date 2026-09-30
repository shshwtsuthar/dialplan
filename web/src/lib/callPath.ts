import { RULE_ORDER, type RuleId, type TraceStep } from '@dialplan/shared';
import type { StopProgress } from './checks';

// Which rules a call was checked against, from the API's trace: the rules
// run in order, and the first one that matches decides.

export type Outcome = 'matched' | 'no_match' | 'disabled' | 'not_reached';

export interface CallPath {
  outcomes: Record<RuleId, Outcome>;
  /** The rules the call reached, in order, with the engine's reason; the last is the match. */
  checked: { rule: RuleId; outcome: Exclude<Outcome, 'not_reached'>; detail: string }[];
  matched: RuleId | undefined;
}

export function callPath(trace: TraceStep[]): CallPath {
  const outcomes = Object.fromEntries(RULE_ORDER.map((rule) => [rule, 'not_reached'])) as Record<RuleId, Outcome>;
  const details = new Map<RuleId, string>();
  let matched: RuleId | undefined;
  for (const step of trace) {
    if (step.stage === 'clock') continue;
    outcomes[step.stage] = step.result as Outcome;
    details.set(step.stage, step.detail);
    if (step.result === 'matched') matched = step.stage;
  }
  const checked = RULE_ORDER.flatMap((rule) => {
    const outcome = outcomes[rule];
    return outcome === 'not_reached' ? [] : [{ rule, outcome, detail: details.get(rule) ?? '' }];
  });
  return { outcomes, checked, matched };
}

/** What a rule shows while the call is checked: its outcome once reached, `checking` while the call is on its way, nothing before. */
export type RuleState = Outcome | 'checking' | undefined;

/** Each rule's state at a point in the replay, or `all` once it is over. */
export function ruleStates(path: CallPath, progress: StopProgress | 'all' | undefined): Record<RuleId, RuleState> {
  if (progress === 'all') return path.outcomes;
  const states = Object.fromEntries(RULE_ORDER.map((rule) => [rule, undefined])) as Record<RuleId, RuleState>;
  if (!progress) return states;
  // Once the call reaches the match, the rules below it are settled too: never checked.
  if (progress.done >= path.checked.length) return path.outcomes;
  path.checked.slice(0, progress.done).forEach(({ rule, outcome }) => (states[rule] = outcome));
  const next = path.checked[progress.done];
  if (next && progress.moving) states[next.rule] = 'checking';
  return states;
}
