import { useEffect, useRef, useState } from "react";

/**
 * Subscribe to a registry's change notifications. `getSnapshot` may change every render;
 * the latest snapshot is always used when syncing.
 */
export function useRegistrySubscription<T>(
  subscribe: (listener: () => void) => () => void,
  getSnapshot: () => T,
): T {
  const [state, setState] = useState<T>(() => getSnapshot());
  const getRef = useRef(getSnapshot);
  getRef.current = getSnapshot;

  useEffect(() => {
    const sync = () => setState(getRef.current());
    sync();
    return subscribe(sync);
  }, [subscribe]);

  return state;
}
