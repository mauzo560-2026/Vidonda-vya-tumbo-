/**
 * Security verification specification for Firestore rules (Dirty Dozen test cases).
 * Validates that every adversarial payload violates at least one explicit rules gate.
 */
export interface DirtyDozenCase {
  id: string;
  targetCollection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  description: string;
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    targetCollection: 'leads',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Admin email spoof with email_verified=false rejected by isVerifiedEmail().',
  },
  {
    id: 'DD-02',
    targetCollection: 'leads',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Unauthenticated or non-admin visitor cannot read PII in leads.',
  },
  {
    id: 'DD-03',
    targetCollection: 'leads',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Shadow field injection rejected by keys().hasOnly().',
    payload: { sessionId: 'sess_12345678', isAdmin: true },
  },
  {
    id: 'DD-04',
    targetCollection: 'assessments',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Assessment without explicit consentGiven == true rejected.',
    payload: { leadId: 'sess_12345678', consentGiven: false },
  },
  {
    id: 'DD-05',
    targetCollection: 'leads',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Visitor cannot mutate immutable PII fields (fullName, phone) after creation.',
    payload: { fullName: 'Tampered Name' },
  },
  {
    id: 'DD-06',
    targetCollection: 'leads',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Visitor cannot roll back currentStep or completed flags.',
    payload: { currentStep: 1, contactConfirmed: false },
  },
  {
    id: 'DD-07',
    targetCollection: 'funnel_events',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Orphaned event referencing missing campaignId rejected by exists().',
    payload: { sessionId: 'sess_12345678', campaignId: 'nonexistent_campaign' },
  },
  {
    id: 'DD-08',
    targetCollection: 'leads',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Client-forged createdAt timestamp rejected by == request.time.',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 'DD-09',
    targetCollection: 'ebooks',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Non-admin cannot create or modify eBooks.',
    payload: { title: 'Unauthorized Book' },
  },
  {
    id: 'DD-10',
    targetCollection: 'leads',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Oversized ID or string rejected by isValidId() and .size() bounds.',
    payload: { sessionId: 'x'.repeat(300) },
  },
  {
    id: 'DD-11',
    targetCollection: 'slides',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Visitors cannot list inactive slides (resource.data.isActive == true enforced).',
  },
  {
    id: 'DD-12',
    targetCollection: 'admins',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Non-admin privilege escalation into /admins blocked by isAdmin().',
    payload: { email: 'attacker@example.com', role: 'super_admin' },
  },
];
