import { Placeholder } from '@/components/Placeholder';

export default function SessionSummaryScreen() {
  return (
    <Placeholder
      title="Session summary"
      purpose="Your session results, and any unlock you earned."
      next={{ href: '/(tabs)/learn', label: 'Done' }}
    />
  );
}
