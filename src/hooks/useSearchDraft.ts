import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

const DEFAULT_DELAY_MS = 300;

/**
 * A local "draft" buffer for a value whose committed home is elsewhere (here: the URL
 * search param). Typing updates the draft immediately -- callers can filter against it
 * with no perceived latency -- while the commit callback only fires, debounced, once
 * typing settles, so we don't spam `history.replaceState` on every keystroke.
 *
 * The tricky part this isolates: `committedValue` can also change for reasons that
 * have nothing to do with what the user just typed (browser back/forward, a "clear
 * filters" button, opening a copied URL). We only want to snap the draft back to that
 * external value when it's genuinely external -- not when it's just the echo of the
 * commit we ourselves fired a moment ago, which would otherwise clobber whatever the
 * user has typed since. `lastCommitted` is what tells the two cases apart.
 *
 * `onCommit` is read via useEffectEvent rather than a plain ref: this hook is used
 * with an inline callback that gets a new identity on every parent render, and we
 * need the *latest* one without re-running (or over-firing) the debounce effect every
 * time that identity changes -- useEffectEvent is the sanctioned way to do that
 * without mutating a ref during render.
 */
export function useSearchDraft(
  committedValue: string,
  onCommit: (value: string) => void,
  delayMs: number = DEFAULT_DELAY_MS,
): [string, (value: string) => void] {
  const [draft, setDraft] = useState(committedValue);
  const debounced = useDebouncedValue(draft, delayMs);
  const lastCommitted = useRef(committedValue);

  const commitIfChanged = useEffectEvent((value: string) => {
    if (value === lastCommitted.current) return;
    lastCommitted.current = value;
    onCommit(value);
  });

  useEffect(() => {
    commitIfChanged(debounced);
    // commitIfChanged is a useEffectEvent -- always latest, deliberately not reactive,
    // so it's intentionally left out of the dependency array (this is the documented
    // usage, not a suppressed lint warning).
  }, [debounced]);

  useEffect(() => {
    if (committedValue === lastCommitted.current) return;
    lastCommitted.current = committedValue;
    setDraft(committedValue);
  }, [committedValue]);

  return [draft, setDraft];
}
