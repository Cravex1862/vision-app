import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, Modal, ActivityIndicator, SafeAreaView, ScrollView, Platform, Alert } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import Constants from 'expo-constants';
import * as Speech from 'expo-speech';
import Voice from '@react-native-voice/voice';
import { Audio } from 'expo-av';

export default function App() {
  const cameraRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [askVisible, setAskVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recordingRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      // Announce app usage on startup
      if (status === 'granted') {
        announceUsage();
      }
      // Request microphone permission for STT recording
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) console.warn('Microphone permission not granted');
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      } catch (err) {
        console.warn('Error requesting audio permission:', err);
      }
    })();

    // Set up voice recognition handlers only if native module is available.
    // In an Expo Go environment the native module for @react-native-voice/voice
    // is not present and calls like `Voice.start()` will throw because the
    // underlying native object is null. We guard here and provide a helpful
    // console warning so the app doesn't crash.
    const voiceAvailable = Voice && typeof Voice.start === 'function' && typeof Voice.stop === 'function';

    if (voiceAvailable) {
      Voice.onSpeechResults = onSpeechResults;
      Voice.onSpeechError = onSpeechError;
    } else {
      console.warn('Voice native module is unavailable. Speech-to-text will not work in this build (Expo Go). Use a custom dev client or prebuild to enable it.');
    }

    return () => {
      if (voiceAvailable && typeof Voice.destroy === 'function') {
        Voice.destroy().then(Voice.removeAllListeners);
      }
    };
  }, []);

  const apiKey = Constants?.expoConfig?.extra?.geminiApiKey || '';
  const model = 'gemini-2.5-flash-lite';

  // Text-to-Speech function
  const speak = useCallback((text) => {
    Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, []);

  // Stop speech
  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  // Announce app usage instructions
  const announceUsage = useCallback(() => {
    const message = 'Welcome to Vision Assist. Tap anywhere to describe what the camera sees. Long press to ask a custom question. Double tap the bottom panel to hear the response. Triple tap to ask a question with your voice.';
    speak(message);
  }, [speak]);

  // Speech-to-Text handlers
  const onSpeechResults = useCallback((e) => {
    if (e.value && e.value.length > 0) {
      const spokenText = e.value[0];
      // Directly call the ask handler with recognized speech
      setIsListening(false);
      handleAsk(spokenText);
    }
  }, []);

  const onSpeechError = useCallback((e) => {
    console.error('Speech error:', e);
    setIsListening(false);
    Alert.alert('Speech Error', 'Could not recognize speech. Please try again.');
  }, []);

  // Start voice recognition
  const startListening = useCallback(async () => {
    try {
      if (!Voice || typeof Voice.start !== 'function') {
        console.error('Voice.start is not available. Likely running in Expo Go where native modules are not included.');
        Alert.alert('Voice unavailable', 'Speech-to-text is not available in this build. Use a custom dev client or prebuild a native build to enable it.');
        return;
      }
      setIsListening(true);
      await Voice.start('en-US');
    } catch (e) {
      console.error('Error starting voice:', e);
      setIsListening(false);
      Alert.alert('Voice Error', 'Could not start voice recognition.');
    }
  }, []);

  // Stop voice recognition
  const stopListening = useCallback(async () => {
    try {
      if (!Voice || typeof Voice.stop !== 'function') {
        console.warn('Voice.stop is not available; nothing to stop.');
        setIsListening(false);
        return;
      }
      await Voice.stop();
      setIsListening(false);
    } catch (e) {
      console.error('Error stopping voice:', e);
    }
  }, []);

  // Start recording audio (expo-av)
  const startRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
      Alert.alert('Recording error', 'Could not start recording.');
    }
  }, []);

  const stopRecordingAndTranscribe = useCallback(async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      setIsRecording(false);
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');

      // Upload the file to STT server
      const STT_SERVER = Constants?.expoConfig?.extra?.sttServerUrl || '';
      if (!STT_SERVER) {
        Alert.alert('STT server not configured', 'Set expo.extra.sttServerUrl in app.json to your transcription endpoint.');
        return;
      }

      const fileResp = await fetch(uri);
      const blob = await fileResp.blob();
      const form = new FormData();
      form.append('file', blob, 'recording.m4a');

      const res = await fetch(STT_SERVER, { method: 'POST', body: form });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`STT server error ${res.status}: ${txt}`);
      }
      const json = await res.json();
      const transcript = json?.transcript || '';
      if (!transcript) {
        Alert.alert('No transcript', 'Could not transcribe the recording');
        return;
      }

      // Use the existing ask flow
      await handleAsk(transcript);
    } catch (err) {
      console.error('Transcription failed', err);
      Alert.alert('Transcription failed', String(err?.message || err));
      setIsRecording(false);
    }
  }, [handleAsk]);

  const captureBase64 = useCallback(async () => {
    if (!cameraRef.current) throw new Error('Camera not ready');
    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7, skipProcessing: true });
    if (!photo?.base64) throw new Error('No image data');
    return { base64: photo.base64, mime: 'image/jpeg' };
  }, []);

  const callGemini = useCallback(async (promptText, image) => {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            { inline_data: { mime_type: image.mime, data: image.base64 } },
          ],
        },
      ],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gemini error ${res.status}: ${txt}`);
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || 'No response';
    return text;
  }, [apiKey]);

  const handleDescribe = useCallback(async () => {
    try {
      if (!apiKey) { setOutput('Set your Gemini API key in app.json > expo.extra.geminiApiKey'); return; }
      setLoading(true);
      setOutput('');
      const image = await captureBase64();
      const resp = await callGemini('Describe this scene in a concise paragraph.', image);
      setOutput(resp);
      // Automatically speak the response
      speak(resp);
    } catch (e) {
      const errorMsg = String(e?.message || e);
      setOutput(errorMsg);
      speak(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [apiKey, captureBase64, callGemini, speak, setLoading, setOutput]);

  const handleAsk = useCallback(async (q) => {
    try {
      if (!q?.trim()) return;
      if (!apiKey) { setOutput('Set your Gemini API key in app.json > expo.extra.geminiApiKey'); return; }
      setLoading(true);
      setOutput('');
      const image = await captureBase64();
      const resp = await callGemini(q.trim(), image);
      setOutput(resp);
      // Automatically speak the response
      speak(resp);
    } catch (e) {
      const errorMsg = String(e?.message || e);
      setOutput(errorMsg);
      speak(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [apiKey, captureBase64, callGemini, speak]);

  // Handle tap on output to speak/stop
  const handleOutputTap = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    } else if (output) {
      speak(output);
    }
  }, [isSpeaking, output, speak, stopSpeaking]);

  if (hasPermission === null) {
    return (
      <View style={styles.center}><ActivityIndicator /><Text style={styles.hint}>Requesting camera permission…</Text></View>
    );
  }
  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.hint}>Camera access denied. Enable it in settings.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Pressable style={StyleSheet.absoluteFill} onPress={handleDescribe} onLongPress={startRecording} onPressOut={stopRecordingAndTranscribe}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} ratio="16:9" />
      </Pressable>

      <View style={styles.topBar} pointerEvents="none">
        <Text style={styles.title}>Vision Assist {isSpeaking && '🔊'}</Text>
        <Text style={styles.subtitle}>Tap: Describe • Long-press: Ask • Triple-tap output: Voice ask</Text>
      </View>

      <Pressable 
        style={styles.bottomSheet}
        onPress={handleOutputTap}
        onLongPress={startRecording}
        onPressOut={stopRecordingAndTranscribe}
      >
        {loading ? (
          <View style={styles.row}><ActivityIndicator /><Text style={styles.hint}> Thinking…</Text></View>
        ) : (
          <ScrollView>
            <Text style={styles.output}>{output || 'Ready. Tap here to repeat, long-press for voice question.'}</Text>
          </ScrollView>
        )}
      </Pressable>

      <Modal visible={askVisible} transparent animationType="fade" onRequestClose={() => { setAskVisible(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ask about what you see {isRecording && '🎤'}</Text>
            <Text style={styles.hint}>Long-press the bottom panel or camera to record your question. Release to send and transcribe.</Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => { setAskVisible(false); }}>
                <Text style={styles.btnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  topBar: { position: 'absolute', top: Platform.select({ ios: 60, default: 30 }), width: '100%', alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#ddd', marginTop: 4 },
  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', maxHeight: '45%', backgroundColor: 'rgba(0,0,0,0.6)', padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  hint: { color: '#ccc', marginLeft: 8 },
  output: { color: '#fff', fontSize: 16, lineHeight: 22 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#111', borderRadius: 12, padding: 16 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 80, color: '#fff', borderColor: '#333', borderWidth: 1, borderRadius: 8, padding: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  btnGhost: { backgroundColor: '#222' },
  btnPrimary: { backgroundColor: '#4f46e5' },
  btnRecording: { backgroundColor: '#dc2626' },
  btnText: { color: '#ddd', fontWeight: '600' },
  btnPrimaryText: { color: '#fff' },
});
