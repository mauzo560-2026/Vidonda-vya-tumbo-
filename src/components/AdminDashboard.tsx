import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  Download,
  Edit3,
  Eye,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { ASSETS, DEFAULT_CAMPAIGN_ID, DEFAULT_SLIDES } from '../data/defaults';
import {
  auth,
  db,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  googleProvider,
} from '../firebase';
import {
  changeAdminPasscode,
  deleteCampaignRecord,
  deleteEbookRecord,
  deleteSlideRecord,
  exportLeadsToCsv,
  fetchAdminDashboardBundle,
  fetchPasscodeStatus,
  formatFirestoreDate,
  getTimestampMillis,
  reorderSlideRecords,
  saveCampaignRecord,
  saveEbookRecord,
  savePublicSettingsRecord,
  saveSlideRecord,
  seedInitialDataIfNeeded,
  setupAdminPasscode,
  uploadImageFile,
  uploadPdfFile,
  verifyAdminPasscode,
} from '../services/funnelService';
import type {
  AssessmentRecord,
  Campaign,
  Ebook,
  EducationalSlide,
  FunnelEventRecord,
  FunnelEventType,
  Lead,
  PublicSettings,
  SlideSection,
} from '../types';

interface AdminDashboardProps {
  onBackToFunnel: () => void;
}

type AdminTab =
  | 'overview'
  | 'branding'
  | 'ebooks'
  | 'campaigns'
  | 'slides'
  | 'contact'
  | 'community'
  | 'leads';

const BOOTSTRAPPED_ADMIN_EMAIL = 'jabirsoloka560@gmail.com';

const FUNNEL_STAGE_ORDER: { key: FunnelEventType; label: string }[] = [
  { key: 'landing_page_viewed', label: '1. Ukurasa Umefunguliwa' },
  { key: 'welcome_started', label: '2. Safari Imeanza' },
  { key: 'education_started', label: '3. Elimu Imeanza' },
  { key: 'education_completed', label: '4. Elimu Imekamilika' },
  { key: 'assessment_started', label: '5. Maswali Yameanza' },
  { key: 'assessment_completed', label: '6. Maswali Yamekamilika' },
  { key: 'contact_card_downloaded', label: '7. Kadi ya Simu Imepakuliwa' },
  { key: 'contact_save_confirmed', label: '8. Kuhifadhi Namba Kumethibitishwa' },
  { key: 'whatsapp_invitation_clicked', label: '9. Kiungo cha WhatsApp Kimebofywa' },
  { key: 'community_join_confirmed', label: '10. Kujiunga Community Kumethibitishwa' },
  { key: 'ebook_unlocked', label: '11. eBook Imefunguliwa' },
  { key: 'ebook_opened', label: '12. eBook Imesomwa' },
  { key: 'ebook_downloaded', label: '13. eBook Imepakuliwa' },
];

export function AdminDashboard({ onBackToFunnel }: AdminDashboardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');

  // Two-layer Secret Passcode Gate (gateToken strictly in React memory only)
  const [gateToken, setGateToken] = useState('');
  const [passcodeStatusChecked, setPasscodeStatusChecked] = useState(false);
  const [needsPasscodeSetup, setNeedsPasscodeSetup] = useState(false);
  const [envControlledPasscode, setEnvControlledPasscode] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeConfirmInput, setPasscodeConfirmInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [verifyingPasscode, setVerifyingPasscode] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');
  const [changingPasscode, setChangingPasscode] = useState(false);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadingBranding, setUploadingBranding] = useState<'logo' | 'welcome' | null>(null);
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [slides, setSlides] = useState<EducationalSlide[]>([]);
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [events, setEvents] = useState<FunnelEventRecord[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  // eBook Form Modal State
  const [ebookModalOpen, setEbookModalOpen] = useState(false);
  const [editingEbook, setEditingEbook] = useState<Ebook | null>(null);
  const [ebookTitle, setEbookTitle] = useState('');
  const [ebookDesc, setEbookDesc] = useState('');
  const [ebookCategory, setEbookCategory] = useState('Afya ya Mfumo wa Chakula');
  const [ebookCoverUrl, setEbookCoverUrl] = useState('');
  const [ebookPdfUrl, setEbookPdfUrl] = useState('');
  const [ebookFileName, setEbookFileName] = useState('');
  const [ebookFileSize, setEbookFileSize] = useState(0);
  const [ebookStorageProvider, setEbookStorageProvider] = useState<'server' | 'firebase_storage'>('server');
  const [ebookActive, setEbookActive] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingModal, setSavingModal] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [previewPdfBook, setPreviewPdfBook] = useState<Ebook | null>(null);

  // Campaign Form Modal State
  const [campModalOpen, setCampModalOpen] = useState(false);
  const [editingCamp, setEditingCamp] = useState<Campaign | null>(null);
  const [campName, setCampName] = useState('');
  const [campTopic, setCampTopic] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campEbookId, setCampEbookId] = useState('');
  const [campActive, setCampActive] = useState(true);
  const [campDefault, setCampDefault] = useState(false);

  // Slide Form Modal State
  const [slideFilterCampaign, setSlideFilterCampaign] = useState<string>(DEFAULT_CAMPAIGN_ID);
  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<EducationalSlide | null>(null);
  const [slideTitle, setSlideTitle] = useState('');
  const [slideDesc, setSlideDesc] = useState('');
  const [slideSection, setSlideSection] = useState<SlideSection>('VIDONDA_VYA_TUMBO');
  const [slideImageUrl, setSlideImageUrl] = useState('');
  const [slideActive, setSlideActive] = useState(true);

  // Lead Filters & Detail Modal
  const [leadSearch, setLeadSearch] = useState('');
  const [leadFilterCampaign, setLeadFilterCampaign] = useState('all');
  const [leadFilterDate, setLeadFilterDate] = useState('all');
  const [leadFilterStage, setLeadFilterStage] = useState('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    let active = true;
    fetchPasscodeStatus()
      .then((status) => {
        if (!active) return;
        setEnvControlledPasscode(status.envControlled);
        setNeedsPasscodeSetup(status.needsSetup);
        setPasscodeStatusChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setPasscodeError('Imeshindwa kuunganisha na seva ya usalama.');
        setPasscodeStatusChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthError('');
      if (!u) {
        setIsAuthorized(false);
        setAuthReady(true);
        return;
      }

      const emailMatch =
        u.emailVerified && u.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
      let adminDocExists = false;
      if (!emailMatch) {
        try {
          const snap = await getDoc(doc(db, 'admins', u.uid));
          adminDocExists = snap.exists();
        } catch {
          adminDocExists = false;
        }
      }

      const ok = Boolean(u.emailVerified && (emailMatch || adminDocExists));
      setIsAuthorized(ok);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isAuthorized && gateToken) {
      void refreshData(true);
    }
  }, [isAuthorized, gateToken]);

  const refreshData = async (shouldSeed = false) => {
    setLoadingData(true);
    try {
      if (shouldSeed) {
        await seedInitialDataIfNeeded();
      }
      const bundle = await fetchAdminDashboardBundle();
      setCampaigns(bundle.campaigns);
      setSlides(bundle.slides);
      setEbooks(bundle.ebooks);
      setLeads(bundle.leads);
      setAssessments(bundle.assessments);
      setEvents(bundle.events);
      setSettings(bundle.settings);
      if (bundle.campaigns.length > 0 && !bundle.campaigns.some((c) => c.id === slideFilterCampaign)) {
        setSlideFilterCampaign(bundle.campaigns[0].id);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Imeshindwa kupakia data za msimamizi.');
    } finally {
      setLoadingData(false);
    }
  };

  const notify = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 4000);
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Imeshindwa kuingia kwa Google.');
    }
  };

  const handleSignOut = async () => {
    setGateToken('');
    await signOut(auth);
  };

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    const code = passcodeInput.trim();
    if (code.length < 4) {
      setPasscodeError('Msimbo wa siri lazima uwe na angalau herufi au namba 4.');
      return;
    }

    if (needsPasscodeSetup && code !== passcodeConfirmInput.trim()) {
      setPasscodeError('Misimbo ya siri uliyoingiza haifanani.');
      return;
    }

    setVerifyingPasscode(true);
    try {
      const token = needsPasscodeSetup
        ? await setupAdminPasscode(code)
        : await verifyAdminPasscode(code);
      setGateToken(token);
      setNeedsPasscodeSetup(false);
      setPasscodeInput('');
      setPasscodeConfirmInput('');
    } catch (err) {
      setPasscodeError(err instanceof Error ? err.message : 'Msimbo wa siri si sahihi.');
    } finally {
      setVerifyingPasscode(false);
    }
  };

  const handleChangePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const code = newPasscode.trim();
    if (code.length < 4) {
      setAuthError('Msimbo mpya lazima uwe na angalau herufi au namba 4.');
      return;
    }
    if (code !== confirmNewPasscode.trim()) {
      setAuthError('Misimbo mipya haifanani.');
      return;
    }
    setChangingPasscode(true);
    try {
      const updatedToken = await changeAdminPasscode(gateToken, code);
      setGateToken(updatedToken);
      setNewPasscode('');
      setConfirmNewPasscode('');
      notify('Msimbo wa siri wa msimamizi umebadilishwa.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Imeshindwa kubadili msimbo wa siri.');
    } finally {
      setChangingPasscode(false);
    }
  };

  // ---------------- ANALYTICS COMPUTATIONS ----------------
  const funnelCounts = useMemo(() => {
    const map = new Map<FunnelEventType, Set<string>>();
    for (const stage of FUNNEL_STAGE_ORDER) {
      map.set(stage.key, new Set<string>());
    }
    for (const ev of events) {
      map.get(ev.eventType)?.add(ev.sessionId);
    }
    return map;
  }, [events]);

  const overviewStats = useMemo(() => {
    const visitors = funnelCounts.get('landing_page_viewed')?.size || 0;
    const assessmentsDone = Math.max(
      funnelCounts.get('assessment_completed')?.size || 0,
      leads.length
    );
    const contactDownloaded = funnelCounts.get('contact_card_downloaded')?.size || 0;
    const contactConfirmed = funnelCounts.get('contact_save_confirmed')?.size || 0;
    const communityConfirmed = funnelCounts.get('community_join_confirmed')?.size || 0;
    const ebookUnlocked = funnelCounts.get('ebook_unlocked')?.size || 0;
    const ebookDownloaded = funnelCounts.get('ebook_downloaded')?.size || 0;
    const completionPct = visitors > 0 ? Math.round((ebookUnlocked / visitors) * 100) : 0;

    return {
      visitors,
      assessmentsDone,
      contactDownloaded,
      contactConfirmed,
      communityConfirmed,
      ebookUnlocked,
      ebookDownloaded,
      completionPct,
    };
  }, [funnelCounts, leads.length]);

  const ebookStatsMap = useMemo(() => {
    const stats = new Map<string, { unlocks: number; opens: number; downloads: number }>();
    for (const ev of events) {
      if (!ev.ebookId) continue;
      const cur = stats.get(ev.ebookId) || { unlocks: 0, opens: 0, downloads: 0 };
      if (ev.eventType === 'ebook_unlocked') cur.unlocks += 1;
      if (ev.eventType === 'ebook_opened') cur.opens += 1;
      if (ev.eventType === 'ebook_downloaded') cur.downloads += 1;
      stats.set(ev.ebookId, cur);
    }
    return stats;
  }, [events]);

  // ---------------- EBOOK HANDLERS ----------------
  const openNewEbookModal = () => {
    setEditingEbook(null);
    setEbookTitle('');
    setEbookDesc('');
    setEbookCategory('Afya ya Mfumo wa Chakula');
    setEbookCoverUrl(ASSETS.ebookCover);
    setEbookPdfUrl('');
    setEbookFileName('');
    setEbookFileSize(0);
    setEbookStorageProvider('server');
    setEbookActive(true);
    setModalError('');
    setModalSuccess('');
    setEbookModalOpen(true);
  };

  const openEditEbookModal = (book: Ebook) => {
    setEditingEbook(book);
    setEbookTitle(book.title);
    setEbookDesc(book.description || '');
    setEbookCategory(book.category);
    setEbookCoverUrl(book.coverUrl || ASSETS.ebookCover);
    setEbookPdfUrl(book.pdfUrl);
    setEbookFileName(book.fileName);
    setEbookFileSize(book.fileSize);
    setEbookStorageProvider(book.storageProvider);
    setEbookActive(book.isActive);
    setModalError('');
    setModalSuccess('');
    setEbookModalOpen(true);
  };

  const handleUploadEbookPdf = async (file: File) => {
    setUploadingFile(true);
    setModalError('');
    setModalSuccess('');
    try {
      const res = await uploadPdfFile(file);
      setEbookPdfUrl(res.url);
      setEbookFileName(res.fileName);
      setEbookFileSize(res.fileSize);
      setEbookStorageProvider(res.storageProvider);
      setModalSuccess('Faili la PDF limepakiwa. Bofya "Hifadhi eBook" kumalizia.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Imeshindwa kupakia faili la PDF.';
      setModalError(msg);
      setAuthError(msg);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleUploadEbookCover = async (file: File) => {
    setUploadingFile(true);
    setModalError('');
    setModalSuccess('');
    try {
      const url = await uploadImageFile(file);
      setEbookCoverUrl(url);
      setModalSuccess('Picha ya jalada imepakiwa. Bofya "Hifadhi eBook" kumalizia.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Imeshindwa kupakia picha ya jalada.';
      setModalError(msg);
      setAuthError(msg);
    } finally {
      setUploadingFile(false);
    }
  };

  const alertPlaceholderError = (err: unknown) => {
    setAuthError(err instanceof Error ? err.message : 'Hitilafu imetokea.');
  };

  const handleSaveEbook = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!ebookTitle.trim()) {
      setModalError('Tafadhali weka kichwa cha eBook.');
      return;
    }
    if (!ebookPdfUrl.trim()) {
      setModalError('Tafadhali chagua na upakie faili la PDF kwanza.');
      return;
    }
    setSavingModal(true);
    try {
      await saveEbookRecord(
        {
          title: ebookTitle.trim(),
          description: ebookDesc.trim(),
          category: ebookCategory.trim() || 'Afya',
          coverUrl: ebookCoverUrl.trim(),
          pdfUrl: ebookPdfUrl.trim(),
          fileName: ebookFileName.trim() || 'ebook.pdf',
          fileSize: ebookFileSize,
          storageProvider: ebookStorageProvider,
          isActive: ebookActive,
        },
        editingEbook?.id
      );
      setEbookModalOpen(false);
      await refreshData();
      notify('eBook imehifadhiwa.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Imeshindwa kuhifadhi eBook.';
      setModalError(msg);
      setAuthError(msg);
    } finally {
      setSavingModal(false);
    }
  };

  const handleToggleEbookActive = async (book: Ebook) => {
    try {
      await saveEbookRecord({ ...book, isActive: !book.isActive }, book.id);
      await refreshData();
      notify(book.isActive ? 'eBook imezimwa.' : 'eBook imewashwa.');
    } catch (err) {
      alertPlaceholderError(err);
    }
  };

  const handleDeleteEbook = async (book: Ebook) => {
    try {
      await deleteEbookRecord(book.id);
      await refreshData();
      notify('eBook imefutwa.');
    } catch (err) {
      alertPlaceholderError(err);
    }
  };

  // ---------------- CAMPAIGN HANDLERS ----------------
  const openNewCampaignModal = () => {
    setEditingCamp(null);
    setCampName('');
    setCampTopic('');
    setCampDesc('');
    setCampEbookId(ebooks[0]?.id || '');
    setCampActive(true);
    setCampDefault(false);
    setCampModalOpen(true);
  };

  const openEditCampaignModal = (camp: Campaign) => {
    setEditingCamp(camp);
    setCampName(camp.name);
    setCampTopic(camp.topic);
    setCampDesc(camp.description || '');
    setCampEbookId(camp.assignedEbookId || '');
    setCampActive(camp.isActive);
    setCampDefault(camp.isDefault);
    setCampModalOpen(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName.trim() || !campTopic.trim()) return;
    try {
      await saveCampaignRecord(
        {
          name: campName.trim(),
          topic: campTopic.trim(),
          description: campDesc.trim(),
          assignedEbookId: campEbookId.trim(),
          isActive: campActive,
          isDefault: campDefault,
        },
        editingCamp?.id
      );
      setCampModalOpen(false);
      await refreshData();
      notify('Kampeni imehifadhiwa.');
    } catch (err) {
      alertPlaceholderError(err);
    }
  };

  const handleDeleteCampaign = async (camp: Campaign) => {
    try {
      await deleteCampaignRecord(camp.id);
      await refreshData();
      notify('Kampeni imefutwa.');
    } catch (err) {
      alertPlaceholderError(err);
    }
  };

  // ---------------- SLIDE HANDLERS ----------------
  const filteredSlides = useMemo(() => {
    const matching = slides
      .filter((s) => s.campaignId === slideFilterCampaign)
      .sort((a, b) => a.order - b.order);
    if (matching.length === 0 && slideFilterCampaign === DEFAULT_CAMPAIGN_ID) {
      return DEFAULT_SLIDES;
    }
    return matching;
  }, [slides, slideFilterCampaign]);

  const openNewSlideModal = () => {
    setEditingSlide(null);
    setSlideTitle('');
    setSlideDesc('');
    setSlideSection('VIDONDA_VYA_TUMBO');
    setSlideImageUrl(ASSETS.stomachUlcer);
    setSlideActive(true);
    setModalError('');
    setModalSuccess('');
    setSlideModalOpen(true);
  };

  const openEditSlideModal = (slide: EducationalSlide) => {
    setEditingSlide(slide);
    setSlideTitle(slide.title);
    setSlideDesc(slide.description);
    setSlideSection(slide.section);
    setSlideImageUrl(slide.imageUrl || ASSETS.stomachUlcer);
    setSlideActive(slide.isActive);
    setModalError('');
    setModalSuccess('');
    setSlideModalOpen(true);
  };

  const handleUploadSlideImg = async (file: File) => {
    setUploadingFile(true);
    setModalError('');
    setModalSuccess('');
    try {
      const url = await uploadImageFile(file);
      setSlideImageUrl(url);
      setModalSuccess('Picha ya slaidi imepakiwa. Bofya "Hifadhi Slaidi" kumalizia.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Imeshindwa kupakia picha ya slaidi.';
      setModalError(msg);
      setAuthError(msg);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSelectExistingSlideInModal = (slideId: string) => {
    if (!slideId) {
      setEditingSlide(null);
      setSlideTitle('');
      setSlideDesc('');
      setSlideSection('VIDONDA_VYA_TUMBO');
      setSlideImageUrl(ASSETS.stomachUlcer);
      setSlideActive(true);
      return;
    }
    const found = filteredSlides.find((s) => s.id === slideId);
    if (found) {
      setEditingSlide(found);
      setSlideTitle(found.title);
      setSlideDesc(found.description);
      setSlideSection(found.section);
      setSlideImageUrl(found.imageUrl || ASSETS.stomachUlcer);
      setSlideActive(found.isActive);
    }
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    const nextOrder = editingSlide ? editingSlide.order : filteredSlides.length + 1;
    const sectionLabel =
      slideSection === 'ACID_REFLUX'
        ? 'Acid Reflux'
        : slideSection === 'JUMLA'
          ? 'Elimu ya Afya'
          : 'Vidonda vya Tumbo';
    const finalTitle = slideTitle.trim() || `${sectionLabel} — Kielelezo #${nextOrder}`;
    const finalDesc =
      slideDesc.trim() ||
      `Kielelezo cha elimu kuhusu ${sectionLabel.toLowerCase()} kwa ajili ya uelewa wa mfumo wa chakula.`;

    setSavingModal(true);
    try {
      await saveSlideRecord(
        {
          campaignId: slideFilterCampaign,
          section: slideSection,
          order: nextOrder,
          title: finalTitle,
          description: finalDesc,
          imageUrl: slideImageUrl.trim(),
          illustrationKey: editingSlide?.illustrationKey || 'custom',
          isActive: slideActive,
        },
        editingSlide?.id
      );
      setSlideModalOpen(false);
      await refreshData();
      notify('Slaidi imehifadhiwa.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Imeshindwa kuhifadhi slaidi.';
      setModalError(msg);
      setAuthError(msg);
    } finally {
      setSavingModal(false);
    }
  };

  const handleMoveSlide = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= filteredSlides.length) return;
    const copy = [...filteredSlides];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    try {
      await reorderSlideRecords(copy);
      await refreshData();
      notify('Mpangilio wa slaidi umesasishwa.');
    } catch (err) {
      alertPlaceholderError(err);
    }
  };

  const handleDeleteSlide = async (slide: EducationalSlide) => {
    try {
      await deleteSlideRecord(slide.id);
      await refreshData();
      notify('Slaidi imefutwa.');
    } catch (err) {
      alertPlaceholderError(err);
    }
  };

  const handleQuickSlideImageUpload = async (slide: EducationalSlide, file: File) => {
    setUploadingSlideId(slide.id);
    setAuthError('');
    try {
      const url = await uploadImageFile(file);
      await saveSlideRecord(
        {
          campaignId: slide.campaignId,
          section: slide.section,
          order: slide.order,
          title: slide.title,
          description: slide.description,
          imageUrl: url,
          illustrationKey: slide.illustrationKey || 'custom',
          isActive: slide.isActive,
        },
        slide.id
      );
      await refreshData();
      notify(`Picha ya "${slide.title}" imebadilishwa.`);
    } catch (err) {
      alertPlaceholderError(err);
    } finally {
      setUploadingSlideId(null);
    }
  };

  // ---------------- SETTINGS & BRANDING HANDLERS ----------------
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await savePublicSettingsRecord(settings);
      await refreshData();
      notify('Mipangilio imehifadhiwa.');
    } catch (err) {
      alertPlaceholderError(err);
    }
  };

  const handleUploadBrandAsset = async (kind: 'logo' | 'welcome', file: File) => {
    if (!settings) return;
    setUploadingBranding(kind);
    setAuthError('');
    try {
      const url = await uploadImageFile(file);
      const updated: PublicSettings =
        kind === 'logo'
          ? { ...settings, logoUrl: url }
          : { ...settings, welcomeImageUrl: url };
      await savePublicSettingsRecord(updated);
      setSettings(updated);
      await refreshData();
      notify(kind === 'logo' ? 'Logo imepakiwa na kuhifadhiwa.' : 'Picha ya karibu imepakiwa na kuhifadhiwa.');
    } catch (err) {
      alertPlaceholderError(err);
    } finally {
      setUploadingBranding(null);
    }
  };

  const handleRemoveLogo = async () => {
    if (!settings) return;
    const updated: PublicSettings = { ...settings, logoUrl: '' };
    try {
      await savePublicSettingsRecord(updated);
      setSettings(updated);
      await refreshData();
      notify('Logo imeondolewa.');
    } catch (err) {
      alertPlaceholderError(err);
    }
  };

  const handleResetWelcomeImage = async () => {
    if (!settings) return;
    const updated: PublicSettings = { ...settings, welcomeImageUrl: ASSETS.welcome };
    try {
      await savePublicSettingsRecord(updated);
      setSettings(updated);
      await refreshData();
      notify('Picha ya awali imerudishwa.');
    } catch (err) {
      alertPlaceholderError(err);
    }
  };

  // ---------------- LEADS FILTERING ----------------
  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    const now = Date.now();
    return leads
      .filter((l) => {
        if (leadFilterCampaign !== 'all' && l.campaignId !== leadFilterCampaign) return false;
        if (leadFilterStage === 'assessment_done' && !l.assessmentCompleted) return false;
        if (leadFilterStage === 'contact_downloaded' && !l.contactDownloaded) return false;
        if (leadFilterStage === 'contact_confirmed' && !l.contactConfirmed) return false;
        if (leadFilterStage === 'community_confirmed' && !l.communityConfirmed) return false;
        if (leadFilterStage === 'ebook_unlocked' && !l.ebookUnlocked) return false;

        if (leadFilterDate !== 'all') {
          const ms = getTimestampMillis(l.createdAt);
          if (leadFilterDate === 'today') {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            if (ms < start.getTime()) return false;
          } else if (leadFilterDate === '7d' && now - ms > 7 * 86400000) {
            return false;
          } else if (leadFilterDate === '30d' && now - ms > 30 * 86400000) {
            return false;
          }
        }

        if (q) {
          const hay = `${l.fullName} ${l.phone} ${l.location || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
  }, [leads, leadSearch, leadFilterCampaign, leadFilterDate, leadFilterStage]);

  const selectedLeadAssessment = useMemo(() => {
    if (!selectedLead) return null;
    return assessments.find((a) => a.leadId === selectedLead.sessionId) || null;
  }, [selectedLead, assessments]);

  // ---------------- PASSCODE & AUTH GATE VIEWS ----------------
  if (!passcodeStatusChecked) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-2 border-[#E2E9E4] border-t-[#15623E] animate-spin" />
      </div>
    );
  }

  if (!gateToken) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6">
        <form
          onSubmit={handlePasscodeSubmit}
          className="max-w-md w-full rounded-3xl border border-[#E2E9E4] bg-white p-8 space-y-5"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#EBF4EE] text-[#15623E] flex items-center justify-center">
            {needsPasscodeSetup ? <KeyRound className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>

          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-[#13221B]">
              {needsPasscodeSetup ? 'Weka Msimbo wa Siri' : 'Ingiza Msimbo wa Siri'}
            </h1>
            <p className="text-sm text-[#4A5D54] leading-relaxed">
              {needsPasscodeSetup
                ? 'Tengeneza namba au neno la siri (angalau herufi 4) ili kulinda eneo hili.'
                : 'Sehemu hii imefungwa kwa msimbo wa siri. Weka msimbo kuendelea.'}
            </p>
          </div>

          {passcodeError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800">
              {passcodeError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">Msimbo wa Siri</label>
              <input
                type="password"
                required
                minLength={4}
                autoFocus
                placeholder="••••••"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E2E9E4] text-sm font-mono tracking-widest focus:outline-none focus:border-[#15623E]"
              />
            </div>

            {needsPasscodeSetup && (
              <div>
                <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                  Thibitisha Msimbo wa Siri
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  placeholder="••••••"
                  value={passcodeConfirmInput}
                  onChange={(e) => setPasscodeConfirmInput(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E2E9E4] text-sm font-mono tracking-widest focus:outline-none focus:border-[#15623E]"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={verifyingPasscode}
            className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-[#15623E] hover:bg-[#114F32] disabled:opacity-60 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>
              {verifyingPasscode
                ? 'Inathibitisha...'
                : needsPasscodeSetup
                  ? 'Hifadhi Msimbo na Endelea'
                  : 'Fungua'}
            </span>
          </button>

          <button
            type="button"
            onClick={onBackToFunnel}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E2E9E4] text-sm font-medium text-[#4A5D54] hover:text-[#13221B] flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Rudi Nyumbani</span>
          </button>
        </form>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-2 border-[#E2E9E4] border-t-[#15623E] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-[#E2E9E4] bg-white p-8 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#15623E]">JOS HEALTH KNOWLEDGE HUB</p>
            <h1 className="font-display text-2xl font-bold text-[#13221B]">
              Thibitisha Akaunti ya Msimamizi
            </h1>
            <p className="text-sm text-[#4A5D54] leading-relaxed">
              Msimbo wa siri umekubaliwa. Sasa thibitisha na akaunti rasmi ya msimamizi pekee. Akaunti ya kawaida ya Google haitaweza kufungua dashibodi.
            </p>
          </div>

          {authError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Ingia kwa Akaunti ya Google</span>
          </button>

          <button
            type="button"
            onClick={onBackToFunnel}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E2E9E4] text-sm font-medium text-[#4A5D54] hover:text-[#13221B] flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Rudi Nyumbani</span>
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-[#E2E9E4] bg-white p-8 space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#13221B]">Ufikiaji Umezuiwa</h1>
          <p className="text-sm text-[#4A5D54]">
            Akaunti ya <strong>{user.email}</strong> haina ruhusa ya msimamizi. Wasomaji hawaruhusiwi kufungua sehemu hii hata kwa akaunti zao za Google.
          </p>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full min-h-[48px] rounded-xl bg-[#13221B] text-white text-sm font-medium cursor-pointer"
            >
              Ondoka Kwenye Akaunti Hii
            </button>
            <button
              type="button"
              onClick={onBackToFunnel}
              className="w-full min-h-[44px] rounded-xl border border-[#E2E9E4] text-sm text-[#4A5D54] cursor-pointer"
            >
              Rudi Nyumbani
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: { id: AdminTab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'overview', label: 'Muhtasari', icon: BarChart3 },
    { id: 'branding', label: 'Logo & Picha', icon: ImageIcon },
    { id: 'ebooks', label: 'eBooks (PDF)', icon: BookOpen },
    { id: 'campaigns', label: 'Kampeni', icon: Megaphone },
    { id: 'slides', label: 'Slaidi za Elimu', icon: Layers },
    { id: 'leads', label: 'Wateja / Leads', icon: Users },
    { id: 'contact', label: 'Mawasiliano', icon: Phone },
    { id: 'community', label: 'Jamii & Pixel', icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#13221B] flex flex-col lg:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-[#E2E9E4]">
        <div className="px-6 py-5 border-b border-[#E2E9E4] flex items-center gap-3">
          {settings?.logoUrl && (
            <img
              src={settings.logoUrl}
              alt="Logo"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-contain border border-[#E2E9E4] shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-[#13221B] truncate">JOS HEALTH HUB</p>
            <p className="text-xs text-[#6E7F76] mt-0.5 truncate">{user.email}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#EBF4EE] text-[#15623E]'
                    : 'text-[#4A5D54] hover:bg-[#F8FAF9] hover:text-[#13221B]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E2E9E4] space-y-1.5">
          <button
            type="button"
            onClick={onBackToFunnel}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-xs font-medium text-[#13221B] hover:bg-[#F8FAF9] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Fungua Funnel ya Mgeni</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium text-[#6E7F76] hover:text-red-700 hover:bg-red-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Ondoka</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E2E9E4] px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Fungua menyu"
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-[#13221B] hover:bg-[#F3F7F4] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display font-bold text-base sm:text-lg text-[#13221B] truncate">
              {navItems.find((n) => n.id === tab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => refreshData(false)}
              disabled={loadingData}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E2E9E4] hover:bg-[#F8FAF9] text-xs font-medium text-[#13221B] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Onyesha Upya</span>
            </button>
            <button
              type="button"
              onClick={onBackToFunnel}
              className="lg:hidden min-h-[40px] px-3 py-1.5 rounded-xl bg-[#15623E] text-white text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              Tazama Funnel
            </button>
          </div>
        </header>

        {/* Sticky Notifications / Errors so mobile users see feedback while scrolled */}
        {(statusMessage || authError) && (
          <div className="sticky top-14 z-20 px-4 sm:px-6 pt-3 space-y-2 pointer-events-none">
            {statusMessage && (
              <div className="pointer-events-auto rounded-xl bg-[#EBF4EE] border border-[#C6E0CE] px-4 py-3 text-sm text-[#15623E] flex items-center justify-between shadow-sm">
                <span>{statusMessage}</span>
                <button type="button" onClick={() => setStatusMessage('')} className="cursor-pointer p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {authError && (
              <div className="pointer-events-auto rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex items-center justify-between shadow-sm">
                <span>{authError}</span>
                <button type="button" onClick={() => setAuthError('')} className="cursor-pointer p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* ==================== TAB A: OVERVIEW & FUNNEL ==================== */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Jumla ya Wageni', value: overviewStats.visitors },
                  { label: 'Waliomaliza Maswali', value: overviewStats.assessmentsDone },
                  { label: 'Waliopakua Mawasiliano', value: overviewStats.contactDownloaded },
                  { label: 'Waliojithibitisha Namba', value: overviewStats.contactConfirmed },
                  { label: 'Waliojiunga WhatsApp', value: overviewStats.communityConfirmed },
                  { label: 'eBook Zilizofunguliwa', value: overviewStats.ebookUnlocked },
                  { label: 'PDF Zilizopakuliwa', value: overviewStats.ebookDownloaded },
                  { label: 'Ukamilishaji wa Funnel', value: `${overviewStats.completionPct}%` },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-2xl border border-[#E2E9E4] bg-white p-4 sm:p-5"
                  >
                    <p className="text-xs text-[#6E7F76] mb-1.5">{kpi.label}</p>
                    <p className="font-display text-2xl sm:text-3xl font-bold text-[#13221B] tabular-nums">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* 13-Event Funnel Breakdown */}
              <div className="rounded-2xl border border-[#E2E9E4] bg-white p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display font-semibold text-base text-[#13221B]">
                      Mtiririko wa Hatua Zote 13 za Funnel
                    </h2>
                    <p className="text-xs text-[#6E7F76]">
                      Idadi ya wageni wa kipekee waliokamilisha kila tukio la mfumo.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-[#E2E9E4]">
                  {FUNNEL_STAGE_ORDER.map((stage) => {
                    const count = funnelCounts.get(stage.key)?.size || 0;
                    const base = Math.max(1, overviewStats.visitors);
                    const pct = Math.min(100, Math.round((count / base) * 100));
                    return (
                      <div key={stage.key} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="sm:w-72 text-xs sm:text-sm font-medium text-[#13221B]">
                          {stage.label}
                        </div>
                        <div className="flex-1 h-2.5 rounded-full bg-[#F3F7F4] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#15623E]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="w-24 text-right text-xs sm:text-sm font-mono tabular-nums text-[#4A5D54]">
                          {count} ({overviewStats.visitors > 0 ? `${pct}%` : '0%'})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB B: EBOOK MANAGEMENT ==================== */}
          {tab === 'ebooks' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold text-lg text-[#13221B]">
                    Maktaba ya Vitabu (eBooks)
                  </h2>
                  <p className="text-xs sm:text-sm text-[#6E7F76]">
                    Pakia PDF nyingi kadri unavyohitaji na uchague ipi itumike kwenye kila kampeni.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewEbookModal}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Pakia eBook Mpya</span>
                </button>
              </div>

              {ebooks.length === 0 ? (
                <div className="rounded-2xl border border-[#E2E9E4] bg-white p-10 text-center space-y-3">
                  <p className="text-sm text-[#4A5D54]">Hakuna eBook iliyopakiwa bado.</p>
                  <button
                    type="button"
                    onClick={openNewEbookModal}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#15623E] text-white text-sm font-medium cursor-pointer"
                  >
                    Pakia eBook ya Kwanza
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ebooks.map((book) => {
                    const st = ebookStatsMap.get(book.id) || {
                      unlocks: 0,
                      opens: 0,
                      downloads: 0,
                    };
                    return (
                      <div
                        key={book.id}
                        className="rounded-2xl border border-[#E2E9E4] bg-white p-5 flex gap-4"
                      >
                        <img
                          src={book.coverUrl || ASSETS.ebookCover}
                          alt={book.title}
                          referrerPolicy="no-referrer"
                          className="w-20 h-auto max-h-28 self-start rounded-xl object-cover border border-[#E2E9E4] shrink-0 bg-white"
                        />

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs text-[#6E7F76] truncate">
                                {book.category} · {book.isActive ? 'Inatumika' : 'Imezimwa'}
                              </p>
                              <h3 className="font-display font-semibold text-base text-[#13221B] truncate">
                                {book.title}
                              </h3>
                            </div>
                          </div>

                          <p className="text-xs text-[#4A5D54] line-clamp-2">
                            {book.description || book.fileName}
                          </p>

                          <div className="text-xs text-[#6E7F76] tabular-nums">
                            Zilizofunguliwa: {st.unlocks} · Zilizosomwa: {st.opens} · Zilizopakuliwa:{' '}
                            {st.downloads}
                          </div>

                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewPdfBook(book)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E2E9E4] hover:bg-[#F8FAF9] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Hakiki</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditEbookModal(book)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E2E9E4] hover:bg-[#F8FAF9] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Hariri / Badili PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleEbookActive(book)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E2E9E4] hover:bg-[#F8FAF9] text-xs font-medium cursor-pointer"
                            >
                              {book.isActive ? 'Zima' : 'Washa'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEbook(book)}
                              aria-label="Futa eBook"
                              className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB C: CAMPAIGN MANAGEMENT ==================== */}
          {tab === 'campaigns' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold text-lg text-[#13221B]">
                    Kampeni za Elimu
                  </h2>
                  <p className="text-xs sm:text-sm text-[#6E7F76]">
                    Unganisha kila kampeni na eBook yake maalum bila kubadilisha msimbo wa mfumo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewCampaignModal}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Kampeni Mpya</span>
                </button>
              </div>

              <div className="space-y-3">
                {campaigns.map((camp) => {
                  const book = ebooks.find((b) => b.id === camp.assignedEbookId);
                  const campLeads = leads.filter((l) => l.campaignId === camp.id).length;
                  const campUnlocks = leads.filter(
                    (l) => l.campaignId === camp.id && l.ebookUnlocked
                  ).length;

                  return (
                    <div
                      key={camp.id}
                      className="rounded-2xl border border-[#E2E9E4] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="text-xs text-[#6E7F76] tabular-nums">
                          {camp.isActive ? 'Inafanya kazi' : 'Imezimwa'}
                          {camp.isDefault ? ' · Kampeni Kuu' : ''} · Leads: {campLeads} · eBook
                          Unlocked: {campUnlocks}
                        </div>
                        <h3 className="font-display font-bold text-base text-[#13221B]">
                          {camp.name}
                        </h3>
                        <p className="text-sm text-[#4A5D54]">{camp.topic}</p>
                        <p className="text-xs text-[#15623E] font-medium">
                          eBook Iliyopangiwa: {book ? book.title : 'Haijachaguliwa'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditCampaignModal(camp)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] hover:bg-[#F8FAF9] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Hariri</span>
                        </button>
                        {!camp.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCampaign(camp)}
                            className="min-h-[40px] px-3 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== TAB D: EDUCATION SLIDES MANAGEMENT ==================== */}
          {tab === 'slides' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#C6E0CE] bg-[#F4FAF6] p-4 text-xs sm:text-sm text-[#13221B] leading-relaxed">
                <span className="font-semibold text-[#15623E]">Maelezo tayari yapo hapa chini:</span>{' '}
                Soma kichwa na maelezo ya kila slaidi ili usikosee picha, kisha bofya{' '}
                <span className="font-semibold">Pakia / Badili Picha</span> kuweka picha yake ya rangi moja kwa moja bila kujaza maelezo upya.
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={slideFilterCampaign}
                    onChange={(e) => setSlideFilterCampaign(e.target.value)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] bg-white text-sm font-medium text-[#13221B]"
                  >
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={openNewSlideModal}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ongeza Slaidi Mpya</span>
                </button>
              </div>

              <div className="space-y-3">
                {filteredSlides.map((slide, idx) => (
                  <div
                    key={slide.id}
                    className="rounded-2xl border border-[#E2E9E4] bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4"
                  >
                    <img
                      src={slide.imageUrl || ASSETS.stomachUlcer}
                      alt={slide.title}
                      referrerPolicy="no-referrer"
                      className="w-full sm:w-32 h-auto max-h-40 rounded-xl object-cover border border-[#E2E9E4] bg-white shrink-0"
                    />

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-xs font-medium text-[#15623E] tabular-nums">
                        Slaidi #{idx + 1} · {slide.section === 'ACID_REFLUX' ? 'Acid Reflux' : slide.section === 'VIDONDA_VYA_TUMBO' ? 'Vidonda vya Tumbo' : 'Elimu ya Jumla'} · {slide.isActive ? 'Inaonekana' : 'Imefichwa'}
                      </p>
                      <h3 className="font-display font-semibold text-base text-[#13221B]">
                        {slide.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#4A5D54] leading-relaxed">
                        {slide.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <label className="relative overflow-hidden min-h-[40px] px-3.5 py-2 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {uploadingSlideId === slide.id ? 'Inapakia...' : 'Pakia / Badili Picha'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={uploadingSlideId === slide.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleQuickSlideImageUpload(slide, f);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveSlide(idx, -1)}
                        aria-label="Sogeza juu"
                        className="min-h-[40px] min-w-[40px] rounded-xl border border-[#E2E9E4] hover:bg-[#F8FAF9] disabled:opacity-35 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === filteredSlides.length - 1}
                        onClick={() => handleMoveSlide(idx, 1)}
                        aria-label="Sogeza chini"
                        className="min-h-[40px] min-w-[40px] rounded-xl border border-[#E2E9E4] hover:bg-[#F8FAF9] disabled:opacity-35 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditSlideModal(slide)}
                        className="min-h-[40px] px-3 py-2 rounded-xl border border-[#E2E9E4] hover:bg-[#F8FAF9] text-xs font-medium cursor-pointer"
                      >
                        Hariri Maandishi
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide)}
                        aria-label="Futa slaidi"
                        className="min-h-[40px] px-2.5 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== TAB E: CONTACT SETTINGS ==================== */}
          {tab === 'contact' && settings && (
            <form
              onSubmit={handleSaveSettings}
              className="max-w-2xl rounded-2xl border border-[#E2E9E4] bg-white p-6 space-y-4"
            >
              <h2 className="font-display font-semibold text-lg text-[#13221B]">
                Mipangilio ya Kadi ya Mawasiliano (VCF)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Jina Kwenye Kadi ya Simu
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.contactName}
                    onChange={(e) => setSettings({ ...settings, contactName: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Taasisi / Brand
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.contactOrganization}
                    onChange={(e) =>
                      setSettings({ ...settings, contactOrganization: e.target.value })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Namba ya Simu (Ndani)
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.contactPhone}
                    onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Muundo wa Kimataifa
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.contactPhoneIntl}
                    onChange={(e) =>
                      setSettings({ ...settings, contactPhoneIntl: e.target.value })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Namba ya WhatsApp
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.whatsappNumber}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Maelezo mafupi ya Kadi
                  </label>
                  <input
                    type="text"
                    value={settings.contactNote || ''}
                    onChange={(e) => setSettings({ ...settings, contactNote: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-sm font-semibold cursor-pointer"
                >
                  Hifadhi Mipangilio ya Mawasiliano
                </button>
              </div>
            </form>
          )}

          {/* ==================== TAB B0: LOGO & PICHA (BRANDING) ==================== */}
          {tab === 'branding' && settings && (
            <div className="space-y-6 max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Card */}
                <div className="rounded-2xl border border-[#E2E9E4] bg-white p-6 space-y-4">
                  <div>
                    <h2 className="font-display font-semibold text-base text-[#13221B]">
                      Logo ya Brand
                    </h2>
                    <p className="text-xs text-[#6E7F76] mt-1">
                      Itaonekana juu kwenye kichwa cha ukurasa wa wageni na katika dashibodi.
                    </p>
                  </div>

                  <div className="h-32 rounded-2xl border border-[#E2E9E4] bg-[#F8FAF9] flex items-center justify-center p-4 overflow-hidden">
                    {settings.logoUrl ? (
                      <img
                        src={settings.logoUrl}
                        alt="Logo ya sasa"
                        referrerPolicy="no-referrer"
                        className="max-h-24 max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center space-y-1 text-[#6E7F76]">
                        <ImageIcon className="w-7 h-7 mx-auto opacity-60" />
                        <p className="text-xs">Hakuna logo iliyopakiwa bado</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="relative overflow-hidden min-h-[44px] px-4 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>
                        {uploadingBranding === 'logo'
                          ? 'Inapakia Logo...'
                          : settings.logoUrl
                            ? 'Badili Logo'
                            : 'Pakia Logo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploadingBranding === 'logo'}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadBrandAsset('logo', f);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>

                    {settings.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="min-h-[44px] px-4 py-2.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Ondoa Logo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Welcome Image Card */}
                <div className="rounded-2xl border border-[#E2E9E4] bg-white p-6 space-y-4">
                  <div>
                    <h2 className="font-display font-semibold text-base text-[#13221B]">
                      Picha ya Ukurasa wa Kwanza (Karibu)
                    </h2>
                    <p className="text-xs text-[#6E7F76] mt-1">
                      Pakia picha ya rangi unayoipenda kuonekana kwenye Hatua ya 1.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#E2E9E4] bg-white overflow-hidden">
                    <img
                      src={settings.welcomeImageUrl || ASSETS.welcome}
                      alt="Picha ya Karibu"
                      referrerPolicy="no-referrer"
                      className="w-full h-auto max-h-[380px] object-cover block"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="relative overflow-hidden min-h-[44px] px-4 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>
                        {uploadingBranding === 'welcome' ? 'Inapakia Picha...' : 'Pakia Picha ya Rangi'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploadingBranding === 'welcome'}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadBrandAsset('welcome', f);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleResetWelcomeImage}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E9E4] hover:bg-[#F8FAF9] text-xs sm:text-sm font-medium text-[#4A5D54] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Rudisha ya Awali</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Front Educational Slides Image Uploader right inside Logo & Picha */}
              <div className="rounded-2xl border border-[#E2E9E4] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-base text-[#13221B]">
                      Picha za Slaidi za Mbele (Hatua ya 2)
                    </h2>
                    <p className="text-xs text-[#6E7F76]">
                      Pakia picha za rangi moja kwa moja kwa kila slaidi ya elimu inayowatokea wageni.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('slides')}
                    className="min-h-[40px] px-4 py-2 rounded-xl border border-[#15623E] text-[#15623E] hover:bg-[#EBF4EE] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Hariri Maandishi ya Slaidi</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSlides.map((slide, idx) => (
                    <div
                      key={slide.id}
                      className="rounded-2xl border border-[#E2E9E4] bg-[#F8FAF9] p-3.5 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2.5">
                        <div className="rounded-xl overflow-hidden border border-[#E2E9E4] bg-white">
                          <img
                            src={slide.imageUrl || ASSETS.stomachUlcer}
                            alt={slide.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-auto max-h-56 object-cover block"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-medium text-[#15623E] tabular-nums">
                            Slaidi #{idx + 1} · {slide.section === 'ACID_REFLUX' ? 'Acid Reflux' : slide.section === 'VIDONDA_VYA_TUMBO' ? 'Vidonda vya Tumbo' : 'Elimu ya Jumla'}
                          </p>
                          <h3 className="font-display font-semibold text-sm text-[#13221B]">
                            {slide.title}
                          </h3>
                          <p className="text-xs text-[#4A5D54] leading-relaxed">
                            {slide.description}
                          </p>
                        </div>
                      </div>

                      <label className="relative overflow-hidden min-h-[40px] px-3 py-2 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {uploadingSlideId === slide.id ? 'Inapakia...' : 'Pakia / Badili Picha'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={uploadingSlideId === slide.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleQuickSlideImageUpload(slide, f);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand Titles */}
              <form
                onSubmit={handleSaveSettings}
                className="rounded-2xl border border-[#E2E9E4] bg-white p-6 space-y-4"
              >
                <div>
                  <h2 className="font-display font-semibold text-base text-[#13221B]">
                    Majina ya Brand
                  </h2>
                  <p className="text-xs text-[#6E7F76]">
                    Hariri jina la mfumo na mwasilishaji linaloonekana kwa wageni.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                      Jina la Mfumo (Brand)
                    </label>
                    <input
                      type="text"
                      required
                      value={settings.brandName}
                      onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                      Mwasilishaji (Presenter)
                    </label>
                    <input
                      type="text"
                      required
                      value={settings.presenterName}
                      onChange={(e) => setSettings({ ...settings, presenterName: e.target.value })}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-sm font-semibold cursor-pointer"
                >
                  Hifadhi Majina ya Brand
                </button>
              </form>
            </div>
          )}

          {/* ==================== TAB F: COMMUNITY & PIXEL SETTINGS ==================== */}
          {tab === 'community' && settings && (
            <div className="space-y-6 max-w-2xl">
              <form
                onSubmit={handleSaveSettings}
                className="rounded-2xl border border-[#E2E9E4] bg-white p-6 space-y-4"
              >
                <h2 className="font-display font-semibold text-lg text-[#13221B]">
                  Mipangilio ya WhatsApp Community & Meta Pixel
                </h2>

                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Jina la Community
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.communityName}
                    onChange={(e) => setSettings({ ...settings, communityName: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Ujumbe wa Mwaliko
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={settings.communityMessage}
                    onChange={(e) => setSettings({ ...settings, communityMessage: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E9E4] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Kiungo cha WhatsApp Community / Group
                  </label>
                  <input
                    type="url"
                    required
                    value={settings.whatsappCommunityLink}
                    onChange={(e) =>
                      setSettings({ ...settings, whatsappCommunityLink: e.target.value })
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                    Meta Pixel ID (Hiari)
                  </label>
                  <input
                    type="text"
                    placeholder="Mfano: 123456789012345"
                    value={settings.metaPixelId || ''}
                    onChange={(e) => setSettings({ ...settings, metaPixelId: e.target.value })}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm font-mono"
                  />
                  <p className="text-xs text-[#6E7F76] mt-1">
                    Taarifa na matukio yote ya wageni huhifadhiwa na kufuatiliwa moja kwa moja bila kumwonyesha mgeni kizuizi cha Pixel.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-sm font-semibold cursor-pointer"
                  >
                    Hifadhi Mipangilio
                  </button>
                </div>
              </form>

              {/* Change Secret Passcode */}
              <div className="rounded-2xl border border-[#E2E9E4] bg-white p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#15623E]" />
                  <h3 className="font-display font-semibold text-base text-[#13221B]">
                    Usalama: Msimbo wa Siri wa Dashibodi
                  </h3>
                </div>

                {envControlledPasscode ? (
                  <p className="text-xs text-[#4A5D54] leading-relaxed">
                    Msimbo wa siri kwa sasa unadhibitiwa kupitia variable ya mazingira{' '}
                    <code className="font-mono text-[#13221B]">ADMIN_PASSCODE</code> kwenye mipangilio ya seva.
                  </p>
                ) : (
                  <form onSubmit={handleChangePasscodeSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                          Msimbo Mpya wa Siri
                        </label>
                        <input
                          type="password"
                          minLength={4}
                          required
                          placeholder="Angalau herufi 4"
                          value={newPasscode}
                          onChange={(e) => setNewPasscode(e.target.value)}
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                          Thibitisha Msimbo Mpya
                        </label>
                        <input
                          type="password"
                          minLength={4}
                          required
                          placeholder="Rudia msimbo mpya"
                          value={confirmNewPasscode}
                          onChange={(e) => setConfirmNewPasscode(e.target.value)}
                          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={changingPasscode}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-[#13221B] hover:bg-[#1F352B] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                    >
                      {changingPasscode ? 'Inabadilisha...' : 'Badili Msimbo wa Siri'}
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-2xl border border-[#E2E9E4] bg-white p-6 space-y-2 text-xs text-[#4A5D54]">
                <h3 className="font-display font-semibold text-sm text-[#13221B]">
                  Taarifa za Muunganisho wa Firebase
                </h3>
                <p>
                  Project ID: <span className="font-mono text-[#13221B]">{FIREBASE_PROJECT_ID}</span>
                </p>
                <p>
                  Storage Bucket:{' '}
                  <span className="font-mono text-[#13221B]">{FIREBASE_STORAGE_BUCKET}</span>
                </p>
              </div>
            </div>
          )}

          {/* ==================== TAB G: LEAD MANAGEMENT ==================== */}
          {tab === 'leads' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <div className="relative min-w-[220px] flex-1 max-w-xs">
                    <Search className="w-4 h-4 text-[#6E7F76] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      placeholder="Tafuta jina, simu au eneo..."
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-[#E2E9E4] bg-white text-sm"
                    />
                  </div>

                  <select
                    value={leadFilterCampaign}
                    onChange={(e) => setLeadFilterCampaign(e.target.value)}
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E2E9E4] bg-white text-xs sm:text-sm"
                  >
                    <option value="all">Kampeni Zote</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={leadFilterDate}
                    onChange={(e) => setLeadFilterDate(e.target.value)}
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E2E9E4] bg-white text-xs sm:text-sm"
                  >
                    <option value="all">Muda Wote</option>
                    <option value="today">Leo</option>
                    <option value="7d">Siku 7 zilizopita</option>
                    <option value="30d">Siku 30 zilizopita</option>
                  </select>

                  <select
                    value={leadFilterStage}
                    onChange={(e) => setLeadFilterStage(e.target.value)}
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E2E9E4] bg-white text-xs sm:text-sm"
                  >
                    <option value="all">Hatua Zote</option>
                    <option value="assessment_done">Waliomaliza Maswali</option>
                    <option value="contact_downloaded">Waliopakua VCF</option>
                    <option value="contact_confirmed">Waliothibitisha Namba</option>
                    <option value="community_confirmed">Waliojiunga Community</option>
                    <option value="ebook_unlocked">Waliofungua eBook</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => exportLeadsToCsv(filteredLeads, campaigns)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#13221B] hover:bg-[#1F352B] text-white text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Pakua CSV ({filteredLeads.length})</span>
                </button>
              </div>

              <div className="rounded-2xl border border-[#E2E9E4] bg-white overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E9E4] text-xs font-semibold text-[#6E7F76] bg-[#F8FAF9]">
                      <th className="py-3 px-4">Jina & Eneo</th>
                      <th className="py-3 px-4">Simu</th>
                      <th className="py-3 px-4">Hatua</th>
                      <th className="py-3 px-4">Mawasiliano</th>
                      <th className="py-3 px-4">WhatsApp</th>
                      <th className="py-3 px-4">eBook</th>
                      <th className="py-3 px-4">Tarehe</th>
                      <th className="py-3 px-4 text-right">Majibu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E9E4] text-sm">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-[#6E7F76]">
                          Hakuna taarifa za wateja zinazolingana na vichujio vyako.
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-[#F8FAF9]">
                          <td className="py-3 px-4">
                            <div className="font-medium text-[#13221B]">{l.fullName}</div>
                            <div className="text-xs text-[#6E7F76]">{l.location || '—'}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs tabular-nums">{l.phone}</td>
                          <td className="py-3 px-4 font-mono text-xs tabular-nums">
                            {l.currentStep} / 6
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {l.contactConfirmed
                              ? 'Amethibitisha'
                              : l.contactDownloaded
                                ? 'Amepakua VCF'
                                : 'Bado'}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {l.communityConfirmed
                              ? 'Amethibitisha'
                              : l.whatsappClicked
                                ? 'Alibofya Kiungo'
                                : 'Bado'}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {l.ebookDownloaded
                              ? 'Amepakua'
                              : l.ebookOpened
                                ? 'Amesoma'
                                : l.ebookUnlocked
                                  ? 'Imefunguliwa'
                                  : 'Bado'}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#6E7F76] tabular-nums whitespace-nowrap">
                            {formatFirestoreDate(l.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedLead(l)}
                              className="px-3 py-1.5 rounded-lg border border-[#E2E9E4] hover:bg-white text-xs font-medium text-[#15623E] cursor-pointer"
                            >
                              Tazama
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full p-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E9E4]">
                <span className="font-display font-bold text-sm">JOS HEALTH HUB</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium flex items-center gap-3 ${
                        tab === item.id ? 'bg-[#EBF4EE] text-[#15623E]' : 'text-[#4A5D54]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm text-red-700 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Ondoka</span>
            </button>
          </div>
        </div>
      )}

      {/* EBOOK CREATE/EDIT MODAL */}
      {ebookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEbook}
            className="bg-white rounded-3xl border border-[#E2E9E4] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">
                {editingEbook ? 'Hariri eBook' : 'Pakia eBook Mpya'}
              </h3>
              <button type="button" onClick={() => setEbookModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800">
                {modalError}
              </div>
            )}
            {modalSuccess && (
              <div className="rounded-xl bg-[#EBF4EE] border border-[#C6E0CE] px-3.5 py-2.5 text-xs text-[#15623E]">
                {modalSuccess}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">Kichwa cha eBook *</label>
              <input
                type="text"
                required
                value={ebookTitle}
                onChange={(e) => setEbookTitle(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">Kategoria</label>
              <input
                type="text"
                required
                value={ebookCategory}
                onChange={(e) => setEbookCategory(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">Maelezo</label>
              <textarea
                rows={3}
                value={ebookDesc}
                onChange={(e) => setEbookDesc(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                Faili la PDF * {ebookFileName && `(${ebookFileName})`}
              </label>
              <label className="relative overflow-hidden min-h-[44px] px-4 py-2.5 rounded-xl border border-dashed border-[#15623E] bg-[#F8FAF9] text-sm text-[#15623E] font-medium flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{uploadingFile ? 'Inapakia...' : ebookPdfUrl ? 'Badili Faili la PDF' : 'Chagua Faili la PDF'}</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf,*/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadEbookPdf(f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#4A5D54]">
                Picha ya Jalada (Hiari)
              </label>
              <div className="flex items-center gap-3">
                <img
                  src={ebookCoverUrl || ASSETS.ebookCover}
                  alt="Jalada"
                  referrerPolicy="no-referrer"
                  className="w-20 h-auto max-h-28 rounded-xl object-cover border border-[#E2E9E4] shrink-0 bg-white"
                />
                <label className="relative overflow-hidden flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E9E4] bg-white text-sm text-[#13221B] flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>{uploadingFile ? 'Inapakia...' : 'Pakia Picha ya Jalada'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadEbookCover(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={ebookActive}
                onChange={(e) => setEbookActive(e.target.checked)}
                className="w-4 h-4 accent-[#15623E]"
              />
              <span>Inatumika (Active)</span>
            </label>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEbookModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E2E9E4] text-sm cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="submit"
                disabled={uploadingFile || savingModal}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#15623E] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
              >
                {savingModal ? 'Inahifadhi...' : 'Hifadhi eBook'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CAMPAIGN MODAL */}
      {campModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCampaign}
            className="bg-white rounded-3xl border border-[#E2E9E4] w-full max-w-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">
                {editingCamp ? 'Hariri Kampeni' : 'Kampeni Mpya'}
              </h3>
              <button type="button" onClick={() => setCampModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">Jina la Kampeni *</label>
              <input
                type="text"
                required
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">Mada Kuu *</label>
              <input
                type="text"
                required
                value={campTopic}
                onChange={(e) => setCampTopic(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                Chagua eBook ya Kampeni Hii
              </label>
              <select
                value={campEbookId}
                onChange={(e) => setCampEbookId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] bg-white text-sm"
              >
                <option value="">-- Chagua eBook --</option>
                {ebooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} {b.isActive ? '' : '(Imezimwa)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={campActive}
                  onChange={(e) => setCampActive(e.target.checked)}
                  className="w-4 h-4 accent-[#15623E]"
                />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={campDefault}
                  onChange={(e) => setCampDefault(e.target.checked)}
                  className="w-4 h-4 accent-[#15623E]"
                />
                <span>Kampeni Kuu (Default)</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCampModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E2E9E4] text-sm cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#15623E] text-white text-sm font-semibold cursor-pointer"
              >
                Hifadhi Kampeni
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SLIDE MODAL */}
      {slideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSlide}
            className="bg-white rounded-3xl border border-[#E2E9E4] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">
                {editingSlide ? 'Hariri Slaidi' : 'Ongeza Slaidi Mpya'}
              </h3>
              <button type="button" onClick={() => setSlideModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800">
                {modalError}
              </div>
            )}
            {modalSuccess && (
              <div className="rounded-xl bg-[#EBF4EE] border border-[#C6E0CE] px-3.5 py-2.5 text-xs text-[#15623E]">
                {modalSuccess}
              </div>
            )}

            <div className="rounded-xl bg-[#F4FAF6] border border-[#C6E0CE] p-3 space-y-2">
              <label className="block text-xs font-semibold text-[#15623E]">
                Chagua Slaidi Iliyopo (Maelezo Yajae Automatic — Weka Picha Tu)
              </label>
              <select
                value={editingSlide?.id || ''}
                onChange={(e) => handleSelectExistingSlideInModal(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#C6E0CE] bg-white text-xs sm:text-sm text-[#13221B]"
              >
                <option value="">-- Unda Slaidi Mpya Kabisa --</option>
                {filteredSlides.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    #{i + 1}: {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">Sehemu</label>
              <select
                value={slideSection}
                onChange={(e) => setSlideSection(e.target.value as SlideSection)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] bg-white text-sm"
              >
                <option value="VIDONDA_VYA_TUMBO">Vidonda vya Tumbo</option>
                <option value="ACID_REFLUX">Acid Reflux</option>
                <option value="JUMLA">Elimu ya Jumla</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                Kichwa cha Slaidi {!editingSlide && '(Hiari — hujazwa automatic ukiacha wazi)'}
              </label>
              <input
                type="text"
                placeholder="Mfano: Vidonda vya Tumbo ni Nini?"
                value={slideTitle}
                onChange={(e) => setSlideTitle(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E9E4] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A5D54] mb-1">
                Maelezo ya Elimu {!editingSlide && '(Hiari — hujazwa automatic ukiacha wazi)'}
              </label>
              <textarea
                rows={4}
                placeholder="Maelezo ya slaidi..."
                value={slideDesc}
                onChange={(e) => setSlideDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E9E4] text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#4A5D54]">
                Picha ya Slaidi (Picha ya Rangi / Kielelezo)
              </label>
              <div className="w-full rounded-2xl border border-[#E2E9E4] bg-white overflow-hidden">
                <img
                  src={slideImageUrl || ASSETS.stomachUlcer}
                  alt="Hakiki picha ya slaidi"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto max-h-[300px] object-cover block"
                />
              </div>
              <label className="relative overflow-hidden min-h-[44px] px-4 py-2 rounded-xl border border-[#E2E9E4] bg-[#F8FAF9] hover:bg-[#EBF4EE] text-sm font-medium text-[#15623E] flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{uploadingFile ? 'Inapakia...' : 'Pakia / Badili Picha ya Rangi'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadSlideImg(f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={slideActive}
                onChange={(e) => setSlideActive(e.target.checked)}
                className="w-4 h-4 accent-[#15623E]"
              />
              <span>Inaonekana (Active)</span>
            </label>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSlideModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E2E9E4] text-sm cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="submit"
                disabled={uploadingFile || savingModal}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#15623E] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
              >
                {savingModal ? 'Inahifadhi...' : 'Hifadhi Slaidi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LEAD ASSESSMENT DETAILS MODAL */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#E2E9E4] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E9E4] pb-3">
              <div>
                <h3 className="font-display font-bold text-lg">{selectedLead.fullName}</h3>
                <p className="text-xs text-[#6E7F76] font-mono">
                  {selectedLead.phone} · {selectedLead.location || 'Hakuna eneo'}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedLead(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedLeadAssessment ? (
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between py-1.5 border-b border-[#F3F7F4]">
                  <span className="text-[#6E7F76]">Maumivu juu ya tumbo:</span>
                  <span className="font-medium">{selectedLeadAssessment.upperAbdominalDiscomfort}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F3F7F4]">
                  <span className="text-[#6E7F76]">Kiungulia:</span>
                  <span className="font-medium">{selectedLeadAssessment.heartburn}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F3F7F4]">
                  <span className="text-[#6E7F76]">Acid kurudi kooni:</span>
                  <span className="font-medium">{selectedLeadAssessment.acidRegurgitation}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F3F7F4]">
                  <span className="text-[#6E7F76]">Mara ngapi:</span>
                  <span className="font-medium">{selectedLeadAssessment.symptomFrequency}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F3F7F4]">
                  <span className="text-[#6E7F76]">Muda wa dalili:</span>
                  <span className="font-medium">{selectedLeadAssessment.symptomDuration}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F3F7F4]">
                  <span className="text-[#6E7F76]">Uchunguzi wa awali:</span>
                  <span className="font-medium">{selectedLeadAssessment.priorMedicalAssessment}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F3F7F4]">
                  <span className="text-[#6E7F76]">Anahitaji elimu zaidi:</span>
                  <span className="font-medium">{selectedLeadAssessment.wantsMoreEducation}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#6E7F76]">Dalili za tahadhari:</span>
                  <span
                    className={`font-semibold ${
                      selectedLeadAssessment.hasWarningSigns ? 'text-red-700' : 'text-[#15623E]'
                    }`}
                  >
                    {selectedLeadAssessment.hasWarningSigns ? 'Ndiyo (Zimeripotiwa)' : 'Hapana'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#6E7F76]">Majibu ya tathmini hayakupatikana.</p>
            )}
          </div>
        </div>
      )}

      {/* ADMIN PDF PREVIEW MODAL */}
      {previewPdfBook && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#E2E9E4] w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E9E4] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-[#15623E]" />
                <span className="font-display font-semibold text-sm truncate">
                  {previewPdfBook.title}
                </span>
              </div>
              <button type="button" onClick={() => setPreviewPdfBook(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              src={previewPdfBook.pdfUrl}
              title={previewPdfBook.title}
              className="flex-1 w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
