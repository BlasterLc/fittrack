import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function iniciarSesion() {
    setLoading(true);
    setError(null);
    const { error: errorLogin } = await supabase.auth.signInWithPassword({ email, password });
    if (errorLogin) {
      setError('No pudimos iniciar sesión. Revisa tu correo y contraseña.');
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.titulo}>FitTrack</Text>
        <TextInput
          style={styles.input}
          placeholder="Correo"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.boton} onPress={iniciarSesion} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.botonTexto}>Entrar</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  titulo: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: fontSize.xxl,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  error: { color: colors.accent, fontFamily: fonts.regular, fontSize: fontSize.sm },
  boton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  botonTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.lg },
});
