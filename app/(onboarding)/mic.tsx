import { useRouter } from 'expo-router';

import { OnboardingFrame, PrimaryButton, TextButton } from '@/components/ui/ios';
import { createSpeechService } from '@/services/speech/registry';
import { setMicDenied } from '@/state/settingsStore';

export default function MicScreen() {
  const router = useRouter();

  async function allow() {
    const permission = await createSpeechService().requestPermission();
    setMicDenied(permission !== 'granted');
    router.push('/(onboarding)/first-session');
  }

  function skip() {
    setMicDenied(true);
    router.push('/(onboarding)/first-session');
  }

  return (
    <OnboardingFrame
      title="Microphone"
      copy="Atlas listens so it can tell you how close your phrase was. You can type instead, and that still counts."
      footer={
        <>
          <PrimaryButton label="Allow microphone" onPress={() => void allow()} />
          <TextButton label="Continue without the microphone" onPress={skip} />
        </>
      }
    />
  );
}
