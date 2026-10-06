import { Placeholder } from '@/components/Placeholder';

export default function WelcomeScreen() {
  return (
    <Placeholder
      title="Welcome"
      purpose="Atlas gets you speaking from minute one, in short daily sessions."
      next={{ href: '/(onboarding)/language', label: 'Next' }}
    />
  );
}
