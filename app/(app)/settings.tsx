import { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  HelperText,
  SegmentedButtons,
  IconButton,
  Surface,
  Chip,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { NUSACH_OPTIONS } from '@/lib/nusach';
import { colors } from '@/lib/theme';

type UserRole = 'gabbai' | 'baal_kriya';

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

export default function SettingsScreen() {
  const { profile, updateProfile } = useAuth();
  const router = useRouter();

  const [synagogueName, setSynagogueName] = useState(profile?.synagogue_name ?? '');
  const [role, setRole] = useState<UserRole>(profile?.role ?? 'baal_kriya');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationName, setLocationName] = useState(profile?.address ?? '');
  const [latitude, setLatitude] = useState<number | null>(profile?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(profile?.longitude ?? null);
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedNusach, setSelectedNusach] = useState<string[]>(profile?.nusach ?? []);
  const [error, setError] = useState('');

  const isGabbai = role === 'gabbai';

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
        setLocationQuery(data[0].display_name);
        setLatitude(parseFloat(data[0].lat));
        setLongitude(parseFloat(data[0].lon));
      }
    } catch {
      setError('שגיאה בחיפוש מיקום');
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (isGabbai && !synagogueName.trim()) {
      setError('שם בית כנסת הוא שדה חובה לגבאי');
      return;
    }
    if (isGabbai && (latitude === null || longitude === null)) {
      setError('חפש ובחר מיקום');
      return;
    }
    if (isGabbai) {
      const cleaned = phone.replace(/[\s\-()]/g, '');
      if (!/^(05\d{8}|\+9725\d{8})$/.test(cleaned)) {
        setError('הכנס מספר טלפון ישראלי תקין');
        return;
      }
    }
    if (!isGabbai && selectedNusach.length === 0) {
      setError('בחר לפחות נוסח אחד');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        role,
      };

      if (isGabbai) {
        data.synagogue_name = synagogueName.trim();
        data.address = locationName;
        data.latitude = latitude;
        data.longitude = longitude;
        data.phone = phone.replace(/[\s\-()]/g, '');
      } else {
        data.nusach = selectedNusach;
      }

      await updateProfile(data);

      const roleChanged = profile?.role !== role;
      if (roleChanged) {
        router.replace('/(app)');
      } else {
        router.back();
      }
    } catch (e: any) {
      setError(e.message || 'שגיאה בשמירת השינויים');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          הגדרות
        </Text>
        <IconButton icon="arrow-right" onPress={() => router.back()} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="titleMedium" style={styles.label}>
          תפקיד
        </Text>
        <SegmentedButtons
          value={role}
          onValueChange={(val) => setRole(val as UserRole)}
          buttons={[
            { value: 'gabbai', label: 'גבאי' },
            { value: 'baal_kriya', label: 'בעל קריאה' },
          ]}
          style={styles.segmented}
        />

        {isGabbai && (
          <>
            <Text variant="titleMedium" style={styles.label}>
              שם בית כנסת
            </Text>
            <TextInput
              value={synagogueName}
              onChangeText={setSynagogueName}
              mode="outlined"
              style={styles.input}
            />

            <Text variant="titleMedium" style={styles.label}>
              מיקום בית הכנסת
            </Text>

            <TextInput
              label="הכנס כתובת חדשה לחיפוש"
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

            {!!locationName && (
              <Surface style={styles.locationResult} elevation={1}>
                <Text variant="bodyMedium" style={styles.locationText}>
                  {locationName}
                </Text>
              </Surface>
            )}

            <Text variant="titleMedium" style={styles.label}>
              מספר טלפון לוואטסאפ
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
            />
          </>
        )}

        {!isGabbai && (
          <>
            <Text variant="titleMedium" style={styles.label}>
              באיזה נוסח/ים אתה יודע לקרוא? (ניתן לבחור כמה)
            </Text>
            <View style={styles.chipRow}>
              {NUSACH_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  selected={selectedNusach.includes(n)}
                  onPress={() =>
                    setSelectedNusach((prev) =>
                      prev.includes(n)
                        ? prev.filter((x) => x !== n)
                        : [...prev, n],
                    )
                  }
                  showSelectedCheck
                  style={styles.nusachChip}
                >
                  {n}
                </Chip>
              ))}
            </View>
          </>
        )}

        {!!error && (
          <HelperText type="error" visible style={styles.errorHelper}>
            {error}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
          labelStyle={styles.saveLabel}
        >
          שמור שינויים
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.parchmentLight,
    elevation: 2,
  },
  title: {
    fontWeight: 'bold',
    color: colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  label: {
    marginBottom: 8,
    marginTop: 16,
    color: '#1E293B',
  },
  input: {
    marginBottom: 4,
  },
  segmented: {
    marginBottom: 4,
  },
  errorHelper: {},
  saveButton: {
    marginTop: 32,
    backgroundColor: colors.green,
    paddingVertical: 4,
  },
  saveLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchInput: {
    marginBottom: 8,
  },
  searchButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  locationResult: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationText: {},
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  nusachChip: {
    marginBottom: 4,
  },
});
