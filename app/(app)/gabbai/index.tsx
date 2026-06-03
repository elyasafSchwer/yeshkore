import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  FAB,
  TextInput,
  Button,
  HelperText,
  Portal,
  Chip,
  ActivityIndicator,
  IconButton,
  Divider,
  Surface,
  Searchbar,
  List,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { NUSACH_OPTIONS } from '@/lib/nusach';
import { getShabbatThreshold } from '@/lib/shabbat';
import { colors } from '@/lib/theme';

type MinyanSlot = {
  id: string;
  reading_slot_id: string;
  prayer_start_time: string;
  reading_start_time: string;
  status: string;
  nusach: string[] | null;
};

type ReadingSlotWithMinyanim = {
  id: string;
  gabbai_id: string;
  parasha_name: string;
  reading_date: string;
  notes: string | null;
  minyan_slots: MinyanSlot[];
};

type HebcalEvent = {
  title: string;
  hebrew: string;
  date: string;
  category: string;
};

type MinyanDraft = {
  key: string;
  prayerTime: string;
  readingTime: string;
  nusach: string[];
};

const TIME_OPTIONS: string[] = [];
for (let h = 5; h <= 11; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 5 && m < 30) continue;
    if (h === 11 && m > 0) break;
    TIME_OPTIONS.push(
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    );
  }
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

let draftKeyCounter = 0;

// ─── Time Picker Modal ───

function TimePickerModal({
  visible,
  title,
  minTime,
  onDismiss,
  onSelect,
}: {
  visible: boolean;
  title: string;
  minTime?: string;
  onDismiss: () => void;
  onSelect: (time: string) => void;
}) {
  const filtered = minTime
    ? TIME_OPTIONS.filter((t) => t >= minTime)
    : TIME_OPTIONS;

  return (
    <Modal
      visible={visible}
      onRequestClose={onDismiss}
      animationType="slide"
      transparent
    >
      <View style={timePickerStyles.overlay}>
        <View style={timePickerStyles.container}>
          <View style={timePickerStyles.header}>
            <Text variant="titleLarge" style={timePickerStyles.title}>
              {title}
            </Text>
            <IconButton icon="close" onPress={onDismiss} />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            contentContainerStyle={timePickerStyles.list}
            renderItem={({ item }) => (
              <Pressable
                style={timePickerStyles.item}
                onPress={() => {
                  onSelect(item);
                  onDismiss();
                }}
              >
                <Text variant="titleMedium" style={timePickerStyles.itemText}>
                  {item}
                </Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <Divider />}
          />
        </View>
      </View>
    </Modal>
  );
}

const timePickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.parchmentLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  item: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  itemText: {
    fontSize: 18,
  },
});

// ─── Parasha Picker Modal ───

function ParashaPickerModal({
  visible,
  onDismiss,
  onSelect,
}: {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (event: HebcalEvent) => void;
}) {
  const [events, setEvents] = useState<HebcalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setSearch('');
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 60);

    fetch(
      `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&s=on&i=on&start=${toISODate(today)}&end=${toISODate(end)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        const ALLOWED_HOLIDAYS = new Set([
          "Sukkot I",
          "Shmini Atzeret",
          "Pesach I",
          "Pesach VII",
          "Shavuot",
          "Yom Kippur",
          "Purim",
          "Erev Purim",
        ]);

        const filtered = (data.items ?? []).filter((item: HebcalEvent) => {
          if (item.category === "parashat") return true;
          if (item.category !== "holiday") return false;
          if (item.title.includes("Tish")) return true;
          if (item.title.startsWith("Rosh Hashana") && !item.title.startsWith("Erev")) return true;
          return ALLOWED_HOLIDAYS.has(item.title);
        });

        const findCholMoedShabbat = (startDate: string, durationDays: number): string | null => {
          const start = new Date(startDate + "T00:00:00");
          const startDay = start.getDay();
          if (startDay === 6) return null;
          const daysToShabbat = (6 - startDay + 7) % 7;
          if (daysToShabbat >= durationDays) return null;
          const shabbat = new Date(start);
          shabbat.setDate(start.getDate() + daysToShabbat);
          return toISODate(shabbat);
        };

        const result: HebcalEvent[] = [];
        for (const item of filtered) {
          if (item.title === "Pesach I") {
            result.push({ ...item, hebrew: "פסח" });
            const shabbatDate = findCholMoedShabbat(item.date, 7);
            if (shabbatDate) {
              result.push({
                title: "Shabbat Chol HaMoed Pesach",
                hebrew: "שבת חול המועד פסח",
                date: shabbatDate,
                category: "holiday",
              });
            }
            result.push({
              title: "Pesach - Megillat Shir HaShirim",
              hebrew: "פסח - מגילת שיר השירים",
              date: shabbatDate ?? item.date,
              category: "holiday",
            });
          } else if (item.title === "Pesach VII") {
            result.push({ ...item, hebrew: "שביעי של פסח" });
          } else if (item.title === "Sukkot I") {
            result.push({ ...item, hebrew: "סוכות" });
            const shabbatDate = findCholMoedShabbat(item.date, 8);
            if (shabbatDate) {
              result.push({
                title: "Shabbat Chol HaMoed Sukkot",
                hebrew: "שבת חול המועד סוכות",
                date: shabbatDate,
                category: "holiday",
              });
            }
            result.push({
              title: "Sukkot - Megillat Kohelet",
              hebrew: "סוכות - מגילת קהלת",
              date: shabbatDate ?? item.date,
              category: "holiday",
            });
          } else if (item.title.startsWith("Rosh Hashana") && item.title !== "Rosh Hashana II") {
            result.push({ ...item, hebrew: "ראש השנה א׳" });
          } else if (item.title === "Rosh Hashana II") {
            result.push({ ...item, hebrew: "ראש השנה ב׳" });
          } else {
            result.push(item);
          }
          if (item.title === "Shavuot") {
            result.push({
              title: "Shavuot - Megillat Ruth",
              hebrew: "שבועות - מגילת רות",
              date: item.date,
              category: "holiday",
            });
          }
        }

        setEvents(result);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = search
    ? events.filter(
        (e) =>
          e.hebrew.includes(search) ||
          e.title.toLowerCase().includes(search.toLowerCase()),
      )
    : events;

  return (
    <Modal
      visible={visible}
      onRequestClose={onDismiss}
      animationType="slide"
      transparent
    >
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.container}>
          <View style={pickerStyles.header}>
            <Text variant="titleLarge" style={pickerStyles.title}>
              בחר פרשה \ חג
            </Text>
            <IconButton icon="close" onPress={onDismiss} />
          </View>

          <Searchbar
            placeholder="חיפוש..."
            value={search}
            onChangeText={setSearch}
            style={pickerStyles.searchbar}
          />

          {loading ? (
            <ActivityIndicator style={pickerStyles.loader} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => `${item.date}-${item.title}`}
              ItemSeparatorComponent={() => <Divider />}
              renderItem={({ item }) => (
                <List.Item
                  title={item.hebrew}
                  description={`${item.title}  —  ${formatDate(item.date)}`}
                  titleStyle={pickerStyles.itemTitle}
                  onPress={() => {
                    onSelect(item);
                    onDismiss();
                  }}
                  right={() => (
                    <List.Icon icon="chevron-left" />
                  )}
                />
              )}
              ListEmptyComponent={
                <Text style={pickerStyles.emptyText}>אין תוצאות</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.parchmentLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  searchbar: {
    margin: 16,
    marginTop: 8,
  },
  loader: {
    marginTop: 32,
  },
  itemTitle: {},
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 32,
  },
});

// ─── Add Slot Modal ───

function AddSlotModal({
  visible,
  userId,
  onDismiss,
  onCreated,
}: {
  visible: boolean;
  userId: string;
  onDismiss: () => void;
  onCreated: () => void;
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<HebcalEvent | null>(null);
  const [minyanim, setMinyanim] = useState<MinyanDraft[]>([
    { key: String(draftKeyCounter++), prayerTime: '', readingTime: '', nusach: [] },
  ]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [timePickerTarget, setTimePickerTarget] = useState<{
    minyanKey: string;
    field: 'prayerTime' | 'readingTime';
    label: string;
  } | null>(null);

  const resetForm = () => {
    setSelectedEvent(null);
    setMinyanim([
      { key: String(draftKeyCounter++), prayerTime: '', readingTime: '', nusach: [] },
    ]);
    setNotes('');
    setError('');
  };

  const updateMinyan = (
    key: string,
    field: 'prayerTime' | 'readingTime',
    value: string,
  ) => {
    setMinyanim((prev) =>
      prev.map((m) => {
        if (m.key !== key) return m;
        if (field === 'prayerTime' && m.readingTime && value > m.readingTime) {
          return { ...m, prayerTime: value, readingTime: value };
        }
        return { ...m, [field]: value };
      }),
    );
  };

  const addMinyan = () => {
    setMinyanim((prev) => [
      ...prev,
      { key: String(draftKeyCounter++), prayerTime: '', readingTime: '', nusach: [] },
    ]);
  };

  const removeMinyan = (key: string) => {
    setMinyanim((prev) => prev.filter((m) => m.key !== key));
  };

  const handleSubmit = async () => {
    if (!selectedEvent) {
      setError('בחר פרשה \ חג');
      return;
    }
    if (minyanim.length === 0) {
      setError('הוסף לפחות מניין אחד');
      return;
    }
    for (const m of minyanim) {
      if (!m.prayerTime || !m.readingTime) {
        setError('בחר שעות לכל המניינים');
        return;
      }
    }

    setError('');
    setLoading(true);
    try {
      let { data: existing } = await supabase
        .from('reading_slots')
        .select('id')
        .eq('gabbai_id', userId)
        .eq('reading_date', selectedEvent.date)
        .eq('parasha_name', selectedEvent.hebrew)
        .maybeSingle();

      let readingSlotId: string;

      if (existing) {
        readingSlotId = existing.id;
      } else {
        const { data: newSlot, error: slotError } = await supabase
          .from('reading_slots')
          .insert({
            gabbai_id: userId,
            parasha_name: selectedEvent.hebrew,
            reading_date: selectedEvent.date,
            notes: notes.trim() || null,
          })
          .select('id')
          .single();
        if (slotError) throw slotError;
        readingSlotId = newSlot.id;
      }

      const minyanRows = minyanim.map((m) => ({
        reading_slot_id: readingSlotId,
        prayer_start_time: m.prayerTime,
        reading_start_time: m.readingTime,
        nusach: m.nusach.length > 0 ? m.nusach : null,
        status: 'open',
      }));

      const { error: minyanError } = await supabase
        .from('minyan_slots')
        .insert(minyanRows);
      if (minyanError) throw minyanError;

      resetForm();
      onCreated();
    } catch (e: any) {
      setError(e.message || 'שגיאה בהוספת קריאה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onDismiss}
      animationType="slide"
      transparent
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="headlineSmall" style={styles.modalTitle}>
              קריאה חדשה
            </Text>

            <Text variant="titleMedium" style={styles.dropdownLabel}>
              פרשה \ חג
            </Text>

            <Pressable onPress={() => setPickerVisible(true)}>
              <TextInput
                mode="outlined"
                value={
                  selectedEvent
                    ? `${selectedEvent.hebrew}  —  ${formatDate(selectedEvent.date)}`
                    : ''
                }
                placeholder="לחץ לבחירה..."
                editable={false}
                right={<TextInput.Icon icon="chevron-down" />}
                style={styles.modalInput}
                pointerEvents="none"
              />
            </Pressable>

            <Divider style={styles.divider} />

            <View style={styles.minyanHeader}>
              <Text variant="titleMedium" style={styles.dropdownLabel}>
                מניינים
              </Text>
              <Button
                mode="text"
                icon="plus"
                compact
                onPress={addMinyan}
              >
                הוסף מניין
              </Button>
            </View>

            {minyanim.map((m, idx) => (
              <Surface key={m.key} style={styles.minyanDraft} elevation={1}>
                <View style={styles.minyanDraftHeader}>
                  <Text variant="labelLarge" style={styles.rtl}>
                    מניין {idx + 1}
                  </Text>
                  {minyanim.length > 1 && (
                    <IconButton
                      icon="close"
                      size={18}
                      onPress={() => removeMinyan(m.key)}
                    />
                  )}
                </View>

                <Pressable
                  onPress={() =>
                    setTimePickerTarget({
                      minyanKey: m.key,
                      field: 'prayerTime',
                      label: 'שעת תחילת תפילה',
                    })
                  }
                >
                  <TextInput
                    label="שעת תחילת תפילה"
                    value={m.prayerTime}
                    mode="outlined"
                    style={styles.timeInput}
                    editable={false}
                    placeholder="בחר שעה..."
                    right={<TextInput.Icon icon="clock-outline" />}
                    pointerEvents="none"
                  />
                </Pressable>

                <Pressable
                  onPress={() =>
                    setTimePickerTarget({
                      minyanKey: m.key,
                      field: 'readingTime',
                      label: 'שעת תחילת קריאה',
                    })
                  }
                >
                  <TextInput
                    label="שעת תחילת קריאה"
                    value={m.readingTime}
                    mode="outlined"
                    style={styles.timeInput}
                    editable={false}
                    placeholder="בחר שעה..."
                    right={<TextInput.Icon icon="clock-outline" />}
                    pointerEvents="none"
                  />
                </Pressable>

                <Text variant="labelMedium" style={styles.nusachLabel}>
                  נוסח תפילה/קריאה מקובל (ניתן לבחור כמה)
                </Text>
                <View style={styles.nusachChipRow}>
                  {NUSACH_OPTIONS.map((n) => (
                    <Chip
                      key={n}
                      selected={m.nusach.includes(n)}
                      onPress={() =>
                        setMinyanim((prev) =>
                          prev.map((draft) =>
                            draft.key === m.key
                              ? {
                                  ...draft,
                                  nusach: draft.nusach.includes(n)
                                    ? draft.nusach.filter((x) => x !== n)
                                    : [...draft.nusach, n],
                                }
                              : draft,
                          ),
                        )
                      }
                      showSelectedCheck
                      compact
                      style={styles.nusachFormChip}
                    >
                      {n}
                    </Chip>
                  ))}
                </View>
              </Surface>
            ))}

            <TextInput
              label="הערות נוספות"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              style={styles.modalInput}
              multiline
              numberOfLines={3}
            />

            {!!error && (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            )}

            <View style={styles.modalButtons}>
              <Button mode="outlined" onPress={onDismiss} style={styles.modalBtn}>
                ביטול
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.modalBtn}
              >
                שמור
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <ParashaPickerModal
        visible={pickerVisible}
        onDismiss={() => setPickerVisible(false)}
        onSelect={setSelectedEvent}
      />

      <TimePickerModal
        visible={!!timePickerTarget}
        title={timePickerTarget?.label ?? 'בחר שעה'}
        minTime={
          timePickerTarget?.field === 'readingTime'
            ? minyanim.find((m) => m.key === timePickerTarget.minyanKey)?.prayerTime || undefined
            : undefined
        }
        onDismiss={() => setTimePickerTarget(null)}
        onSelect={(time) => {
          if (timePickerTarget) {
            updateMinyan(timePickerTarget.minyanKey, timePickerTarget.field, time);
          }
        }}
      />
    </Modal>
  );
}

// ─── Main Dashboard ───

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

export default function GabbaiDashboard() {
  const { profile, username, signOut } = useAuth();
  const router = useRouter();
  const [slots, setSlots] = useState<ReadingSlotWithMinyanim[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const fetchSlots = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('reading_slots')
      .select('*, minyan_slots(*)')
      .eq('gabbai_id', profile.id)
      .gte('reading_date', getShabbatThreshold())
      .order('reading_date', { ascending: true });
    setSlots((data as ReadingSlotWithMinyanim[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const toggleMinyanStatus = async (minyan: MinyanSlot) => {
    const newStatus = minyan.status === 'open' ? 'taken' : 'open';
    await supabase
      .from('minyan_slots')
      .update({ status: newStatus })
      .eq('id', minyan.id);
    fetchSlots();
  };

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n${message}`)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחק', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const deleteMinyan = (minyan: MinyanSlot) => {
    confirmAction('מחיקת מניין', 'האם למחוק מניין זה?', async () => {
      await supabase.from('minyan_slots').delete().eq('id', minyan.id);
      const { count } = await supabase
        .from('minyan_slots')
        .select('id', { count: 'exact', head: true })
        .eq('reading_slot_id', minyan.reading_slot_id);
      if (count === 0) {
        await supabase
          .from('reading_slots')
          .delete()
          .eq('id', minyan.reading_slot_id);
      }
      fetchSlots();
    });
  };

  const deleteParasha = (slot: ReadingSlotWithMinyanim) => {
    confirmAction(
      'מחיקת שבת',
      'האם אתה בטוח שברצונך למחוק את כל השבת הזו וכל המניינים שלה?',
      async () => {
        await supabase.from('reading_slots').delete().eq('id', slot.id);
        fetchSlots();
      },
    );
  };

  return (
    <View style={styles.container}>
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

      <Text variant="bodyLarge" style={styles.sectionLabel}>
        קריאות בבית הכנסת שלי:
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : slots.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            אין קריאות עדיין
          </Text>
          <Text variant="bodyMedium" style={styles.emptySubtext}>
            לחץ על + כדי להוסיף קריאה חדשה
          </Text>
        </View>
      ) : (
        <FlatList
          data={slots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleMedium" style={styles.rtl}>
                    {item.parasha_name}
                  </Text>
                  <View style={styles.cardHeaderRight}>
                    <Text variant="bodySmall" style={styles.dateChip}>
                      {formatDate(item.reading_date)}
                    </Text>
                    <IconButton
                      icon="delete-outline"
                      size={20}
                      onPress={() => deleteParasha(item)}
                    />
                  </View>
                </View>

                {!!item.notes && <ExpandableNote text={item.notes} />}

                {item.minyan_slots.length === 0 ? (
                  <Text variant="bodySmall" style={styles.noMinyanim}>
                    אין מניינים
                  </Text>
                ) : (
                  item.minyan_slots.map((minyan) => (
                    <Surface
                      key={minyan.id}
                      style={styles.minyanRow}
                      elevation={0}
                    >
                      <View style={styles.minyanInfo}>
                        <Text variant="bodyMedium" style={styles.rtl}>
                          תפילה: {formatTime(minyan.prayer_start_time)} | קריאה:{' '}
                          {formatTime(minyan.reading_start_time)}
                        </Text>
                        <View style={styles.statusGroup}>
                          <Chip
                            compact
                            style={{
                              backgroundColor:
                                minyan.status === 'open' ? '#4CAF50' : '#2196F3',
                            }}
                            textStyle={styles.chipText}
                          >
                            {minyan.status === 'open' ? 'פתוח' : 'נתפס'}
                          </Chip>
                          <Button
                            mode="text"
                            compact
                            onPress={() => toggleMinyanStatus(minyan)}
                          >
                            {minyan.status === 'open'
                              ? 'סמן כנתפס'
                              : 'פתח קריאה'}
                          </Button>
                        </View>
                      </View>
                      {minyan.nusach && minyan.nusach.length > 0 && (
                        <View style={styles.nusachRow}>
                          {minyan.nusach.map((n) => (
                            <Chip key={n} compact style={styles.nusachChipSmall}>
                              {n}
                            </Chip>
                          ))}
                        </View>
                      )}
                      <View style={styles.minyanActions}>
                        <IconButton
                          icon="delete-outline"
                          size={20}
                          onPress={() => deleteMinyan(minyan)}
                        />
                      </View>
                    </Surface>
                  ))
                )}
              </Card.Content>
            </Card>
          )}
        />
      )}

      <FAB
        icon="plus"
        label="הוסף קריאה חדשה"
        style={styles.fab}
        onPress={() => setAddModalVisible(true)}
      />

      <AddSlotModal
        visible={addModalVisible}
        userId={profile!.id}
        onDismiss={() => setAddModalVisible(false)}
        onCreated={() => {
          setAddModalVisible(false);
          fetchSlots();
        }}
      />
    </View>
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
  sectionLabel: {
    color: colors.text,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  loader: {
    marginTop: 48,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
  },
  emptySubtext: {
    color: '#999',
    marginTop: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rtl: {},
  dateChip: {
    color: '#666',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noMinyanim: {
    color: '#999',
    textAlign: 'center',
    marginVertical: 8,
  },
  minyanRow: {
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    backgroundColor: '#FAFAFA',
  },
  minyanInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  minyanActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 4,
  },
  nusachRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  nusachChipSmall: {
    backgroundColor: '#E8EAF6',
    height: 28,
  },
  nusachLabel: {
    marginTop: 8,
    marginBottom: 6,
    color: '#666',
  },
  nusachChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  nusachFormChip: {
    marginBottom: 2,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.parchmentLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 20,
    color: colors.text,
  },
  dropdownLabel: {
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
  minyanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  minyanDraft: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  minyanDraftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeInput: {
    marginBottom: 8,
  },
  modalInput: {
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
  },
  noteText: {
    color: '#555',
    marginTop: 4,
    marginBottom: 4,
    fontStyle: 'italic',
  },
});
