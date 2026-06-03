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
  SegmentedButtons,
  HelperText,
  Surface,
  Chip,
} from 'react-native-paper';
import { useAuth } from '@/context/auth';
import { NUSACH_OPTIONS } from '@/lib/nusach';
import { colors } from '@/lib/theme';

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

export default function Onboarding() {
  const { createProfile } = useAuth();

  const [role, setRole] = useState<'gabbai' | 'baal_kriya'>('baal_kriya');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [synagogueName, setSynagogueName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedNusach, setSelectedNusach] = useState<string[]>([]);
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
    if (role === 'gabbai') {
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
    }
    if (role === 'baal_kriya' && selectedNusach.length === 0) {
      setError('בחר לפחות נוסח אחד');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await createProfile({
        role,
        ...(role === 'gabbai'
          ? {
              address: locationName,
              latitude: latitude!,
              longitude: longitude!,
              synagogue_name: synagogueName.trim(),
              phone: phone.replace(/[\s\-()]/g, ''),
            }
          : { nusach: selectedNusach }),
      });
    } catch (e: any) {
      setError(e.message || 'שגיאה ביצירת פרופיל');
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
        <Text variant="headlineSmall" style={styles.heading}>
          בחר תפקיד
        </Text>

        <SegmentedButtons
          value={role}
          onValueChange={(value) => setRole(value as 'gabbai' | 'baal_kriya')}
          buttons={[
            { value: 'gabbai', label: 'גבאי' },
            { value: 'baal_kriya', label: 'בעל קריאה' },
          ]}
          style={styles.segmented}
        />

        {role === 'gabbai' && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              מיקום
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
          </>
        )}

        {role === 'gabbai' && (
          <TextInput
            label="שם בית כנסת"
            value={synagogueName}
            onChangeText={setSynagogueName}
            mode="outlined"
            style={styles.input}
          />
        )}

        {role === 'gabbai' && (
          <TextInput
            label="מספר טלפון לוואטסאפ"
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            style={styles.input}
            keyboardType="phone-pad"
          />
        )}

        {role === 'baal_kriya' && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
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
  segmented: {
    marginBottom: 24,
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
