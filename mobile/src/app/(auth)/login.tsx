import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { iniciarSesionConGoogle } from '@/lib/googleAuth';
import { colors, spacing, fonts, fontSize } from '@/theme/tokens';

type Modo = 'ingresar' | 'crear';

export default function Login() {
  const [modo, setModo] = useState<Modo>('ingresar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Con confirmación de correo obligatoria, `signUp` no abre sesión: no hay
  // a dónde navegar, solo un aviso de que hay que revisar el correo.
  const [correoEnviado, setCorreoEnviado] = useState<string | null>(null);

  async function iniciarSesion() {
    setLoading(true);
    setError(null);
    const { error: errorLogin } = await supabase.auth.signInWithPassword({ email, password });
    if (errorLogin) {
      setError('No pudimos iniciar sesión. Revisa tu correo y contraseña.');
    }
    setLoading(false);
  }

  async function crearCuenta() {
    setLoading(true);
    setError(null);
    const { data, error: errorRegistro } = await supabase.auth.signUp({
      email,
      password,
      // Sin esto, el link del correo de confirmación cae en el "Site URL"
      // por defecto del panel de Supabase (http://localhost:3000, un
      // remanente de la creación del proyecto): la cuenta queda confirmada
      // igual, pero el navegador muestra "localhost rechazó la conexión" y
      // parece que falló. Esta ruta la sirve el propio backend.
      options: { emailRedirectTo: `${process.env.EXPO_PUBLIC_API_URL}/confirmado` },
    });
    if (errorRegistro) {
      setError(
        errorRegistro.message.toLowerCase().includes('password')
          ? 'La contraseña debe tener al menos 6 caracteres.'
          : 'No pudimos crear tu cuenta. Revisa el correo e intenta de nuevo.',
      );
    } else if (!data.session) {
      setCorreoEnviado(email);
    }
    setLoading(false);
  }

  async function entrarConGoogle() {
    setLoading(true);
    setError(null);
    const resultado = await iniciarSesionConGoogle();
    // En web la página se recarga al volver de Google y esto no llega a
    // ejecutarse. Cancelar el navegador devuelve `mensaje: null`: sin error.
    if (!resultado.ok) setError(resultado.mensaje);
    setLoading(false);
  }

  function cambiarModo(siguiente: Modo) {
    setModo(siguiente);
    setError(null);
  }

  if (correoEnviado) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.titulo}>FitTrack</Text>
          <Text style={styles.aviso}>
            Te mandamos un correo a {correoEnviado}. Ábrelo para confirmar tu cuenta y después
            inicia sesión aquí.
          </Text>
          <Pressable
            style={styles.boton}
            onPress={() => {
              setCorreoEnviado(null);
              cambiarModo('ingresar');
            }}
          >
            <Text style={styles.botonTexto}>Ir a iniciar sesión</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* El formulario va centrado y sin scroll: en iOS el teclado tapaba la
          contraseña y el botón. `padding` empuja el contenido hacia arriba;
          en Android la ventana ya se redimensiona sola. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          <Pressable
            style={styles.boton}
            onPress={modo === 'ingresar' ? iniciarSesion : crearCuenta}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.botonTexto}>
                {modo === 'ingresar' ? 'Entrar' : 'Crear cuenta'}
              </Text>
            )}
          </Pressable>
          <View style={styles.separador}>
            <View style={styles.separadorLinea} />
            <Text style={styles.separadorTexto}>o</Text>
            <View style={styles.separadorLinea} />
          </View>
          <Pressable
            style={styles.botonGoogle}
            onPress={entrarConGoogle}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.botonGoogleTexto}>Continuar con Google</Text>
          </Pressable>
          <Pressable
            style={styles.alternar}
            onPress={() => cambiarModo(modo === 'ingresar' ? 'crear' : 'ingresar')}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.alternarTexto}>
              {modo === 'ingresar'
                ? '¿No tienes cuenta? Crea una'
                : '¿Ya tienes cuenta? Inicia sesión'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  separador: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  separadorLinea: { flex: 1, height: 1, backgroundColor: colors.line },
  separadorTexto: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  botonGoogle: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonGoogleTexto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSize.base },
  aviso: {
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  alternar: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  alternarTexto: { color: colors.primaryText, fontFamily: fonts.medium, fontSize: fontSize.sm },
});
