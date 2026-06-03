import { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/lib/theme';

const STORAGE_KEY = 'hasSeenInstructions';

export default function InstructionsModal() {
  const [visible, setVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val !== 'true') setVisible(true);
    });
  }, []);

  const handleDismiss = async () => {
    if (dontShowAgain) {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    }
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text variant="headlineSmall" style={styles.title}>
            {'‫איך זה עובד?‬'}
          </Text>

          <View style={styles.bullet}>
            <Text style={styles.bulletText}>
              {'‫'}<Text style={styles.bold}>גבאי</Text> - רושם את כתובת בית הכנסת
              ואת השעות של המניינים שאין להם קורא{'‬'}
            </Text>
          </View>

          <View style={styles.bullet}>
            <Text style={styles.bulletText}>
              {'‫'}<Text style={styles.bold}>בעל קורא</Text> - מחפש קריאות באזור שלו ופונה לגבאי בוואטסאפ{'‬'}
            </Text>
          </View>

          <Text style={styles.note}>
            סגירה סופית \ תשלום \ אימות - בפרטי!
          </Text>

          <Text style={styles.warning}>
            {'‫אין להשאיר כתובת מגורים - רק כתובת של בית הכנסת!‬'}
          </Text>

          <Pressable
            style={styles.checkboxRow}
            onPress={() => setDontShowAgain((prev) => !prev)}
          >
            <Text style={styles.checkboxLabel}>אל תציג הודעה זו שוב</Text>
            <View
              style={[
                styles.checkbox,
                dontShowAgain && styles.checkboxChecked,
              ]}
            >
              {dontShowAgain && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
          </Pressable>

          <Button
            mode="contained"
            onPress={handleDismiss}
            style={styles.button}
            labelStyle={styles.buttonLabel}
          >
            הבנתי
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.parchment,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1E293B',
    marginBottom: 20,
  },
  bullet: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  bulletText: {
    width: '100%',
    fontSize: 15,
    lineHeight: 24,
    color: '#1E293B',
  },
  bold: {
    fontWeight: 'bold',
  },
  note: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 12,
  },
  warning: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 'bold',
    color: '#C0392B',
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    marginEnd: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  button: {
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: 4,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
