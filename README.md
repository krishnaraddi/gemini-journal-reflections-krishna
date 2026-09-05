# Gemini Journal & AI Reflections

A secure, user-authenticated journaling web application that uses Firebase Authentication (Google Sign-In), Cloud Firestore for owner-isolated multi-turn conversation storage, and the Gemini 3.6 Flash API for empathetic reflection, synthesis, and creative brainstorming.

---

## 🌟 Key Features

1. **Secure Federated Authentication**: Outsources identity to Google Sign-In via Firebase Auth. No raw credentials or passwords stored in the application.
2. **Role-Based Access Control (RBAC) & Admin Dashboard**:
   - Distinct roles: `admin` and `user` with automatic elevation for the organization's designated administrator (`krishnaraddi@gmail.com`).
   - Administrative user directory with live search, role toggling (Promote/Demote), and account status management (Active/Suspend).
   - Immutable security audit trail (`/admin_audit_logs`) tracking administrative promotions, demotions, suspensions, and access attempts.
   - OWASP A01 access control barrier with locked screen enforcement for suspended accounts or non-admin attempts.
3. **Owner-Bound Cloud Firestore Isolation**: Guarantees that users can only read, write, and list their own journal entries and reflection history.
4. **Location-Aware Reflections (Google Maps Platform)**:
   - High-accuracy GPS detection with one-click anchoring.
   - Interactive pinpointing on Google Maps with click-to-pin.
   - Autocomplete place search for landmarks, cafes, cities, or national parks.
   - Reverse geocoding via secure server-side proxy (`/api/maps/reverse-geocode`).
   - Gemini reflection engine automatically incorporates physical context (weather, atmosphere, environment).
   - **Memories Map**: An interactive world map visualizing all geotagged reflections with custom pins and quick entry inspection.
5. **Gemini 3.6 Flash Multi-Turn Intelligence**: Generates executive summaries, deep introspections, brainstorming action items, and cognitive reframings with multi-turn conversational follow-ups.
6. **Resilient Model Fallback Ladder**: Automatically cascades between `gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`, and `gemini-3.7-flash` if transient rate limits occur.
7. **Zero-Hardcoding Hygiene**: All Gemini API keys, Maps API keys, and sensitive credentials remain server-side in Secret Manager / environment variables.

---

## 🛡️ Threat Model & Security Countermeasures

| Threat Zone | Potential Vulnerability | Implemented Countermeasure |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious injection, forged geolocation coordinates, or oversized payload | Strict latitude/longitude float boundary checks (-90 to 90, -180 to 180), string sanitization for queries, and JSON body parser capped at 2MB. |
| **Planning & Reasoning** | Prompt injection / jailbreak attempts via location names or entry text | User journal text and location data are strictly passed as encapsulated, sanitized data properties into prompt templates with explicit model instructions. |
| **Tool / API Execution** | API key leakage to browser client | All Google Maps Geocoding & Places search calls are proxied through `/api/maps/*` endpoints. Client-side map rendering uses restricted keys with `solutionChannel` attribution. |
| **Memory & State** | Broken Access Control / Unauthorized privilege escalation | Firestore Security Rules enforce owner checks (`request.auth.uid == userId`) and dynamic `isAdmin()` document lookups (`getUserData(request.auth.uid).role in ['admin', 'superadmin']`). Users cannot modify their own `role` field. |
| **Inter-System Communication** | Serialization crashes / unhandled undefined values | Strict recursive undefined-stripping (`sanitizeFirestorePayload`) prior to Firestore writes. |

---

## 🔒 Firestore Security Rules

Deploy the following security rules to Cloud Firestore to isolate all user reflections and enforce Role-Based Access Control:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function getUserData(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data;
    }

    function isAdmin() {
      return isAuthenticated() && (
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         getUserData(request.auth.uid).role in ['admin', 'superadmin']) ||
        (request.auth.token.email != null && request.auth.token.email == 'krishnaraddi@gmail.com')
      );
    }

    // User profile and RBAC rules
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isOwner(userId);
      allow update: if (isOwner(userId) && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']))) || isAdmin();
      allow delete: if isAdmin();

      match /entries/{entryId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }

      match /interactions/{interactionId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
    }

    // Admin audit logs - immutable and restricted to administrators
    match /admin_audit_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update, delete: if false;
    }

    match /system_metrics/{metricId} {
      allow read, write: if isAdmin();
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
export PROJECT_ID="apac-cohort3-504814"
export REGION="asia-southeast1" # Or your preferred region (e.g. us-central1)
gcloud config set project $PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  identitytoolkit.googleapis.com
```

---

### 2. Secret Management Setup
Create and populate the `GEMINI_API_KEY` and `GOOGLE_MAPS_API_KEY` secrets in Google Cloud Secret Manager and bind permissions to the Cloud Run service account:

```bash
# Create and populate secrets
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

gcloud secrets create GOOGLE_MAPS_API_KEY --replication-policy="automatic"
echo -n "YOUR_GOOGLE_MAPS_API_KEY" | gcloud secrets versions add GOOGLE_MAPS_API_KEY --data-file=-

# Retrieve your project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant the default Cloud Run service account access to read the secrets
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding GOOGLE_MAPS_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

### 3. Deploy to Cloud Run
Build and deploy the application container to Cloud Run with Secret Manager bindings:

```bash
# Deploy to Cloud Run
gcloud run deploy gemini-journal \
  --source . \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest" \
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
