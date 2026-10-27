import { useRouter } from 'expo-router';

import { useSpeechMode } from '@/components/practice/useSpeechCapabilities';
import { OnboardingFrame, PrimaryButton, TextButton } from '@/components/ui/ios';
import { useSingleTap } from '@/lib/useSingleTap';
import { createSpeechService } from '@/services/speech/registry';
import { setMicDenied } from '@/state/settingsStore';

export default function MicScreen() {
  const router = useRouter();
  const mode = useSpeechMode();

  const allow = useSingleTap(async () => {
    const permission = await createSpeechService().requestPermission();
    setMicDenied(permission !== 'granted');
    router.push('/(onboarding)/first-session');
  });

  const skip = useSingleTap(() => {
    setMicDenied(true);
    router.push('/(onboarding)/first-session');
  });

  // A build with no speech engine has no microphone to ask for. Say so, and do not record a denial.
  const next = useSingleTap(() => {
    router.push('/(onboarding)/first-session');
  });

  if (mode === 'typed-only') {
    return (
      <OnboardingFrame
        title="Typing only"
        copy="Speaking isn't available in this build, so you will type your answers. Typing still counts toward your unlocks."
        footer={<PrimaryButton label="Continue" onPress={next} />}
      />
    );
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
