import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Text, TextInput, Button, HelperText, Surface } from 'react-native-paper';
import { Link } from 'expo-router';
import { useAuth } from '@/context/auth';
import { isValidUsername } from '@/lib/username';
import { colors } from '@/lib/theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!username || !password) {
      setError('מלא את כל השדות');
      return;
    }
    if (!isValidUsername(username)) {
      setError('שם משתמש יכול להכיל עברית, אותיות, מספרים וקו תחתון');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(username.trim(), password);
    } catch (e: any) {
      setError(e.message || 'התחברות נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text variant="displaySmall" style={styles.logoText}>
            ישקורא
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            התחבר לחשבון שלך
          </Text>
        </View>

        <Surface style={styles.formCard} elevation={2}>
          <TextInput
            label="שם משתמש"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />
          <TextInput
            label="סיסמה"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          {!!error && (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
            style={styles.button}
            labelStyle={styles.buttonLabel}
          >
            התחברות
          </Button>
        </Surface>

        <View style={styles.footer}>
          <Link href="/(auth)/sign-up" asChild>
            <Button mode="text" compact textColor={colors.green}>
              הרשמה
            </Button>
          </Link>
          <Text variant="bodyMedium" style={styles.footerText}>
            ?אין לך חשבון
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 90,
    height: 90,
  },
  logoText: {
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 2,
    fontSize: 42,
    marginTop: 15,
  },
  subtitle: {
    marginTop: 5,
    color: colors.textSecondary,
  },
  formCard: {
    borderRadius: 16,
    padding: 24,
    backgroundColor: colors.parchmentLight,
  },
  input: {
    marginBottom: 14,
    backgroundColor: colors.parchmentLight,
  },
  inputOutline: {
    borderRadius: 12,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.green,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: colors.textSecondary,
  },
});
