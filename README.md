# Gemini Journal & AI Reflections

A secure, user-authenticated journaling web application that uses Firebase Authentication (Google Sign-In), Cloud Firestore for owner-isolated multi-turn conversation storage, and the Gemini 3.6 Flash API for empathetic reflection, synthesis, and creative brainstorming.

---

## 🌟 Key Features

1. **Secure Federated Authentication**: Outsources identity to Google Sign-In via Firebase Auth. No raw credentials or passwords stored in the application.
2. **Owner-Bound Cloud Firestore Isolation**: Guarantees that users can only read, write, and list their own journal entries and reflection history.
3. **Gemini 3.6 Flash Multi-Turn Intelligence**: Generates executive summaries, deep introspections, brainstorming action items, and cognitive reframings with multi-turn conversational follow-ups.
4. **Resilient Model Fallback Ladder**: Automatically cascades between `gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`, and `gemini-3.7-flash` if transient rate limits occur.
5. **Zero-Hardcoding Hygiene**: All Gemini API keys and sensitive credentials remain server-side in Secret Manager / environment variables.

---

## 🛡️ Threat Model & Security Countermeasures

| Threat Zone | Potential Vulnerability | Implemented Countermeasure |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious injection or oversized payload | JSON body parser limited to 2MB, strict parameter typing, and text sanitization. |
| **Planning & Reasoning** | Prompt injection / jailbreak attempts | User journal text is passed purely as encapsulated data strings (`"""..."""`) with dedicated system instructions. |
| **Tool / API Execution** | API key leakage to browser client | Gemini API calls are strictly handled server-side via Express routes (`/api/gemini/reflect`). Zero keys exposed in frontend bundle. |
| **Memory & State** | Cross-tenant data leakage / unauthorized reads | Firestore Security Rules enforce `request.auth.uid == userId` on path `/users/{userId}/{document=**}`. |
| **Inter-System Communication** | Serialization crashes / unhandled undefined values | Strict recursive undefined-stripping (`sanitizeFirestorePayload`) prior to Firestore writes. |

---

## 🔒 Firestore Security Rules

Deploy the following security rules to Cloud Firestore to isolate all user reflections and chat histories:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🚀 Google Cloud Run Deployment Guide

### 1. Prerequisites & GCP API Setup
Enable the required Google Cloud APIs for Cloud Run, Secret Manager, and Firestore:

```bash
# Set your project ID
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export REGION="asia-southeast1" # Or your preferred region (e.g. us-central1)
gcloud config set project $PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

---

### 2. Secret Management Setup
Create and populate the `GEMINI_API_KEY` secret in Google Cloud Secret Manager and bind permissions to the Cloud Run service account:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Retrieve your project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

### 3. Deploy to Cloud Run
Build and deploy the application container to Cloud Run with the Secret Manager binding:

```bash
# Deploy to Cloud Run
gcloud run deploy gemini-journal \
  --source . \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port=3000
```

---

### 4. Required Campaign Labeling
Apply the mandatory resource label to register the service for automated challenge verification:

```bash
gcloud run services update gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION
```

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start local fullstack development server (Port 3000)
npm run dev

# Build production bundle
npm run build

# Start production server
npm start
```
