import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  TextInput,
  ActivityIndicator,
  Chip,
  Divider,
  IconButton,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { NUSACH_OPTIONS } from '@/lib/nusach';
import { getShabbatThreshold } from '@/lib/shabbat';
import { colors } from '@/lib/theme';

const STORAGE_KEY = 'last_searched_location';

type SlotResult = {
  id: string;
  prayer_start_time: string;
  reading_start_time: string;
  status: string;
  reading_slot_id: string;
  parasha_name: string;
  reading_date: string;
  synagogue_name: string;
  gabbai_phone: string | null;
  nusach: string[] | null;
  distance: number;
  nusachMatch: boolean;
  notes: string | null;
};

type RawMinyanSlot = {
  id: string;
  prayer_start_time: string;
  reading_start_time: string;
  status: string;
  nusach: string[] | null;
  reading_slots: {
    id: string;
    parasha_name: string;
    reading_date: string;
    gabbai_id: string;
    notes: string | null;
    profiles: {
      synagogue_name: string | null;
      phone: string | null;
      latitude: number | null;
      longitude: number | null;
    };
  };
};

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MAX_RADIUS_KM = 5;

function boundingBox(lat: number, lon: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatPhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned.slice(1);
  if (cleaned.startsWith('0')) return '972' + cleaned.slice(1);
  return cleaned;
}

type Section = {
  title: string;
  data: SlotResult[];
};

type LocationSource = 'last_search' | 'manual' | null;

function ExpandableNote({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable onPress={() => setExpanded((v) => !v)}>
      <Text
        variant="bodySmall"
        style={styles.noteText}
        numberOfLines={expanded ? undefined : 2}
      >
        {text}
      </Text>
    </Pressable>
  );
}

export default function ReaderDashboard() {
  const { profile, username, signOut } = useAuth();
  const router = useRouter();

  const [locationQuery, setLocationQuery] = useState('');
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>(null);
  const [searching, setSearching] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [nusachFilter, setNusachFilter] = useState<string[]>([]);
  const [allResults, setAllResults] = useState<SlotResult[]>([]);
  const [error, setError] = useState('');

  const buildSections = useCallback(
    (results: SlotResult[], filter: string[]) => {
      let filtered = results;
      if (filter.length > 0) {
        filtered = results.filter(
          (s) =>
            s.nusach && s.nusach.some((n) => filter.includes(n)),
        );
      }

      const sortFn = (a: SlotResult, b: SlotResult) => {
        if (a.nusachMatch !== b.nusachMatch) return a.nusachMatch ? -1 : 1;
        const dateCmp = a.reading_date.localeCompare(b.reading_date);
        if (dateCmp !== 0) return dateCmp;
        return a.prayer_start_time.localeCompare(b.prayer_start_time);
      };

      const walking = filtered.filter((s) => s.distance <= 2).sort(sortFn);
      const effort = filtered
        .filter((s) => s.distance > 2 && s.distance <= 5)
        .sort(sortFn);

      const newSections: Section[] = [];
      if (walking.length > 0) {
        newSections.push({
          title: 'מרחק הליכה קלה',
          data: walking,
        });
      }
      if (effort.length > 0) {
        newSections.push({
          title: 'הליכה מאומצת',
          data: effort,
        });
      }
      setSections(newSections);
    },
    [],
  );

  const fetchSlots = useCallback(
    async (lat: number, lon: number) => {
      setLoadingSlots(true);
      const box = boundingBox(lat, lon, MAX_RADIUS_KM);
      const { data, error: fetchError } = await supabase
        .from('minyan_slots')
        .select(
          '*, reading_slots!inner(id, parasha_name, reading_date, notes, gabbai_id, profiles!inner(synagogue_name, phone, latitude, longitude))',
        )
        .eq('status', 'open')
        .gte('reading_slots.profiles.latitude', box.minLat)
        .lte('reading_slots.profiles.latitude', box.maxLat)
        .gte('reading_slots.profiles.longitude', box.minLon)
        .lte('reading_slots.profiles.longitude', box.maxLon);

      if (fetchError || !data) {
        setLoadingSlots(false);
        return;
      }

      const userNusach = profile?.nusach ?? [];
      const threshold = getShabbatThreshold();
      const results: SlotResult[] = [];
      for (const row of data as unknown as RawMinyanSlot[]) {
        const rs = row.reading_slots;
        const p = rs.profiles;
        if (rs.reading_date.slice(0, 10) < threshold) continue;

        const dist = haversine(lat, lon, p.latitude!, p.longitude!);
        if (dist > MAX_RADIUS_KM) continue;

        const hasOverlap =
          row.nusach != null &&
          userNusach.length > 0 &&
          row.nusach.some((n) => userNusach.includes(n));

        results.push({
          id: row.id,
          prayer_start_time: row.prayer_start_time,
          reading_start_time: row.reading_start_time,
          status: row.status,
          reading_slot_id: rs.id,
          parasha_name: rs.parasha_name,
          reading_date: rs.reading_date,
          synagogue_name: p.synagogue_name ?? 'בית כנסת',
          gabbai_phone: p.phone,
          nusach: row.nusach,
          distance: dist,
          nusachMatch: hasOverlap,
          notes: rs.notes,
        });
      }

      setAllResults(results);
      buildSections(results, nusachFilter);
      setLoadingSlots(false);
    },
    [profile, nusachFilter, buildSections],
  );

  useEffect(() => {
    const loadInitialLocation = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { lat, lon } = JSON.parse(stored);
          if (typeof lat === 'number' && typeof lon === 'number') {
            setUserLat(lat);
            setUserLon(lon);
            setLocationSource('last_search');
            setInitialLoading(false);
            fetchSlots(lat, lon);
            return;
          }
        }
      } catch {}

      setInitialLoading(false);
    };

    loadInitialLocation();
  }, [fetchSlots]);

  const searchLocation = async () => {
    if (!locationQuery.trim()) {
      setError('הכנס כתובת');
      return;
    }
    setError('');
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery.trim())}&format=json&limit=1`,
        { headers: { 'User-Agent': 'YeshkoreApp/1.0' } },
      );
      const data = await response.json();
      if (data.length === 0) {
        setError('לא נמצאה כתובת. נסה שוב');
        setSearching(false);
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      setUserLat(lat);
      setUserLon(lon);
      setLocationSource('manual');
      setSearching(false);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lon }));

      fetchSlots(lat, lon);
    } catch {
      setError('שגיאה בחיפוש מיקום');
      setSearching(false);
    }
  };

  const messageGabbai = (slot: SlotResult) => {
    if (!slot.gabbai_phone) return;
    const formatted = formatPhoneForWhatsApp(slot.gabbai_phone);
    const message = `שלום, ראיתי באפליקציית ישקורא שאתם מחפשים בעל קריאה ל${slot.parasha_name}. האם רלוונטי?`;
    Linking.openURL(`https://wa.me/${formatted}?text=${encodeURIComponent(message)}`);
  };

  const sourceLabel =
    locationSource === 'last_search'
      ? 'חיפוש אחרון'
      : locationSource === 'manual'
        ? 'חיפוש ידני'
        : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          שלום, {username}
        </Text>
        <View style={styles.headerActions}>
          <IconButton icon="cog" onPress={() => router.push('/(app)/settings')} />
          <Button mode="text" onPress={signOut} compact>
            התנתקות
          </Button>
        </View>
      </View>

      <View style={styles.searchSection}>
        <Text variant="titleMedium" style={styles.searchLabel}>
          איפה תהיה בשבת?
        </Text>
        <View style={styles.searchRow}>
          <TextInput
            value={locationQuery}
            onChangeText={setLocationQuery}
            mode="outlined"
            placeholder="לדוגמה: פתח תקווה, רוטשילד"
            style={styles.searchInput}
          />
          <Button
            mode="contained"
            onPress={searchLocation}
            loading={searching}
            disabled={searching}
            style={styles.searchButton}
            icon="magnify"
          >
            חפש
          </Button>
        </View>
        {sourceLabel && (
          <Text variant="bodySmall" style={styles.sourceText}>
            מציג קריאות סביב: {sourceLabel}
          </Text>
        )}
        {!!error && (
          <Text variant="bodySmall" style={styles.errorText}>
            {error}
          </Text>
        )}
      </View>

      {userLat !== null && (
        <View style={styles.filterSection}>
          <Text variant="labelLarge" style={styles.filterLabel}>
            סנן לפי נוסח:
          </Text>
          <View style={styles.filterChips}>
            {NUSACH_OPTIONS.map((n) => (
              <Chip
                key={n}
                selected={nusachFilter.includes(n)}
                onPress={() => {
                  const next = nusachFilter.includes(n)
                    ? nusachFilter.filter((x) => x !== n)
                    : [...nusachFilter, n];
                  setNusachFilter(next);
                  buildSections(allResults, next);
                }}
                showSelectedCheck
                compact
                style={styles.filterChip}
              >
                {n}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {initialLoading || loadingSlots ? (
        <ActivityIndicator style={styles.loader} />
      ) : userLat !== null && sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            לא נמצאו קריאות פתוחות באזורך
          </Text>
        </View>
      ) : userLat === null ? (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            הכנס עיר או כתובת למעלה כדי למצוא קריאות באזורך
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text variant="titleMedium" style={styles.sectionHeader}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <Card
              style={[
                styles.card,
                item.nusachMatch && styles.cardMatch,
              ]}
            >
              <Card.Content>
                <View style={styles.cardTop}>
                  <Text variant="titleMedium" style={styles.rtl}>
                    {item.synagogue_name}
                  </Text>
                </View>

                {item.nusachMatch && (
                  <Text variant="labelSmall" style={styles.matchBadge}>
                    מתאים לנוסח שלך
                  </Text>
                )}

                <Text variant="bodyMedium" style={styles.parasha}>
                  {item.parasha_name} — {formatDate(item.reading_date)}
                </Text>

                <Text variant="bodySmall" style={styles.times}>
                  תפילה: {formatTime(item.prayer_start_time)} | קריאה:{' '}
                  {formatTime(item.reading_start_time)}
                </Text>

                {item.nusach && item.nusach.length > 0 && (
                  <View style={styles.nusachRow}>
                    {item.nusach.map((n) => (
                      <Chip key={n} compact style={styles.nusachChipSmall}>
                        {n}
                      </Chip>
                    ))}
                  </View>
                )}

                {!!item.notes && <ExpandableNote text={item.notes} />}

                <Button
                  mode="contained"
                  onPress={() => messageGabbai(item)}
                  style={styles.claimButton}
                  icon="whatsapp"
                >
                  שלח הודעה לגבאי
                </Button>
              </Card.Content>
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          SectionSeparatorComponent={() => <Divider style={styles.sectionDivider} />}
        />
      )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    color: colors.text,
  },
  searchSection: {
    padding: 16,
    backgroundColor: colors.parchmentLight,
    borderBottomWidth: 1,
    borderBottomColor: '#C9B99A',
  },
  searchLabel: {
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
  },
  searchButton: {
    marginTop: 6,
  },
  sourceText: {
    color: colors.green,
    marginTop: 8,
  },
  errorText: {
    color: '#C0392B',
    marginTop: 8,
  },
  loader: {
    marginTop: 48,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: colors.text,
  },
  card: {
    marginBottom: 8,
  },
  cardMatch: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  matchBadge: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rtl: {
    color: '#1E293B',
  },
  parasha: {
    color: '#1E293B',
    marginTop: 4,
  },
  times: {
    color: '#666',
    marginTop: 4,
  },
  claimButton: {
    marginTop: 12,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.parchmentLight,
    borderBottomWidth: 1,
    borderBottomColor: '#C9B99A',
  },
  filterLabel: {
    marginBottom: 6,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    marginBottom: 2,
  },
  nusachRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  nusachChipSmall: {
    backgroundColor: '#E8EAF6',
    paddingBottom: 4,
  },
  separator: {
    height: 4,
  },
  sectionDivider: {
    marginVertical: 8,
  },
  noteText: {
    color: '#555',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
