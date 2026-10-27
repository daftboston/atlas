import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Text } from '@/components/Themed';
import { OnboardingFrame, PrimaryButton } from '@/components/ui/ios';
import { useSingleTap } from '@/lib/useSingleTap';
import { startOnboardingSession } from '@/state/sessionStore';

export default function FirstSessionScreen() {
  const router = useRouter();
  const [empty, setEmpty] = useState(false);

  const start = useSingleTap(() => {
    const result = startOnboardingSession();
    if (result.kind === 'caught-up') {
      setEmpty(true);
      return;
    }
    router.push({ pathname: '/practice/[sessionId]', params: { sessionId: result.id } });
  });

  return (
    <OnboardingFrame
      title="First session"
      copy="Three new phrases. Listen, then say each one back. Typing works too."
      footer={<PrimaryButton label="Start first session" onPress={start} />}>
      {empty ? <Text style={{ fontSize: 17, lineHeight: 22 }}>Nothing new is waiting right now.</Text> : null}
    </OnboardingFrame>
  );
}
