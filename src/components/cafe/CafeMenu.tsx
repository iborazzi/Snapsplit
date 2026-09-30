import React, { useRef, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Text, TextInput } from 'react-native-paper';
import { menuUrl } from '../../domain/settlement';

type Props = { visible: boolean; onClose: () => void; onAdd: () => void };
export function CafeMenu({ visible, onClose, onAdd }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [link, setLink] = useState('');
  const scanLocked = useRef(false);
  async function startScan() {
    try {
      const granted = permission?.granted || (await requestPermission()).granted;
      if (!granted) { Alert.alert('Camera access needed', 'You can paste the menu link below instead.'); return; }
      scanLocked.current = false;
      setScanning(true);
    } catch { Alert.alert('Camera unavailable', 'Paste the menu link below instead.'); }
  }
  function reviewLink(value: string) {
    if (scanLocked.current) return;
    scanLocked.current = true;
    setScanning(false);
    try { setLink(menuUrl(value)); }
    catch { Alert.alert('Unsupported QR', 'This QR must contain an HTTPS menu link.'); }
  }
  async function openMenu() {
    try {
      const url = menuUrl(link);
      Alert.alert('Open cafe menu?', new URL(url).hostname, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open menu', onPress: () => { Linking.openURL(url).catch(() => Alert.alert('Could not open menu', 'Check the link and try again.')); } },
      ]);
    } catch { Alert.alert('Check menu link', 'Use a complete HTTPS menu URL.'); }
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={() => { setScanning(false); onClose(); }}>
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48, gap: 16, backgroundColor: '#FFF8F0', flexGrow: 1 }}>
      <Text variant="headlineMedium" style={{ fontWeight: '800' }}>Your table. One simple split.</Text>
      <Text>Scan the cafe QR to view its menu. Add your chosen items in USDC to start a shared bill.</Text>
      {visible && scanning && <CameraView style={{ height: 300, borderRadius: 20 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => reviewLink(data)} onMountError={() => { setScanning(false); Alert.alert('Camera unavailable', 'Paste the menu link instead.'); }} />}
      <Button mode="contained" onPress={startScan}>Scan cafe QR</Button>
      <TextInput mode="outlined" label="HTTPS menu link" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Button mode="outlined" disabled={!link.trim()} onPress={openMenu}>View menu in browser</Button>
      <View style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, gap: 12 }}>
        <Text variant="titleLarge">Ready to split?</Text>
        <Text>Menu prices stay in the cafe's currency. Enter agreed USDC prices; SnapSplit does not automatically convert TRY or import website menus.</Text>
        <Button mode="contained" onPress={() => { setScanning(false); onClose(); onAdd(); }}>Add a menu item</Button>
      </View>
      <Button onPress={() => { setScanning(false); onClose(); }}>Back to SnapSplit</Button>
    </ScrollView>
  </Modal>;
}
