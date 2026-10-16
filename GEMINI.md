# Scriptorium - Architectural Log & Developer Reference

## Overview
**Scriptorium** is an agentic project supervisory console.
- **GCP Project**: `scriptorium-503507`
- **Supervisor SPA**: React 18 + TypeScript + Vite + Tailwind CSS.
  - Left Panel (70%): Real-time reactive view of raw Firestore `project` document (`projects/project-default`).
  - Right Panel (30%): Chat console interacting with Gemini 3.8 Flash with tool invocation cards and status badges.
- **Backend**: Firebase Cloud Functions v2 (TypeScript / Node.js 20) with Server-Sent Events (SSE).
- **Agent**: Native Gemini Function Calling (`@google/genai`) executing discrete mutations on Firestore documents.

## Key Directories and Files
- `package.json`: Root project scripts for running tests (`npm test`) and tailing logs (`npm run logs`).
- `firestore.rules`: Security rules for Firestore (`projects` and subcollections).
- `firebase.json`: Configuration for Cloud Functions, Firestore, and emulator suite.
- `.vscode/launch.json`: VS Code launch configurations for Dev Server, Emulators, and Full Stack compound runner.
- `.env.example`: Template for required environment variables.
- `scripts/`: Project utility scripts.
  - `scripts/run_tests.js`: Interactive and CLI Playwright test runner with pre-flight health checks.
  - `scripts/tail_logs.js`: Real-time Firestore `function_logs` tailing tool.
- `tests/`: End-to-end integration and Playwright test suite.
  - `cloudHelpers.js`: Firestore and Cloud Functions test harness helpers.
  - `loggingHelper.js`: Playwright fixture with real-time console error interception, Firestore telemetry, and unconditional output of the `function_logs` tail upon test teardown.
  - `playwright.config.js`: Playwright configuration for local (port 3000) and production profiles.
  - `testSearchHelpers.js`: Vertex AI Search test lifecycle helpers (GCS test document upload, Discovery Engine reindex polling, and cleanup).
  - `searchTalent_validQuery_returnsVertexSearchResults_test.spec.js`: E2E test verifying test document generation with random ID, Discovery Engine reindexing, Cloud Function querying, and API result assertions.
  - `supervisorConsole_initialLoad_rendersSplitLayoutAndControls_test.spec.js`: E2E test verifying supervisor layout.
  - `supervisorAgent_multiTurnTools_mutatesFirestoreAndUpdatesViewer_test.spec.js`: Multi-turn E2E test verifying seeding, tool badge streaming, and reactive document mutations.
- `functions/`: Cloud Functions backend.
  - `src/index.ts`: HTTP endpoints (`/chat` with SSE, `/seed`, `/searchTalent`).
  - `src/logger.ts`: Centralized Firestore structured telemetry (`logToFirestore`), automatic `console` interception (`setupFirestoreLogging`), and sensitive parameter masking.
  - `src/config.ts`: Fail-fast environment variable validation (`GEMINI_API_KEY`, `GCP_PROJECT_ID`, `VERTEX_SEARCH_PROJECT_NUMBER`, `VERTEX_SEARCH_DATASTORE_ID`).
  - `src/vertexSearch.ts`: Discovery Engine (Vertex AI Search) client querying `eu-discoveryengine.googleapis.com` with GoogleAuth.
  - `src/types.ts`: Backend models (`ProjectDocument`, `ToolCallExecution`, `ChatMessageRecord`, `FunctionLogEntry`).
  - `src/firestore.ts`: Firebase Admin SDK initialization, document fetchers, and seeding helpers.
  - `src/agent.ts`: Gemini agent orchestration loop, multi-turn tool handling, and streaming dispatcher.
  - `src/tools/declarations.ts`: Native Gemini `FunctionDeclaration` schemas (`updateStatus`, `renameProject`, `updateDescription`, `addTag`, `removeTag`).
  - `src/tools/executors.ts`: Concrete Firestore mutation handlers with strict parameter validation.
  - `vitest.config.ts`: Test runner configuration.
  - `tests/`: Local unit tests adhering to `methodname_initialstate_expectedbehaviour_test()` convention.
    - `logToFirestore_validParameters_writesToFunctionLogs_test.ts`: Unit test verifying structured Firestore log entries and credential sanitization.
    - `searchVertexAI_validQuery_returnsMatchingTalents_test.ts`: Unit test for Vertex AI search client.
- `frontend/`: Supervisor single-page application.
  - `src/App.tsx`: 70/30 split view layout with live Firestore listener synchronization.
  - `src/config.ts`: Fail-fast frontend environment validator.
  - `src/types.ts`: Frontend TypeScript interfaces for project, messages, and tools.
  - `src/services/firebase.ts`: Client SDK initialization and real-time `onSnapshot` listeners.
  - `src/services/api.ts`: SSE stream client for `/chat` and seed request for `/seed`.
  - `src/components/Header.tsx`: Status badges and "Seed / Reset Project" trigger.
  - `src/components/ProjectViewer.tsx`: Raw JSON document inspector with real-time Firestore `onSnapshot`.
  - `src/components/ChatPanel.tsx`: Chat feed, user input, and tool execution status streaming.
  - `src/components/ToolCallBadge.tsx`: Visual badge for tool invocation cards.
  - `src/tests/`: Local React/DOM unit tests with `data-testid` assertions.

## Conventions & Rules
- **Fail Fast**: Explicit error thrown for missing required environment variables or missing required payload parameters. No silent fallbacks. No mock accounts in production paths.
- **Service Pre-Flight Assertions (Mandatory)**: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING (`await assertServicesRunning(testConfig)`). If any service is unreachable, tests abort immediately.
- **Firestore `function_logs` Telemetry & Test Tail Output (MANDATORY)**:
  - All Cloud Functions log operations, endpoint invocations, and agent tool dispatches to the Firestore `function_logs` collection via global console interception (`setupFirestoreLogging('backend')`) and explicit `logToFirestore()`. Documents include `timestamp` (server timestamp), `service`, `level`, `message`, `details` (masked), and a 24-hour TTL (`expireAt`).
  - ALL Playwright tests using `tests/loggingHelper.js` MUST unconditionally output the chronological tail of `function_logs` recorded during that test run (`where('timestamp', '>=', startTime)`). This block is printed prominently to stdout during fixture teardown and attached to test results.
- **Gemini 3.x / Thinking Models - Thought Signatures Preservation (CRITICAL)**: When building multi-turn Gemini agents with function calling, Gemini 3.x thinking models attach an opaque `thought_signature` token to each `functionCall` part. In multi-turn tool loops, **the entire preceding model `candidate.content` MUST be echoed back untouched into the `contents` history array** (`contents.push(candidate.content)`). NEVER reconstruct or strip the model turn to only `{ functionCall: { name, args } }`, as discarding `thought_signature` triggers a fatal `400 INVALID_ARGUMENT: Function call is missing a thought_signature in functionCall parts` error from Google's API.
- **Firestore Undefined Properties**: `db.settings({ ignoreUndefinedProperties: true })` must be enabled in `functions/src/firestore.ts` to prevent runtime document serialization failures when persisting optional message metadata (e.g. `toolCalls[].error` or `result`).
- **Cloud Functions Build**: Always run `npm run build` from within `/functions` after modifying Cloud Functions.
- **Testing**: Test naming convention: `methodname_initialstate_expectedbehaviour_test()`. Run local tests sequentially, one at a time. All DOM assertions use `data-testid`.
- **Processes**: Local servers/emulators must not be started automatically; the user starts them.


## Developer Workflows

### 1. Running Tests
```bash
# Run interactive Playwright E2E test runner
npm test

# Run a specific Playwright E2E test by name or keyword
npm run test:e2e -- searchTalent
npm run test:e2e -- supervisorAgent
# or invoke runner directly:
node scripts/run_tests.js searchTalent local 1

# Check local services health (frontend, functions emulator, firestore)
npm run check:services

# Run backend unit tests sequentially
npm run test:unit
```

### 2. Tailing Logs
```bash
# Tail Firestore telemetry logs from local emulator
npm run logs:local

# Tail production logs
npm run logs
```

### 3. Running Backend Cloud Functions
Inside `/functions`:
```bash
# Build TypeScript
npm run build

# Run local unit tests sequentially
npx vitest run tests/executeUpdateStatus_validStatus_updatesProjectDocument_test.ts
npx vitest run tests/executeUpdateStatus_invalidStatus_returnsExplicitError_test.ts
npx vitest run tests/executeAddTag_newTag_appendsTagArray_test.ts
npx vitest run tests/executeRenameProject_emptyTitle_returnsExplicitError_test.ts
```

### 4. Running Frontend SPA
Inside `/frontend`:
```bash
# Build
npm run build

# Run local tests sequentially
npx vitest run src/tests/projectViewer_loadedProject_rendersRawJson_test.tsx
npx vitest run src/tests/toolCallBadge_executingState_showsExecutingBadge_test.tsx

# Start development server (started by user)
npm run dev
```

### 5. Environment Variables
- `functions/.env`:
  ```env
  GEMINI_API_KEY=<your-gemini-api-key>
  GCP_PROJECT_ID=scriptorium-503507
  GEMINI_MODEL=gemini-3.8-flash
  ```
- `frontend/.env`:
  ```env
  VITE_FIREBASE_API_KEY=<api-key>
  VITE_FIREBASE_AUTH_DOMAIN=scriptorium-503507.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=scriptorium-503507
  VITE_FIREBASE_STORAGE_BUCKET=scriptorium-503507.appspot.com
  VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
  VITE_FIREBASE_APP_ID=<app-id>
  VITE_API_BASE_URL=http://127.0.0.1:5001/scriptorium-503507/europe-west2
  VITE_PROJECT_ID=project-default
  VITE_USE_EMULATOR=true
  VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1
  VITE_FIRESTORE_EMULATOR_PORT=8080
  ```
