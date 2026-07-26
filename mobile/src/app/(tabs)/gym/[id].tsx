import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function Ficha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Text style={{ color: colors.ink }}>{id}</Text>
    </SafeAreaView>
  );
}
