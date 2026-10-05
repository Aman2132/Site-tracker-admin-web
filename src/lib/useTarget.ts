import { useCallback, useState } from "react";

/**
 * State for a sheet/dialog that acts on one item. Keeps the last id while
 * closing so the exit animation still has content, and bumps `key` on each
 * show so the panel starts from fresh state.
 */
export function useTarget() {
  const [state, setState] = useState<{ id: string | null; open: boolean; key: number }>({ id: null, open: false, key: 0 });
  const show = useCallback((id: string) => setState(s => ({ id, open: true, key: s.key + 1 })), []);
  const setOpen = useCallback((open: boolean) => setState(s => ({ ...s, open })), []);
  return { ...state, show, setOpen };
}
