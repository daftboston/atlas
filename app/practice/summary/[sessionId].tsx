import { useLocalSearchParams } from 'expo-router';

import { SessionSummary } from '@/components/practice/SessionSummary';

export default function SessionSummaryRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  return <SessionSummary sessionId={id ?? ''} />;
}
