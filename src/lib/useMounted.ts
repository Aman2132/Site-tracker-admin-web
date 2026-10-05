import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during the server render and hydration, true afterwards. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
