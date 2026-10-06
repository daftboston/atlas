import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// During server rendering (and hydration) `getServerSnapshot` is used, so the
// server value is returned; on the client the client value is returned.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  return isClient ? client : server;
}
