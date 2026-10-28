import { createContext, useContext } from 'react';
import type { FeatureKey, MySubscription } from '../api/types';

export interface SubscriptionContextValue {
  data: MySubscription | null;
  /** Whether the client's plan includes a feature. */
  can: (feature: FeatureKey) => boolean;
  refresh: () => void;
}

export const SubscriptionContext = createContext<SubscriptionContextValue>({
  data: null,
  can: () => true,
  refresh: () => {},
});

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}

/**
 * Until the rights are loaded nothing optional is shown; accounts outside any
 * organization (no subscription at all) keep every module, like the API.
 */
export function makeCan(data: MySubscription | null, loaded: boolean) {
  return (feature: FeatureKey): boolean => {
    if (!loaded) return false;
    if (!data?.organization) return true;
    return data.features?.[feature] === true;
  };
}
