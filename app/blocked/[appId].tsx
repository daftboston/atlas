import { useLocalSearchParams } from 'expo-router';

import { BlockedAppScreen } from '@/components/blocking/BlockedAppScreen';

export default function BlockedAppRoute() {
  const { appId } = useLocalSearchParams<{ appId: string }>();
  const id = Array.isArray(appId) ? appId[0] : appId;
  return <BlockedAppScreen appId={id ?? ''} />;
}
