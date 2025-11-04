Vision Assist STT server

This small Node.js server receives an uploaded audio file (multipart/form-data, field `file`), transcodes it to LINEAR16 WAV using ffmpeg, calls Google Cloud Speech-to-Text, and returns JSON { transcript: '...' }.

Quick start (local)

1. Create a Google Cloud service account with the `Speech-to-Text` role and download the JSON key.
2. Set the environment variable for the service account JSON path:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\service-account.json'
npm install
node index.js
```

3. POST a multipart/form-data request with form field `file` to `http://localhost:3000/transcribe`.

Deploy to Cloud Run (recommended for ffmpeg):

1. Build and push a container (replace PROJECT_ID and REGION):

```bash
# build image
docker build -t gcr.io/PROJECT_ID/vision-assist-stt:latest .
# push
docker push gcr.io/PROJECT_ID/vision-assist-stt:latest
```

2. Deploy to Cloud Run and attach a service account with Speech-to-Text permissions. Alternatively set the `GOOGLE_APPLICATION_CREDENTIALS` as a secret.

Notes

- This server uses ffmpeg-static, so ffmpeg is available in the container.
- Adjust `languageCode` in `index.js` if you need another language.
- For production, secure this endpoint (authentication, rate limits, etc.) and restrict access to your mobile app.
