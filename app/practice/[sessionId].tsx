import { useLocalSearchParams } from 'expo-router';

import { PracticeSession } from '@/components/practice/PracticeSession';

export default function PracticeSessionRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  return <PracticeSession sessionId={id ?? ''} />;
}
