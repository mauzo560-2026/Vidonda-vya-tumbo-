# Security Specification — JOS HEALTH KNOWLEDGE HUB

## 1. Data Invariants
1. **PII Isolation (`leads`, `assessments`)**: Personally Identifiable Information (`fullName`, `phone`, `location`, questionnaire health responses) can only be read, listed, or deleted by verified administrators (`isAdmin()`). Unauthenticated visitors and non-admin signed-in users cannot query or fetch any lead or assessment record.
2. **Duplicate Submission & Identity Binding**: A visitor's lead document ID must strictly equal `incoming().sessionId` (validated by `isValidId`), and their assessment document ID must strictly equal `incoming().leadId`. Assessments are immutable (`allow update: if false`).
3. **Immutable Lead PII & Monotonic Progress**: Once a lead record is created with explicit consent (`consentGiven == true`), `fullName`, `phone`, `location`, `consentGiven`, `sessionId`, `campaignId`, and `createdAt` cannot be modified by visitors. Visitors may only advance `currentStep` and flip step completion booleans from `false` to `true`.
4. **Admin Email Verification Gate**: `isAdmin()` requires `request.auth != null && request.auth.token.email_verified == true` alongside either the bootstrapped admin email or membership in `/admins/{uid}`.
5. **Public Configuration & Content Boundaries**: Visitors can only read `campaigns`, `slides`, and `ebooks` where `isActive == true`, and `settings/public_config`. All mutations to campaigns, slides, eBooks, settings, and admins require `isAdmin()`.
6. **Temporal & Volumetric Integrity**: Every document enforces strict `keys().hasAll` + `keys().hasOnly`, field type checks, `.size()` bounds on all strings, regex ID checks (`^[a-zA-Z0-9_-]+$`), and server-timestamp enforcement (`request.time`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Admin Email Spoof**: Signed-in user with `email: "jabirsoloka560@gmail.com"` and `email_verified: false` attempts to `list` `/leads` -> **PERMISSION_DENIED**.
2. **Public PII Scrape**: Unauthenticated visitor attempts `getDocs(collection(db, "leads"))` or `getDoc(doc(db, "leads", "session-123"))` -> **PERMISSION_DENIED**.
3. **Shadow Field Injection on Lead**: Visitor creates a lead with an extra ghost field `isAdmin: true` or `verified: true` -> **PERMISSION_DENIED**.
4. **Consent Bypass on Assessment**: Visitor submits assessment or lead with `consentGiven: false` -> **PERMISSION_DENIED**.
5. **Lead PII Tampering via Update**: Visitor attempts to update `fullName`, `phone`, or `consentGiven` on an existing lead -> **PERMISSION_DENIED**.
6. **Step Regression / Flag Rollback**: Visitor attempts to flip `contactConfirmed` back from `true` to `false` or decrease `currentStep` -> **PERMISSION_DENIED**.
7. **Orphaned Lead / Event**: Visitor attempts to create a `leads` or `funnel_events` doc referencing a non-existent `campaignId` -> **PERMISSION_DENIED**.
8. **Client Timestamp Forgery**: Visitor submits `createdAt` in the past or future instead of `serverTimestamp()` (`request.time`) -> **PERMISSION_DENIED**.
9. **Unauthorized eBook Creation**: Non-admin user attempts to create or modify an `/ebooks/{id}` document -> **PERMISSION_DENIED**.
10. **ID Poisoning / Oversized Payload**: Attacker sends a 1,500-character document ID or a 50KB `fullName` string -> **PERMISSION_DENIED**.
11. **Inactive Campaign / Draft Slide Read**: Visitor attempts to read a campaign or slide where `isActive == false` -> **PERMISSION_DENIED**.
12. **Privilege Escalation on `/admins`**: Non-admin signed-in user attempts to write `/admins/{theirUid}` -> **PERMISSION_DENIED**.
