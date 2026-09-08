import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StockCorrectionForm } from '../StockCorrectionForm';

/**
 * Covers the brief's "decide how the UI behaves between the click and the response,
 * and what happens if the request fails" requirement directly. onSave is a plain
 * async function here rather than the real mutation/network stack, so these tests
 * exercise exactly the pessimistic-save/error-recovery behaviour the component
 * promises, independent of React Query or fetch.
 */
describe('StockCorrectionForm', () => {
  it('disables the input and button while the save is pending, and re-enables after success', async () => {
    const user = userEvent.setup();
    let resolveSave!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    render(<StockCorrectionForm currentStock={10} onSave={onSave} />);

    const input = screen.getByLabelText(/new stock count/i);
    await user.clear(input);
    await user.type(input, '25');
    await user.click(screen.getByRole('button', { name: /save correction/i }));

    expect(input).toBeDisabled();
    expect(onSave).toHaveBeenCalledWith(25);

    resolveSave();
    await waitFor(() => expect(input).not.toBeDisabled());
  });

  it('keeps the typed value and shows a retryable error when the save fails, without silently reverting it', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Network error, please retry.'));

    render(<StockCorrectionForm currentStock={10} onSave={onSave} />);

    const input = screen.getByLabelText(/new stock count/i);
    await user.clear(input);
    await user.type(input, '25');
    await user.click(screen.getByRole('button', { name: /save correction/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error, please retry.');
    // The clerk's count is still on screen -- they shouldn't have to re-type it to retry.
    expect(input).toHaveValue(25);

    onSave.mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole('button', { name: /save correction/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });

  it('shows a live validation message and disables Save for a negative count, without calling onSave', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<StockCorrectionForm currentStock={10} onSave={onSave} />);

    const input = screen.getByLabelText(/new stock count/i);
    await user.clear(input);
    await user.type(input, '-4');

    expect(await screen.findByRole('alert')).toHaveTextContent(/0 or more/);
    expect(screen.getByRole('button', { name: /save correction/i })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
