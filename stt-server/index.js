const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const {SpeechClient} = require('@google-cloud/speech');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Create a Google Speech client. It uses GOOGLE_APPLICATION_CREDENTIALS env var
// or the environment configured on Cloud Run.
const speechClient = new SpeechClient();

app.get('/', (req, res) => res.send('Vision Assist STT server'));

app.post('/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded');

    // Write the uploaded buffer to a temp file
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'upload-'));
    const inPath = path.join(tmpDir, 'input');
    await fs.promises.writeFile(inPath, req.file.buffer);

    // Convert to linear16 WAV at 16kHz
    const outPath = path.join(tmpDir, 'out.wav');
    await new Promise((resolve, reject) => {
      ffmpeg(inPath)
        .outputOptions(['-ar 16000', '-ac 1', '-f wav'])
        .save(outPath)
        .on('end', resolve)
        .on('error', reject);
    });

    // Read output and convert to base64
    const outBuffer = await fs.promises.readFile(outPath);
    const audioBytes = outBuffer.toString('base64');

    // Call Google Speech-to-Text
    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true
      }
    };

    const [response] = await speechClient.recognize(request);
    const transcription = (response.results || []).map(r => r.alternatives[0].transcript).join('\n') || '';

    // Cleanup
    try { await fs.promises.rm(tmpDir, { recursive: true, force: true }); } catch (e) {}

    res.json({ transcript: transcription });
  } catch (err) {
    console.error('Transcription error', err);
    res.status(500).send(String(err && err.message ? err.message : err));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`STT server listening on ${PORT}`));
