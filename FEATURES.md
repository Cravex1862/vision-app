# Vision Assist - TTS & STT Features

## Features Implemented

### 🔊 Text-to-Speech (TTS)
- **Automatic announcements** when receiving responses from Gemini AI
- **Startup announcement** that explains how to use the app
- **Tap the output panel** to replay the last response
- **Visual indicator** (🔊) shows when speech is active

### 🎤 Speech-to-Text (STT)
- **Voice input** for asking questions
- Long-press the output panel to open the question modal with voice input enabled
- Click the **🎤 Voice** button in the question modal to start/stop recording
- Visual indicator shows when listening for voice input

## How to Use

### Basic Usage
1. **Tap anywhere on camera view** → AI describes what it sees (with voice announcement)
2. **Long-press camera view** → Opens question dialog
3. **Tap output panel** → Replays the last response
4. **Long-press output panel** → Opens question dialog with voice input

### Voice Questions
1. Long-press the output panel (or camera view)
2. Click the **🎤 Voice** button (turns red when recording)
3. Speak your question
4. Click **🎤 Stop** when done
5. Your spoken text appears in the text field
6. Click **Ask** to submit

### Startup Announcement
Every time the app starts, it announces:
> "Welcome to Vision Assist. Tap anywhere to describe what the camera sees. Long press to ask a custom question. Double tap the bottom panel to hear the response. Triple tap to ask a question with your voice."

## Permissions Required

### Android
- `CAMERA` - To capture images
- `RECORD_AUDIO` - For voice input

### iOS
- Camera permission
- Microphone permission
- Speech recognition permission

## Dependencies

- `expo-speech` - Text-to-Speech functionality
- `@react-native-voice/voice` - Speech-to-Text functionality
- `expo-av` - Audio support

## Technical Details

### Speech Settings
- **Language**: English (en-US)
- **Pitch**: 1.0 (normal)
- **Rate**: 0.9 (slightly slower for clarity)

### Voice Recognition
- Uses native speech recognition APIs
- Supports real-time transcription
- Error handling with user-friendly alerts

## Running the App

```bash
# Start the development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Troubleshooting

### Voice recognition not working
- Ensure microphone permissions are granted
- Check device has speech recognition support
- Try restarting the app

### TTS not speaking
- Check device volume settings
- Ensure device is not in silent mode
- Verify app has audio permissions

### No startup announcement
- Check camera permissions were granted
- Ensure device volume is up
- Try restarting the app
