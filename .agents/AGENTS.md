# Project Rules & Agent Directives

## 1. Project Identity & Region Constraints
- Always use the GCP project `scriptorium-503507` when working with this repository.
- All deployed GCP infrastructure, including Firestore databases, Cloud Storage buckets, and Cloud Functions, must be located in the UK region (`europe-west2`). Agents must never create or configure infrastructure in any other region.

## 2. Fail Fast & Resilience
- Never introduce silent default fallbacks for missing template files, prompt configurations, required environment variables, or authenticated states. If any required file or parameter is missing, throw an explicit error immediately.
- Do not insert mock account names (e.g. "@example.com") or dummy fallback values into production code.

## 3. Test Structure & Placement (DO NOT ASK)
- **Playwright E2E Integration Tests**: ALL end-to-end browser and Playwright test specs MUST strictly reside in root `tests/`. Test files follow `methodname_initialstate_expectedbehaviour_test().spec.js`.
- **Backend Unit Tests**: All Cloud Functions unit tests MUST strictly reside in `functions/tests/` (Vitest).
- **Frontend Unit Tests**: All React / DOM unit tests MUST strictly reside in `frontend/src/tests/` (Vitest).
- **Test Invocations**:
  - To run Playwright E2E tests: use `npm test` for interactive selection, or pass the test name directly as a parameter: `npm run test:e2e -- [test-name]` or `node scripts/run_tests.js [test-name] [local|production] [mode]` (e.g. `npm run test:e2e -- searchTalent` or `node scripts/run_tests.js searchTalent`).
  - To run backend unit tests: use `npm run test:unit`.
  - To verify local service health: use `npm run check:services`.
  - To tail Firestore logs: use `npm run logs:local` (local emulator) or `npm run logs` (production).
  - Do not ask the user where test specs go or how to execute them; follow this structure unconditionally.

## 4. Mandatory Test Rule: Service Pre-Flight Assertions
- **AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING.**
- Every Playwright test spec MUST invoke `await assertServicesRunning(testConfig)` as its very first step.
- The pre-flight check verifies connectivity to:
  1. Frontend SPA (`http://localhost:3000`)
  2. Cloud Functions Emulator (`http://127.0.0.1:5001`)
  3. Firestore Emulator (`http://127.0.0.1:8080`)
- If any service is unreachable, the test MUST fail fast immediately with an explicit error indicating which service is down.

## 5. Local Services & Ports
- Frontend SPA: `http://localhost:3000` (Vite dev server).
- Firebase Functions Emulator: `http://127.0.0.1:5001/scriptorium-503507/europe-west2`.
- Firestore Emulator: `127.0.0.1:8080`.
- Process Execution Rule: Never start long-running local frontend or backend server processes automatically. Always ask the user to start them in separate terminals or via `.vscode/launch.json`.

## 6. Build Requirements
- Always run `npm run build` from within `/functions` after modifying Cloud Functions code.
- Ensure all tests use `data-testid` attributes to assert on page elements.

## 7. Gemini 3.x / Thinking Models - Thought Signatures Rule (CRITICAL)
- When building multi-turn Gemini agents with function calling, Gemini 3.x thinking models generate an opaque token `thought_signature` on each `functionCall` part.
- In multi-turn tool loops, the preceding model `candidate.content` must be echoed back intact into the conversation history (`contents.push(candidate.content)`).
- Never discard or strip down the model turn into a synthetic `{ functionCall: { name, args } }` object. Stripping the `thought_signature` causes a fatal API rejection: `400 INVALID_ARGUMENT: Function call is missing a thought_signature in functionCall parts`.

## 8. Firestore `function_logs` Telemetry & Mandatory Test Tail Output
- **Backend Logging**: All Cloud Functions log operational events and tool invocations to the Firestore `function_logs` collection via `setupFirestoreLogging()` console interception and `logToFirestore()` in `functions/src/logger.ts`. Each log record contains `timestamp` (server timestamp), `service`, `level`, `message`, `details` (sanitized/masked), and a 24-hour TTL (`expireAt`).
- **Mandatory Test Tail Output**: ALL Playwright tests MUST unconditionally output the formatted tail of `function_logs` recorded during that test run (`where('timestamp', '>=', startTime)`). This is enforced in `tests/loggingHelper.js` fixture teardown for both passing and failing runs, and attached to test artifacts.

## 9. Tool Naming & Domain Abstraction Rule (CRITICAL)
- **Decoupled Backend Endpoints vs. Contextual Agent Tools**:
  - The underlying backend endpoints, database methods, and cloud services (e.g. Firestore updates, Vertex AI Search imports, GCS uploads) must remain generic infrastructure primitives and do NOT need to know the conversational context.
  - The tool **AS IT APPEARS TO THE AGENT** (`functions/src/tools/declarations.ts`) MUST have a contextual, domain-specific name derived from Scriptorium product strategy in `GEMINI.md` (e.g. `indexTalentCv`, `searchTalentPool`, `updateProjectLifecycleStage`, `addProjectRequirementTag`). This ensures the agent immediately recognizes which tool to invoke when the user says "add this CV to the talent pool" or "update project status".
- **The Dispatcher Translation Layer (`functions/src/tools/executors.ts`)**:
  - The mapping between domain-specific agent tool names and generic infrastructure operations lives strictly in the backend dispatcher (`dispatchToolCall`).
  - When multiple distinct user intents map to the same underlying mutation (e.g. adding a discipline tag vs. a required language), split them into fine-grained, intent-specific agent tools with tailored descriptions.
- **Mandatory Tool Description Schema**:
  - Every tool declaration in `functions/src/tools/declarations.ts` MUST structure its `description` with three distinct contextual elements:
    1. **Business Intent**: Why and when the action is taken within Scriptorium's domain.
    2. **User Trigger Phrases**: Explicit phrasing examples (e.g. `Use when the supervisor asks to "add this CV to the pool", "index candidate", or "save resume"`).
    3. **Negative Guardrails**: Explicit exclusions to prevent tool misrouting (e.g. `Do NOT use this tool for project status updates or tagging`).
  - All parameter descriptions must also be framed in domain terms rather than generic schema terms.


