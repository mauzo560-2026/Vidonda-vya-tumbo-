import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  DEFAULT_CAMPAIGN,
  DEFAULT_CAMPAIGN_ID,
  DEFAULT_EBOOK,
  DEFAULT_EBOOK_ID,
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_SLIDES,
} from '../data/defaults';
import { auth, db, handleFirestoreError, OperationType, storage } from '../firebase';
import type {
  AssessmentAnswers,
  AssessmentRecord,
  Campaign,
  Ebook,
  EducationalSlide,
  FunnelEventRecord,
  FunnelEventType,
  FunnelStep,
  Lead,
  PublicSettings,
  VisitorProgressState,
} from '../types';

const STORAGE_KEY = 'jhk_funnel_state_v1';

const clampStr = (val: string | undefined, max: number): string =>
  (val ?? '').trim().slice(0, max);

const sanitizeId = (val: string): string =>
  val.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);

export function createSessionId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  return `sess_${rand}`.slice(0, 64);
}

export function loadVisitorProgress(): VisitorProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VisitorProgressState>;
      if (parsed.sessionId && typeof parsed.currentStep === 'number') {
        return {
          sessionId: sanitizeId(parsed.sessionId),
          campaignId: parsed.campaignId || DEFAULT_CAMPAIGN_ID,
          currentStep: Math.min(6, Math.max(1, parsed.currentStep)) as FunnelStep,
          slideIndex: typeof parsed.slideIndex === 'number' ? Math.max(0, parsed.slideIndex) : 0,
          educationCompleted: Boolean(parsed.educationCompleted),
          assessmentStepIndex:
            typeof parsed.assessmentStepIndex === 'number' ? Math.max(0, parsed.assessmentStepIndex) : 0,
          assessmentAnswers: parsed.assessmentAnswers || {},
          assessmentSubmitted: Boolean(parsed.assessmentSubmitted),
          fullName: parsed.fullName || '',
          phone: parsed.phone || '',
          location: parsed.location || '',
          consentGiven: Boolean(parsed.consentGiven),
          trackingConsent: parsed.trackingConsent ?? null,
          contactDownloaded: Boolean(parsed.contactDownloaded),
          contactConfirmed: Boolean(parsed.contactConfirmed),
          whatsappClicked: Boolean(parsed.whatsappClicked),
          communityConfirmed: Boolean(parsed.communityConfirmed),
          ebookUnlocked: Boolean(parsed.ebookUnlocked),
          ebookOpened: Boolean(parsed.ebookOpened),
          ebookDownloaded: Boolean(parsed.ebookDownloaded),
        };
      }
    }
  } catch {
    // Ignore storage access errors
  }

  return {
    sessionId: createSessionId(),
    campaignId: DEFAULT_CAMPAIGN_ID,
    currentStep: 1,
    slideIndex: 0,
    educationCompleted: false,
    assessmentStepIndex: 0,
    assessmentAnswers: {},
    assessmentSubmitted: false,
    fullName: '',
    phone: '',
    location: '',
    consentGiven: false,
    trackingConsent: null,
    contactDownloaded: false,
    contactConfirmed: false,
    whatsappClicked: false,
    communityConfirmed: false,
    ebookUnlocked: false,
    ebookOpened: false,
    ebookDownloaded: false,
  };
}

export function saveVisitorProgress(state: VisitorProgressState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

// Consent-aware Meta Pixel helper
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

let initializedPixelId = '';

export function initMetaPixelIfConsented(pixelId: string | undefined, consentGranted: boolean): void {
  const cleanId = (pixelId || '').trim();
  if (!cleanId || !consentGranted || typeof window === 'undefined') return;
  if (initializedPixelId === cleanId && window.fbq) return;

  if (!window.fbq) {
    const fbqFunc = function (...args: unknown[]) {
      (fbqFunc as unknown as { queue: unknown[] }).queue.push(args);
    } as unknown as {
      (...args: unknown[]): void;
      queue: unknown[];
      push: (...args: unknown[]) => void;
      loaded: boolean;
      version: string;
    };
    fbqFunc.push = (...args: unknown[]) => fbqFunc.queue.push(args);
    fbqFunc.loaded = true;
    fbqFunc.version = '2.0';
    fbqFunc.queue = [];
    window.fbq = fbqFunc;
    window._fbq = fbqFunc;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  window.fbq('init', cleanId);
  window.fbq('track', 'PageView');
  initializedPixelId = cleanId;
}

export function trackMetaPixelEvent(
  eventType: FunnelEventType,
  pixelId: string | undefined,
  consentGranted: boolean
): void {
  if (!consentGranted || !pixelId?.trim() || typeof window === 'undefined' || !window.fbq) return;
  const standardMap: Partial<Record<FunnelEventType, string>> = {
    landing_page_viewed: 'ViewContent',
    assessment_completed: 'Lead',
    ebook_unlocked: 'CompleteRegistration',
  };
  const mapped = standardMap[eventType];
  if (mapped) {
    window.fbq('track', mapped, { event_name: eventType });
  } else {
    window.fbq('trackCustom', eventType);
  }
}

// Public Funnel Data Loading (instant cache + parallel Firestore refresh)
export interface FunnelBootstrapData {
  settings: PublicSettings;
  campaign: Campaign;
  slides: EducationalSlide[];
  assignedEbook: Ebook | null;
}

const FUNNEL_CACHE_KEY = 'jhk_funnel_cache_v1';

export function getCachedPublicFunnelData(): FunnelBootstrapData {
  try {
    const raw = localStorage.getItem(FUNNEL_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FunnelBootstrapData>;
      if (parsed.settings && parsed.campaign && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
        return {
          settings: { ...DEFAULT_PUBLIC_SETTINGS, ...parsed.settings },
          campaign: parsed.campaign,
          slides: parsed.slides,
          assignedEbook: parsed.assignedEbook ?? DEFAULT_EBOOK,
        };
      }
    }
  } catch {
    // Ignore cache read error
  }
  return {
    settings: DEFAULT_PUBLIC_SETTINGS,
    campaign: DEFAULT_CAMPAIGN,
    slides: DEFAULT_SLIDES,
    assignedEbook: DEFAULT_EBOOK,
  };
}

export async function loadPublicFunnelData(requestedCampaignId?: string): Promise<FunnelBootstrapData> {
  const [settingsRes, campRes, slidesRes] = await Promise.allSettled([
    getDoc(doc(db, 'settings', 'public_config')),
    getDocs(query(collection(db, 'campaigns'), where('isActive', '==', true))),
    getDocs(query(collection(db, 'slides'), where('isActive', '==', true))),
  ]);

  let settings = DEFAULT_PUBLIC_SETTINGS;
  if (settingsRes.status === 'fulfilled' && settingsRes.value.exists()) {
    settings = { ...DEFAULT_PUBLIC_SETTINGS, ...(settingsRes.value.data() as PublicSettings) };
  }

  let campaign: Campaign = DEFAULT_CAMPAIGN;
  if (campRes.status === 'fulfilled' && !campRes.value.empty) {
    const list = campRes.value.docs.map((d) => ({ ...(d.data() as Omit<Campaign, 'id'>), id: d.id }));
    const matched = requestedCampaignId
      ? list.find((c) => c.id === requestedCampaignId)
      : list.find((c) => c.isDefault) || list[0];
    if (matched) campaign = matched;
  }

  let slides: EducationalSlide[] = DEFAULT_SLIDES;
  if (slidesRes.status === 'fulfilled' && !slidesRes.value.empty) {
    const filtered = slidesRes.value.docs
      .map((d) => ({ ...(d.data() as Omit<EducationalSlide, 'id'>), id: d.id }))
      .filter((s) => s.campaignId === campaign.id)
      .sort((a, b) => a.order - b.order);
    if (filtered.length > 0) {
      slides = filtered;
    }
  }

  let assignedEbook: Ebook | null = DEFAULT_EBOOK;
  try {
    if (campaign.assignedEbookId) {
      const eSnap = await getDoc(doc(db, 'ebooks', campaign.assignedEbookId));
      if (eSnap.exists() && (eSnap.data() as Ebook).isActive) {
        assignedEbook = { ...(eSnap.data() as Omit<Ebook, 'id'>), id: eSnap.id };
      }
    }
  } catch (err) {
    console.warn('Using default eBook:', err);
  }

  const fresh: FunnelBootstrapData = { settings, campaign, slides, assignedEbook };
  try {
    localStorage.setItem(FUNNEL_CACHE_KEY, JSON.stringify(fresh));
  } catch {
    // Ignore cache write error
  }
  return fresh;
}

const ONCE_PER_SESSION_EVENTS = new Set<FunnelEventType>([
  'landing_page_viewed',
  'welcome_started',
  'education_started',
  'education_completed',
  'assessment_started',
  'assessment_completed',
  'contact_card_downloaded',
  'contact_save_confirmed',
  'whatsapp_invitation_clicked',
  'community_join_confirmed',
  'ebook_unlocked',
]);

export async function recordFunnelEvent(params: {
  sessionId: string;
  campaignId: string;
  eventType: FunnelEventType;
  ebookId?: string;
  consentGranted: boolean;
  metaPixelId?: string;
}): Promise<void> {
  const sessionId = sanitizeId(params.sessionId);
  const campaignId = sanitizeId(params.campaignId || DEFAULT_CAMPAIGN_ID);
  const isOnce = ONCE_PER_SESSION_EVENTS.has(params.eventType);
  const eventId = isOnce
    ? sanitizeId(`${sessionId}_${params.eventType}`)
    : sanitizeId(`${sessionId}_${params.eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

  trackMetaPixelEvent(params.eventType, params.metaPixelId, params.consentGranted);

  const payload: Record<string, unknown> = {
    sessionId,
    campaignId,
    eventType: params.eventType,
    consentGranted: Boolean(params.consentGranted),
    createdAt: serverTimestamp(),
  };
  if (params.ebookId) {
    payload.ebookId = clampStr(params.ebookId, 128);
  }

  try {
    // Check local dedupe for once-per-session events to avoid unnecessary writes
    const dedupeKey = `jhk_ev_${eventId}`;
    if (isOnce && sessionStorage.getItem(dedupeKey)) {
      return;
    }
    await setDoc(doc(db, 'funnel_events', eventId), payload);
    if (isOnce) {
      sessionStorage.setItem(dedupeKey, '1');
    }
  } catch (err) {
    // Ignore already-exists permission rejection on deterministic once-per-session event IDs
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('Missing or insufficient permissions')) {
      console.warn('Event logging skipped:', msg);
    }
  }
}

export async function submitAssessmentAndLead(params: {
  sessionId: string;
  campaignId: string;
  answers: AssessmentAnswers;
  fullName: string;
  phone: string;
  location: string;
  consentGiven: boolean;
  assignedEbookId?: string;
}): Promise<void> {
  const leadId = sanitizeId(params.sessionId);
  const campaignId = sanitizeId(params.campaignId || DEFAULT_CAMPAIGN_ID);

  if (!params.consentGiven) {
    throw new Error('Idhini yako inahitajika kabla ya kuhifadhi taarifa.');
  }

  const hasWarningSigns = params.answers.warningSigns === 'ndiyo';

  const assessmentPayload = {
    leadId,
    campaignId,
    upperAbdominalDiscomfort: clampStr(params.answers.upperAbdominalDiscomfort || 'sitaki_kusema', 64),
    heartburn: clampStr(params.answers.heartburn || 'sitaki_kusema', 64),
    acidRegurgitation: clampStr(params.answers.acidRegurgitation || 'sitaki_kusema', 64),
    symptomFrequency: clampStr(params.answers.symptomFrequency || 'sitaki_kusema', 64),
    symptomDuration: clampStr(params.answers.symptomDuration || 'sitaki_kusema', 64),
    priorMedicalAssessment: clampStr(params.answers.priorMedicalAssessment || 'sitaki_kusema', 64),
    wantsMoreEducation: clampStr(params.answers.wantsMoreEducation || 'sitaki_kusema', 64),
    hasWarningSigns,
    consentGiven: true,
    createdAt: serverTimestamp(),
  };

  const leadPayload: Record<string, unknown> = {
    sessionId: leadId,
    campaignId,
    fullName: clampStr(params.fullName, 160),
    phone: clampStr(params.phone, 40),
    consentGiven: true,
    currentStep: 4,
    educationCompleted: true,
    assessmentCompleted: true,
    contactDownloaded: false,
    contactConfirmed: false,
    whatsappClicked: false,
    communityConfirmed: false,
    ebookUnlocked: false,
    ebookOpened: false,
    ebookDownloaded: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const cleanLocation = clampStr(params.location, 160);
  if (cleanLocation) {
    leadPayload.location = cleanLocation;
  }
  if (params.assignedEbookId) {
    leadPayload.assignedEbookId = clampStr(params.assignedEbookId, 128);
  }

  try {
    await setDoc(doc(db, 'leads', leadId), leadPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `leads/${leadId}`);
  }

  try {
    await setDoc(doc(db, 'assessments', leadId), assessmentPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `assessments/${leadId}`);
  }
}

export async function advanceLeadFlags(
  sessionId: string,
  updates: Partial<{
    currentStep: FunnelStep;
    contactDownloaded: boolean;
    contactConfirmed: boolean;
    whatsappClicked: boolean;
    communityConfirmed: boolean;
    ebookUnlocked: boolean;
    ebookOpened: boolean;
    ebookDownloaded: boolean;
    assignedEbookId: string;
  }>
): Promise<void> {
  const leadId = sanitizeId(sessionId);
  try {
    await updateDoc(doc(db, 'leads', leadId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-fatal if lead document wasn't created (e.g. offline mode), log cleanly
    console.warn('Could not sync lead step progress:', err);
  }
}

// ---------------- ADMIN FUNCTIONS ----------------

export async function seedInitialDataIfNeeded(): Promise<void> {
  const baseBatch = writeBatch(db);
  let hasBaseWrites = false;

  const settingsRef = doc(db, 'settings', 'public_config');
  const settingsSnap = await getDoc(settingsRef);
  if (!settingsSnap.exists()) {
    baseBatch.set(settingsRef, {
      ...DEFAULT_PUBLIC_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    hasBaseWrites = true;
  }

  const ebookRef = doc(db, 'ebooks', DEFAULT_EBOOK_ID);
  const ebookSnap = await getDoc(ebookRef);
  if (!ebookSnap.exists()) {
    let realSize = DEFAULT_EBOOK.fileSize;
    try {
      const resp = await fetch('/api/default-ebook');
      if (resp.ok) {
        const meta = (await resp.json()) as { fileSize: number };
        realSize = meta.fileSize || realSize;
      }
    } catch {
      // Keep default size
    }
    const { id: _eid, ...ebookFields } = DEFAULT_EBOOK;
    baseBatch.set(ebookRef, {
      ...ebookFields,
      fileSize: realSize,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    hasBaseWrites = true;
  }

  const campRef = doc(db, 'campaigns', DEFAULT_CAMPAIGN_ID);
  const campSnap = await getDoc(campRef);
  if (!campSnap.exists()) {
    const { id: _cid, ...campFields } = DEFAULT_CAMPAIGN;
    baseBatch.set(campRef, {
      ...campFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    hasBaseWrites = true;
  }

  if (hasBaseWrites) {
    try {
      await baseBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'initial_seed_base_batch');
    }
  }

  const slidesSnap = await getDocs(collection(db, 'slides'));
  if (slidesSnap.empty) {
    const slidesBatch = writeBatch(db);
    for (const slide of DEFAULT_SLIDES) {
      const { id, ...slideFields } = slide;
      slidesBatch.set(doc(db, 'slides', id), {
        ...slideFields,
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await slidesBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'initial_seed_slides_batch');
    }
  }
}

export interface AdminDashboardBundle {
  campaigns: Campaign[];
  slides: EducationalSlide[];
  ebooks: Ebook[];
  leads: Lead[];
  assessments: AssessmentRecord[];
  events: FunnelEventRecord[];
  settings: PublicSettings;
}

export async function fetchAdminDashboardBundle(): Promise<AdminDashboardBundle> {
  try {
    const [campSnap, slideSnap, ebookSnap, leadSnap, assessSnap, eventSnap, settingsSnap] =
      await Promise.all([
        getDocs(collection(db, 'campaigns')),
        getDocs(query(collection(db, 'slides'), orderBy('order', 'asc'))),
        getDocs(collection(db, 'ebooks')),
        getDocs(collection(db, 'leads')),
        getDocs(collection(db, 'assessments')),
        getDocs(collection(db, 'funnel_events')),
        getDoc(doc(db, 'settings', 'public_config')),
      ]);

    return {
      campaigns: campSnap.docs.map((d) => ({ ...(d.data() as Omit<Campaign, 'id'>), id: d.id })),
      slides: slideSnap.docs.map((d) => ({
        ...(d.data() as Omit<EducationalSlide, 'id'>),
        id: d.id,
      })),
      ebooks: ebookSnap.docs.map((d) => ({ ...(d.data() as Omit<Ebook, 'id'>), id: d.id })),
      leads: leadSnap.docs.map((d) => ({ ...(d.data() as Omit<Lead, 'id'>), id: d.id })),
      assessments: assessSnap.docs.map((d) => ({
        ...(d.data() as Omit<AssessmentRecord, 'id'>),
        id: d.id,
      })),
      events: eventSnap.docs.map((d) => ({
        ...(d.data() as Omit<FunnelEventRecord, 'id'>),
        id: d.id,
      })),
      settings: settingsSnap.exists()
        ? { ...DEFAULT_PUBLIC_SETTINGS, ...(settingsSnap.data() as PublicSettings) }
        : DEFAULT_PUBLIC_SETTINGS,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin_dashboard_bundle');
  }
}

export async function uploadPdfFile(
  file: File
): Promise<{ url: string; fileName: string; fileSize: number; storageProvider: 'server' | 'firebase_storage' }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Ingia kama msimamizi kwanza.');

  const sendToServer = async (forceRefresh: boolean) => {
    const idToken = await user.getIdToken(forceRefresh);
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/api/upload/pdf', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });
  };

  let resp = await sendToServer(false);
  if (resp.status === 401) {
    resp = await sendToServer(true);
  }

  if (resp.ok) {
    const data = (await resp.json()) as { url: string; fileName: string; fileSize: number };
    return {
      url: data.url,
      fileName: data.fileName,
      fileSize: data.fileSize,
      storageProvider: 'server',
    };
  }

  const errBody = (await resp.json().catch(() => ({}))) as { error?: string };

  if (resp.status === 404) {
    const storageRef = ref(storage, `ebooks/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    const snap = await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
    const downloadUrl = await getDownloadURL(snap.ref);
    return {
      url: downloadUrl,
      fileName: file.name,
      fileSize: file.size,
      storageProvider: 'firebase_storage',
    };
  }

  throw new Error(
    errBody.error || `Imeshindwa kupakia faili la PDF (Hitilafu ${resp.status}).`
  );
}

async function prepareImageForUpload(file: File): Promise<File> {
  if (typeof document === 'undefined' || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const maxDim = 1600;
  const keepPng = file.type === 'image/png' || file.type === 'image/webp';
  const targetType = keepPng ? 'image/png' : 'image/jpeg';
  const targetExt = keepPng ? '.png' : '.jpg';

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image decode failed'));
        el.src = objectUrl;
      });

      const { naturalWidth: w, naturalHeight: h } = img;
      if (!w || !h) return file;

      const needsResize = w > maxDim || h > maxDim;
      const needsReencode =
        file.size > 1.5 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

      if (!needsResize && !needsReencode) {
        return file;
      }

      const scale = needsResize ? Math.min(maxDim / w, maxDim / h) : 1;
      const targetW = Math.max(1, Math.round(w * scale));
      const targetH = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      if (!keepPng) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, targetType, keepPng ? undefined : 0.88);
      });
      if (!blob) return file;

      const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
      return new File([blob], `${baseName}${targetExt}`, { type: targetType });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return file;
  }
}

export async function uploadImageFile(file: File): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Ingia kama msimamizi kwanza.');

  const preparedFile = await prepareImageForUpload(file);

  const sendToServer = async (forceRefresh: boolean) => {
    const idToken = await user.getIdToken(forceRefresh);
    const formData = new FormData();
    formData.append('file', preparedFile);
    return fetch('/api/upload/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });
  };

  let resp = await sendToServer(false);
  if (resp.status === 401) {
    resp = await sendToServer(true);
  }

  if (resp.ok) {
    const data = (await resp.json()) as { url: string };
    return data.url;
  }

  const errBody = (await resp.json().catch(() => ({}))) as { error?: string };

  if (resp.status === 404) {
    const storageRef = ref(
      storage,
      `media/${Date.now()}_${preparedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    );
    const snap = await uploadBytes(storageRef, preparedFile, { contentType: preparedFile.type });
    return getDownloadURL(snap.ref);
  }

  throw new Error(
    errBody.error || `Imeshindwa kupakia picha (Hitilafu ${resp.status}). Jaribu picha nyingine.`
  );
}

export async function saveEbookRecord(
  ebook: Omit<Ebook, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId ? sanitizeId(existingId) : `ebook_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const payload: Record<string, unknown> = {
    title: clampStr(ebook.title, 200),
    category: clampStr(ebook.category || 'Afya ya Mfumo wa Chakula', 100),
    pdfUrl: clampStr(ebook.pdfUrl, 1000),
    fileName: clampStr(ebook.fileName, 255),
    fileSize: Math.max(0, Number(ebook.fileSize) || 0),
    storageProvider: ebook.storageProvider || 'server',
    isActive: Boolean(ebook.isActive),
    updatedAt: serverTimestamp(),
  };
  if (ebook.description?.trim()) payload.description = clampStr(ebook.description, 1500);
  if (ebook.coverUrl?.trim()) payload.coverUrl = clampStr(ebook.coverUrl, 1000);

  try {
    const ebookRef = doc(db, 'ebooks', id);
    if (existingId) {
      const snap = await getDoc(ebookRef);
      if (snap.exists()) {
        await updateDoc(ebookRef, payload);
      } else {
        await setDoc(ebookRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      await setDoc(ebookRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    try {
      localStorage.removeItem(FUNNEL_CACHE_KEY);
    } catch {
      // Ignore
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, `ebooks/${id}`);
  }
}

export async function deleteEbookRecord(id: string): Promise<void> {
  const cleanId = sanitizeId(id);
  try {
    await deleteDoc(doc(db, 'ebooks', cleanId));
    try {
      localStorage.removeItem(FUNNEL_CACHE_KEY);
    } catch {
      // Ignore
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `ebooks/${cleanId}`);
  }
}

export async function saveCampaignRecord(
  campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId ? sanitizeId(existingId) : `camp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const payload: Record<string, unknown> = {
    name: clampStr(campaign.name, 160),
    topic: clampStr(campaign.topic, 200),
    isActive: Boolean(campaign.isActive),
    isDefault: Boolean(campaign.isDefault),
    updatedAt: serverTimestamp(),
  };
  if (campaign.description?.trim()) payload.description = clampStr(campaign.description, 1000);
  if (campaign.assignedEbookId?.trim()) payload.assignedEbookId = clampStr(campaign.assignedEbookId, 128);

  try {
    if (existingId) {
      await updateDoc(doc(db, 'campaigns', id), payload);
    } else {
      await setDoc(doc(db, 'campaigns', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    try {
      localStorage.removeItem(FUNNEL_CACHE_KEY);
    } catch {
      // Ignore
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, `campaigns/${id}`);
  }
}

export async function deleteCampaignRecord(id: string): Promise<void> {
  const cleanId = sanitizeId(id);
  try {
    await deleteDoc(doc(db, 'campaigns', cleanId));
    try {
      localStorage.removeItem(FUNNEL_CACHE_KEY);
    } catch {
      // Ignore
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `campaigns/${cleanId}`);
  }
}

export async function saveSlideRecord(
  slide: Omit<EducationalSlide, 'id' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId ? sanitizeId(existingId) : `slide_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const payload: Record<string, unknown> = {
    campaignId: sanitizeId(slide.campaignId),
    section: slide.section,
    order: Number(slide.order) || 1,
    title: clampStr(slide.title, 200),
    description: clampStr(slide.description, 2500),
    isActive: Boolean(slide.isActive),
    updatedAt: serverTimestamp(),
  };
  if (slide.imageUrl?.trim()) payload.imageUrl = clampStr(slide.imageUrl, 1000);
  if (slide.illustrationKey?.trim()) payload.illustrationKey = clampStr(slide.illustrationKey, 64);

  try {
    const slideRef = doc(db, 'slides', id);
    if (existingId) {
      const snap = await getDoc(slideRef);
      if (snap.exists()) {
        await updateDoc(slideRef, payload);
      } else {
        await setDoc(slideRef, payload);
      }
    } else {
      await setDoc(slideRef, payload);
    }
    try {
      localStorage.removeItem(FUNNEL_CACHE_KEY);
    } catch {
      // Ignore
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, `slides/${id}`);
  }
}

export async function deleteSlideRecord(id: string): Promise<void> {
  const cleanId = sanitizeId(id);
  try {
    await deleteDoc(doc(db, 'slides', cleanId));
    try {
      localStorage.removeItem(FUNNEL_CACHE_KEY);
    } catch {
      // Ignore
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `slides/${cleanId}`);
  }
}

export async function reorderSlideRecords(slides: EducationalSlide[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    slides.forEach((s, idx) => {
      batch.update(doc(db, 'slides', sanitizeId(s.id)), {
        order: idx + 1,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    try {
      localStorage.removeItem(FUNNEL_CACHE_KEY);
    } catch {
      // Ignore
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'slides_reorder');
  }
}

export async function savePublicSettingsRecord(settings: PublicSettings): Promise<void> {
  const payload: Record<string, unknown> = {
    brandName: clampStr(settings.brandName, 120),
    presenterName: clampStr(settings.presenterName, 120),
    contactName: clampStr(settings.contactName, 160),
    contactPhone: clampStr(settings.contactPhone, 40),
    contactPhoneIntl: clampStr(settings.contactPhoneIntl, 40),
    whatsappNumber: clampStr(settings.whatsappNumber, 40),
    contactOrganization: clampStr(settings.contactOrganization, 160),
    communityName: clampStr(settings.communityName, 160),
    communityMessage: clampStr(settings.communityMessage, 1000),
    whatsappCommunityLink: clampStr(settings.whatsappCommunityLink, 500),
    updatedAt: serverTimestamp(),
  };
  if (settings.contactNote?.trim()) payload.contactNote = clampStr(settings.contactNote, 500);
  if (settings.metaPixelId?.trim()) payload.metaPixelId = clampStr(settings.metaPixelId, 64);
  if (settings.logoUrl?.trim()) payload.logoUrl = clampStr(settings.logoUrl, 1000);
  if (settings.welcomeImageUrl?.trim()) {
    payload.welcomeImageUrl = clampStr(settings.welcomeImageUrl, 1000);
  }

  try {
    await setDoc(doc(db, 'settings', 'public_config'), payload);
    try {
      localStorage.removeItem(FUNNEL_CACHE_KEY);
    } catch {
      // Ignore
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/public_config');
  }
}

export async function fetchPasscodeStatus(): Promise<{
  envControlled: boolean;
  needsSetup: boolean;
}> {
  const resp = await fetch('/api/admin/passcode-status');
  if (!resp.ok) throw new Error('Imeshindwa kukagua hali ya msimbo wa siri.');
  return (await resp.json()) as { envControlled: boolean; needsSetup: boolean };
}

export async function setupAdminPasscode(passcode: string): Promise<string> {
  const resp = await fetch('/api/admin/setup-passcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  });
  const data = (await resp.json()) as { gateToken?: string; error?: string };
  if (!resp.ok || !data.gateToken) {
    throw new Error(data.error || 'Imeshindwa kuweka msimbo wa siri.');
  }
  return data.gateToken;
}

export async function verifyAdminPasscode(passcode: string): Promise<string> {
  const resp = await fetch('/api/admin/verify-passcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  });
  const data = (await resp.json()) as { gateToken?: string; error?: string };
  if (!resp.ok || !data.gateToken) {
    throw new Error(data.error || 'Msimbo wa siri si sahihi.');
  }
  return data.gateToken;
}

export async function changeAdminPasscode(gateToken: string, newPasscode: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Ingia kama msimamizi kwanza.');
  const idToken = await user.getIdToken();
  const resp = await fetch('/api/admin/change-passcode', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Admin-Gate': gateToken,
    },
    body: JSON.stringify({ newPasscode }),
  });
  const data = (await resp.json()) as { gateToken?: string; error?: string };
  if (!resp.ok || !data.gateToken) {
    throw new Error(data.error || 'Imeshindwa kubadili msimbo wa siri.');
  }
  return data.gateToken;
}

export function formatFirestoreDate(val: unknown): string {
  if (!val) return '—';
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toLocaleString('sw-TZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('sw-TZ');
  }
  return '—';
}

export function getTimestampMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

export function exportLeadsToCsv(leads: Lead[], campaigns: Campaign[]): void {
  const campaignNameMap = new Map(campaigns.map((c) => [c.id, c.name]));
  const headers = [
    'Jina Kamili',
    'Namba ya Simu',
    'Eneo',
    'Kampeni',
    'Hatua ya Sasa',
    'Tathmini Imekamilika',
    'Kadi ya Mawasiliano Imepakuliwa',
    'Mawasiliano Yamethibitishwa',
    'WhatsApp Imefunguliwa',
    'Community Imethibitishwa',
    'eBook Imefunguliwa',
    'eBook Imesomwa',
    'eBook Imepakuliwa',
    'Tarehe',
  ];

  const escapeCsv = (cell: string) => `"${cell.replace(/"/g, '""')}"`;

  const rows = leads.map((l) => [
    l.fullName,
    l.phone,
    l.location || '',
    campaignNameMap.get(l.campaignId) || l.campaignId,
    `${l.currentStep}/6`,
    l.assessmentCompleted ? 'Ndiyo' : 'Hapana',
    l.contactDownloaded ? 'Ndiyo' : 'Hapana',
    l.contactConfirmed ? 'Ndiyo' : 'Hapana',
    l.whatsappClicked ? 'Ndiyo' : 'Hapana',
    l.communityConfirmed ? 'Ndiyo' : 'Hapana',
    l.ebookUnlocked ? 'Ndiyo' : 'Hapana',
    l.ebookOpened ? 'Ndiyo' : 'Hapana',
    l.ebookDownloaded ? 'Ndiyo' : 'Hapana',
    formatFirestoreDate(l.createdAt),
  ]);

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map((c) => escapeCsv(String(c))).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `JOS_Leads_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
