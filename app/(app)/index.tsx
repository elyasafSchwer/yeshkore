import { Redirect } from 'expo-router';
import { useAuth } from '@/context/auth';

export default function AppIndex() {
  const { profile } = useAuth();

  if (profile?.role === 'gabbai') {
    return <Redirect href="/(app)/gabbai" />;
  }

  return <Redirect href="/(app)/reader" />;
}
