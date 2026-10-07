import { Placeholder } from '@/components/Placeholder';

export default function DoneScreen() {
  return (
    <Placeholder
      title="All set"
      purpose="A summary of the reviews scheduled for tomorrow."
      next={{ href: '/(tabs)/learn', label: 'Go to Learn' }}
    />
  );
}
