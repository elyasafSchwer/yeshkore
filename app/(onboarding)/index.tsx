import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  HelperText,
  Surface,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { colors } from '@/lib/theme';

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

export default function Onboarding() {
  const { createProfile, signOut } = useAuth();
  const router = useRouter();

  const [locationQuery, setLocationQuery] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [synagogueName, setSynagogueName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchLocation = async () => {
    if (!locationQuery.trim()) {
      setError('הכנס כתובת לחיפוש');
      return;
    }
    setError('');
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery.trim())}&format=json&limit=1`,
        { headers: { 'User-Agent': 'YeshkoreApp/1.0' } },
      );
      const data: NominatimResult[] = await response.json();
      if (data.length === 0) {
        setError('לא נמצאה כתובת. נסה שוב');
        setLocationName('');
        setLatitude(null);
        setLongitude(null);
      } else {
        setLocationName(data[0].display_name);
        setLatitude(parseFloat(data[0].lat));
        setLongitude(parseFloat(data[0].lon));
      }
    } catch {
      setError('שגיאה בחיפוש מיקום');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (latitude === null || longitude === null) {
      setError('חפש ובחר מיקום');
      return;
    }
    if (!synagogueName.trim()) {
      setError('הכנס שם בית כנסת');
      return;
    }
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!/^(05\d{8}|\+9725\d{8})$/.test(cleaned)) {
      setError('הכנס מספר טלפון ישראלי תקין (לדוגמה: 0501234567)');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await createProfile({
        role: 'gabbai',
        address: locationName,
        latitude: latitude!,
        longitude: longitude!,
        synagogue_name: synagogueName.trim(),
        phone: cleaned,
      });
    } catch (e: any) {
      setError(e.message || 'שגיאה ביצירת פרופיל');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/');
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
        <Text variant="headlineSmall" style={styles.heading}>
          פרטי הגבאי
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          מיקום בית הכנסת
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            label="הכנס עיר ורחוב (לדוגמה: פתח תקווה, רוטשילד)"
            value={locationQuery}
            onChangeText={setLocationQuery}
            mode="outlined"
            style={styles.searchInput}
          />
          <Button
            mode="contained-tonal"
            onPress={searchLocation}
            loading={searching}
            disabled={searching}
            style={styles.searchButton}
            icon="magnify"
          >
            חפש
          </Button>
        </View>

        {!!locationName && (
          <Surface style={styles.locationResult} elevation={1}>
            <Text variant="bodyMedium" style={styles.locationText}>
              {locationName}
            </Text>
          </Surface>
        )}

        <TextInput
          label="שם בית כנסת"
          value={synagogueName}
          onChangeText={setSynagogueName}
          mode="outlined"
          style={styles.input}
        />

        <TextInput
          label="מספר טלפון לוואטסאפ"
          value={phone}
          onChangeText={setPhone}
          mode="outlined"
          style={styles.input}
          keyboardType="phone-pad"
        />

        {!!error && (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
        >
          שמור פרופיל
        </Button>

        <Button
          mode="outlined"
          onPress={handleLogout}
          style={styles.logoutButton}
          textColor={colors.textSecondary}
        >
          התנתק
        </Button>
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
    padding: 24,
  },
  heading: {
    fontWeight: 'bold',
    marginBottom: 16,
    color: colors.text,
  },
  input: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    color: colors.text,
  },
  searchRow: {
    marginBottom: 12,
  },
  searchInput: {
    marginBottom: 8,
  },
  searchButton: {
    alignSelf: 'flex-start',
  },
  locationResult: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationText: {},
  submitButton: {
    marginTop: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.green,
  },
  logoutButton: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
