import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import './StockCorrectionForm.css';

export interface StockCorrectionFormProps {
  currentStock: number;
  /** Throws (or rejects) on failure; the form surfaces whatever message it gets. */
  onSave: (newStock: number) => Promise<void>;
}

/**
 * Deliberately pessimistic (see useUpdateStock.ts): the input and button disable for
 * the duration of the save, and the displayed count only changes once the save has
 * actually succeeded. On failure we keep the clerk's typed value on screen rather than
 * silently reverting it -- they already did the physical count, re-typing it because
 * the network hiccuped is exactly the kind of friction this brief asks us to design
 * away. The same Save button doubles as "retry": nothing needs to be re-typed.
 */
export function StockCorrectionForm({ currentStock, onSave }: StockCorrectionFormProps) {
  const [value, setValue] = useState(String(currentStock));
  const [confirmedStock, setConfirmedStock] = useState(currentStock);
  const [isPending, setIsPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const errorId = useId();

  // "Adjusting state when a prop changes", React's own pattern for exactly this case:
  // compared and updated during render (not in an effect), so there's no extra
  // commit+paint for a value that's about to change again anyway. Only resets the
  // draft when the *confirmed* stock actually changes (i.e. after our own successful
  // save patches the cache) -- an unrelated re-render where currentStock is unchanged
  // leaves whatever the clerk is mid-typing alone.
  if (currentStock !== confirmedStock) {
    setConfirmedStock(currentStock);
    setValue(String(currentStock));
  }

  const parsed = Number(value);
  const isValid = value.trim() !== '' && Number.isInteger(parsed) && parsed >= 0;
  // Shown live as the clerk types, not just after a failed submit -- catching "-4" or
  // "3.5" before they even reach for Save. saveError (network/API failures) only ever
  // applies to a value that was valid when it was sent, so the two never compete for
  // the same message slot.
  const validationMessage = isValid ? null : 'Enter a whole number of 0 or more.';
  const displayedError = validationMessage ?? saveError;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Belt-and-braces: the Save button is already disabled while invalid, so this
    // shouldn't be reachable via the UI, but a form can still be submitted directly
    // (e.g. pressing Enter in some browsers) and we'd rather re-assert the same rule
    // than trust that it can't happen.
    if (!isValid) return;
    setIsPending(true);
    setSaveError(null);
    try {
      await onSave(parsed);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Could not save the correction. Please try again.',
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="correction-form" onSubmit={handleSubmit} noValidate>
      <h2>Correct stock count</h2>
      <div className="correction-form__row">
        <TextField
          label="New stock count"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={isPending}
          aria-invalid={!isValid || undefined}
          aria-describedby={displayedError ? errorId : undefined}
        />
        <Button
          type="submit"
          variant="primary"
          isLoading={isPending}
          disabled={!isValid && !isPending}
        >
          Save correction
        </Button>
      </div>
      {displayedError && (
        <p id={errorId} className="correction-form__error" role="alert">
          {displayedError}
        </p>
      )}
      <p className="correction-form__note">
        Corrections save to this device. The demo API doesn&apos;t persist writes, so a colleague
        opening this same link on another device won&apos;t see it -- see the README for why.
      </p>
    </form>
  );
}
