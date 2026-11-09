// "The budget changed" for sync: the API reports it after each successful write, and the coordinator turns it into a
// sync soon afterwards. Kept apart from both so that the router needs to know nothing about sync, and sync nothing
// about the router. With nobody listening (tests, or sync off) it does nothing.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Calls `listener` whenever the budget changed through the app. Returns a function that stops listening. */
export function onBudgetChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The budget was edited, imported or restored. A listener that throws does not stop the others or the caller. */
export function notifyBudgetChanged(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.error('A budget-changed listener failed', error);
    }
  }
}
