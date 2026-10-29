import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tells VoiceOver about a message that appears on screen. iOS has no live regions, so `accessibilityLiveRegion`
 * only helps Android. `token` makes the same text announce again when it is a new result (for example a second
 * "Not quite" after a retry).
 */
export function useAnnounce(message: string | null, token?: unknown) {
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message, token]);
}
