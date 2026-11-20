import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Lock,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { ASSESSMENT_QUESTIONS, ASSETS } from '../data/defaults';
import {
  advanceLeadFlags,
  getCachedPublicFunnelData,
  initMetaPixelIfConsented,
  loadPublicFunnelData,
  loadVisitorProgress,
  recordFunnelEvent,
  saveVisitorProgress,
  submitAssessmentAndLead,
} from '../services/funnelService';
import type {
  AssessmentAnswers,
  Campaign,
  Ebook,
  EducationalSlide,
  FunnelStep,
  PublicSettings,
  VisitorProgressState,
} from '../types';
import { MedicalVisual } from './MedicalVisual';

interface VisitorFunnelProps {
  onOpenAdmin: () => void;
}

const STEP_LABELS: Record<FunnelStep, string> = {
  1: 'Karibu',
  2: 'Elimu ya Afya',
  3: 'Tathmini Fupi',
  4: 'Hifadhi Mawasiliano',
  5: 'Jamii ya WhatsApp',
  6: 'Fungua eBook',
};

export function VisitorFunnel({ onOpenAdmin }: VisitorFunnelProps) {
  const [initialCache] = useState(() => getCachedPublicFunnelData());
  const [progress, setProgress] = useState<VisitorProgressState>(() => loadVisitorProgress());
  const [settings, setSettings] = useState<PublicSettings>(initialCache.settings);
  const [campaign, setCampaign] = useState<Campaign>(initialCache.campaign);
  const [slides, setSlides] = useState<EducationalSlide[]>(initialCache.slides);
  const [assignedEbook, setAssignedEbook] = useState<Ebook | null>(initialCache.assignedEbook);

  // Step 2 sub-state: showing completion summary after final slide
  const [showingEduDone, setShowingEduDone] = useState(false);

  // Step 3 form state
  const [submittingLead, setSubmittingLead] = useState(false);
  const [formError, setFormError] = useState('');

  // Step 6 PDF Reader Modal
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Stealth 5-tap counter on discreet file icon
  const secretTapRef = useRef<{ count: number; lastTap: number }>({ count: 0, lastTap: 0 });
  const handleSecretFileTap = () => {
    const now = Date.now();
    if (now - secretTapRef.current.lastTap > 3500) {
      secretTapRef.current = { count: 1, lastTap: now };
    } else {
      secretTapRef.current = { count: secretTapRef.current.count + 1, lastTap: now };
    }
    if (secretTapRef.current.count >= 5) {
      secretTapRef.current = { count: 0, lastTap: 0 };
      onOpenAdmin();
    }
  };

  // Refresh campaign, slides, settings, and eBook silently in background without blocking initial render
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const campParam = params.get('campaign') || undefined;

    initMetaPixelIfConsented(initialCache.settings.metaPixelId, true);

    loadPublicFunnelData(campParam).then((data) => {
      if (!active) return;
      setSettings(data.settings);
      setCampaign(data.campaign);
      setSlides(data.slides);
      setAssignedEbook(data.assignedEbook);

      setProgress((prev) => {
        const updated = { ...prev, campaignId: data.campaign.id };
        saveVisitorProgress(updated);
        return updated;
      });

      initMetaPixelIfConsented(data.settings.metaPixelId, true);

      void recordFunnelEvent({
        sessionId: progress.sessionId,
        campaignId: data.campaign.id,
        eventType: 'landing_page_viewed',
        consentGranted: true,
        metaPixelId: data.settings.metaPixelId,
      });
    });

    return () => {
      active = false;
    };
  }, []);

  // Persist progress whenever it changes
  useEffect(() => {
    saveVisitorProgress(progress);
  }, [progress]);

  // Track Step 6 unlock automatically upon entering Step 6
  useEffect(() => {
    if (progress.currentStep === 6 && campaign && !progress.ebookUnlocked) {
      setProgress((prev) => ({ ...prev, ebookUnlocked: true }));
      void advanceLeadFlags(progress.sessionId, {
        currentStep: 6,
        ebookUnlocked: true,
        assignedEbookId: assignedEbook?.id || '',
      });
      void recordFunnelEvent({
        sessionId: progress.sessionId,
        campaignId: campaign.id,
        eventType: 'ebook_unlocked',
        ebookId: assignedEbook?.id,
        consentGranted: progress.trackingConsent !== false,
        metaPixelId: settings?.metaPixelId,
      });
    }
  }, [progress.currentStep, progress.ebookUnlocked, campaign, assignedEbook]);

  const activeSlides = useMemo(() => {
    const sorted = [...slides].filter((s) => s.isActive).sort((a, b) => a.order - b.order);
    return sorted;
  }, [slides]);

  const currentSlide = activeSlides[Math.min(progress.slideIndex, Math.max(0, activeSlides.length - 1))];
  const isShowingLeadForm = progress.assessmentStepIndex >= ASSESSMENT_QUESTIONS.length;
  const currentQuestion = !isShowingLeadForm
    ? ASSESSMENT_QUESTIONS[progress.assessmentStepIndex]
    : null;

  const progressPercentage = Math.round((progress.currentStep / 6) * 100);
  const trackingConsentGranted = true;

  const handleStartJourney = () => {
    if (!campaign) return;
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'welcome_started',
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'education_started',
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
    setShowingEduDone(false);
    setProgress((prev) => ({ ...prev, currentStep: 2 }));
  };

  const handleNextSlide = () => {
    if (progress.slideIndex < activeSlides.length - 1) {
      setProgress((prev) => ({ ...prev, slideIndex: prev.slideIndex + 1 }));
    } else {
      setShowingEduDone(true);
    }
  };

  const handlePrevSlide = () => {
    if (showingEduDone) {
      setShowingEduDone(false);
      return;
    }
    if (progress.slideIndex > 0) {
      setProgress((prev) => ({ ...prev, slideIndex: prev.slideIndex - 1 }));
    } else {
      setProgress((prev) => ({ ...prev, currentStep: 1 }));
    }
  };

  const handleCompleteEducation = () => {
    if (!campaign) return;
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'education_completed',
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'assessment_started',
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
    setProgress((prev) => ({
      ...prev,
      educationCompleted: true,
      currentStep: 3,
    }));
  };

  const handleSelectOption = (key: keyof AssessmentAnswers, value: string) => {
    setProgress((prev) => ({
      ...prev,
      assessmentAnswers: {
        ...prev.assessmentAnswers,
        [key]: value,
      },
    }));
  };

  const handleNextQuestion = () => {
    setProgress((prev) => ({
      ...prev,
      assessmentStepIndex: Math.min(ASSESSMENT_QUESTIONS.length, prev.assessmentStepIndex + 1),
    }));
  };

  const handlePrevQuestion = () => {
    if (progress.assessmentStepIndex > 0) {
      setProgress((prev) => ({
        ...prev,
        assessmentStepIndex: prev.assessmentStepIndex - 1,
      }));
    } else {
      setShowingEduDone(true);
      setProgress((prev) => ({ ...prev, currentStep: 2 }));
    }
  };

  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (progress.assessmentSubmitted) {
      setProgress((prev) => ({ ...prev, currentStep: 4 }));
      return;
    }

    const cleanName = progress.fullName.trim();
    const cleanPhone = progress.phone.trim();

    if (cleanName.length < 2) {
      setFormError('Tafadhali weka jina lako kamili.');
      return;
    }
    if (cleanPhone.replace(/\D/g, '').length < 7) {
      setFormError('Tafadhali weka namba sahihi ya simu.');
      return;
    }
    if (!progress.consentGiven) {
      setFormError('Tafadhali weka tiki kukubali taarifa zako zihifadhiwe kwa usalama.');
      return;
    }
    if (!campaign) return;

    setSubmittingLead(true);
    try {
      const fullAnswers: AssessmentAnswers = {
        upperAbdominalDiscomfort: progress.assessmentAnswers.upperAbdominalDiscomfort || 'sitaki_kusema',
        heartburn: progress.assessmentAnswers.heartburn || 'sitaki_kusema',
        acidRegurgitation: progress.assessmentAnswers.acidRegurgitation || 'sitaki_kusema',
        symptomFrequency: progress.assessmentAnswers.symptomFrequency || 'sitaki_kusema',
        symptomDuration: progress.assessmentAnswers.symptomDuration || 'sitaki_kusema',
        priorMedicalAssessment: progress.assessmentAnswers.priorMedicalAssessment || 'sitaki_kusema',
        wantsMoreEducation: progress.assessmentAnswers.wantsMoreEducation || 'sitaki_kusema',
        warningSigns: progress.assessmentAnswers.warningSigns || 'sitaki_kusema',
      };

      await submitAssessmentAndLead({
        sessionId: progress.sessionId,
        campaignId: campaign.id,
        answers: fullAnswers,
        fullName: cleanName,
        phone: cleanPhone,
        location: progress.location.trim(),
        consentGiven: true,
        assignedEbookId: assignedEbook?.id,
      });

      await recordFunnelEvent({
        sessionId: progress.sessionId,
        campaignId: campaign.id,
        eventType: 'assessment_completed',
        consentGranted: trackingConsentGranted,
        metaPixelId: settings?.metaPixelId,
      });

      setProgress((prev) => ({
        ...prev,
        assessmentSubmitted: true,
        currentStep: 4,
      }));
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Imeshindwa kuhifadhi taarifa. Tafadhali jaribu tena.'
      );
    } finally {
      setSubmittingLead(false);
    }
  };

  const buildVcfDownloadUrl = () => {
    if (!settings) return '/api/contact-card.vcf';
    const qs = new URLSearchParams({
      name: settings.contactName,
      phone: settings.contactPhone,
      intl: settings.contactPhoneIntl,
      org: settings.contactOrganization,
      note: settings.contactNote || 'JOS HEALTH KNOWLEDGE HUB',
    });
    return `/api/contact-card.vcf?${qs.toString()}`;
  };

  const handleDownloadContactCard = () => {
    if (!campaign) return;
    setProgress((prev) => ({ ...prev, contactDownloaded: true }));
    void advanceLeadFlags(progress.sessionId, { contactDownloaded: true });
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'contact_card_downloaded',
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
  };

  const handleConfirmContactSaved = () => {
    if (!campaign) return;
    setProgress((prev) => ({
      ...prev,
      contactConfirmed: true,
      currentStep: 5,
    }));
    void advanceLeadFlags(progress.sessionId, {
      contactConfirmed: true,
      currentStep: 5,
    });
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'contact_save_confirmed',
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
  };

  const handleWhatsappClick = () => {
    if (!campaign) return;
    setProgress((prev) => ({ ...prev, whatsappClicked: true }));
    void advanceLeadFlags(progress.sessionId, { whatsappClicked: true });
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'whatsapp_invitation_clicked',
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
  };

  const handleConfirmCommunityJoined = () => {
    if (!campaign) return;
    setProgress((prev) => ({
      ...prev,
      communityConfirmed: true,
      currentStep: 6,
    }));
    void advanceLeadFlags(progress.sessionId, {
      communityConfirmed: true,
      currentStep: 6,
    });
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'community_join_confirmed',
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
  };

  const handleOpenEbook = () => {
    if (!campaign || !assignedEbook) return;
    setPdfModalOpen(true);
    setProgress((prev) => ({ ...prev, ebookOpened: true }));
    void advanceLeadFlags(progress.sessionId, { ebookOpened: true });
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'ebook_opened',
      ebookId: assignedEbook.id,
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
  };

  const handleDownloadEbook = () => {
    if (!campaign || !assignedEbook) return;
    setProgress((prev) => ({ ...prev, ebookDownloaded: true }));
    void advanceLeadFlags(progress.sessionId, { ebookDownloaded: true });
    void recordFunnelEvent({
      sessionId: progress.sessionId,
      campaignId: campaign.id,
      eventType: 'ebook_downloaded',
      ebookId: assignedEbook.id,
      consentGranted: trackingConsentGranted,
      metaPixelId: settings?.metaPixelId,
    });
  };

  const getEbookInlineUrl = (book: Ebook) => {
    if (book.pdfUrl.startsWith('/api/files/ebooks/')) {
      return `${book.pdfUrl}?name=${encodeURIComponent(book.fileName)}`;
    }
    return book.pdfUrl;
  };

  const getEbookDownloadUrl = (book: Ebook) => {
    if (book.pdfUrl.startsWith('/api/files/ebooks/')) {
      return `${book.pdfUrl}?download=1&name=${encodeURIComponent(book.fileName)}`;
    }
    return book.pdfUrl;
  };

  const handleHeaderBack = () => {
    if (progress.currentStep === 2) {
      handlePrevSlide();
    } else if (progress.currentStep === 3) {
      handlePrevQuestion();
    } else if (progress.currentStep === 4) {
      setProgress((prev) => ({
        ...prev,
        currentStep: 3,
        assessmentStepIndex: ASSESSMENT_QUESTIONS.length,
      }));
    } else if (progress.currentStep === 5) {
      setProgress((prev) => ({ ...prev, currentStep: 4 }));
    } else if (progress.currentStep === 6) {
      setProgress((prev) => ({ ...prev, currentStep: 5 }));
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#13221B] flex flex-col">
      {/* Compact Sticky App Header (<= 56px tall, well under 15% mobile height cap) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E2E9E4]">
        {/* Thin top progress track */}
        <div className="w-full h-1 bg-[#EBF4EE]">
          <div
            className="h-full bg-[#15623E] transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {progress.currentStep > 1 ? (
              <button
                type="button"
                onClick={handleHeaderBack}
                aria-label="Rudi hatua iliyopita"
                className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-[#13221B] hover:bg-[#F3F7F4] transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.brandName}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-lg object-contain border border-[#E2E9E4] bg-white shrink-0"
              />
            ) : null}
            <span className="font-display font-bold text-sm sm:text-base tracking-tight text-[#13221B] truncate">
              {settings.brandName}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-[#4A5D54] tabular-nums whitespace-nowrap">
              Hatua {progress.currentStep} / 6 · {STEP_LABELS[progress.currentStep]}
            </span>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Interactive Stage */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:px-6 lg:py-10">
        <div className="w-full max-w-5xl">
          <AnimatePresence mode="wait">
            {/* ==================== STEP 1: WELCOME SCREEN ==================== */}
            {progress.currentStep === 1 && (
              <motion.section
                key="step-1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
              >
                <div className="lg:col-span-6 order-2 lg:order-1 space-y-5">
                  <div className="text-xs font-medium text-[#15623E] tracking-wide">
                    {settings.presenterName}
                  </div>

                  <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-bold text-[#13221B] leading-[1.16] tracking-tight">
                    Karibu kwenye safari yako ya kuelewa afya ya mfumo wa chakula.
                  </h1>

                  <p className="text-base sm:text-lg text-[#4A5D54] leading-relaxed">
                    Jifunze kuhusu vidonda vya tumbo na acid reflux kupitia elimu rahisi, inayoeleweka na yenye vielelezo.
                  </p>

                  <div className="pt-1 pb-2 border-t border-[#E2E9E4] text-sm text-[#4A5D54] leading-relaxed">
                    Safari hii fupi inakuongoza hatua moja baada ya nyingine: kwanza utapata elimu ya msingi, kisha tathmini binafsi, mawasiliano ya ushauri wa elimu, na mwisho utafungua kitabu chako cha bure (eBook).
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleStartJourney}
                      className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 rounded-2xl bg-[#15623E] hover:bg-[#114F32] active:scale-[0.99] text-white font-display font-semibold text-base inline-flex items-center justify-center gap-3 transition-all cursor-pointer shadow-sm"
                    >
                      <span>ANZA SAFARI YANGU</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6 order-1 lg:order-2">
                  <MedicalVisual
                    imageUrl={settings.welcomeImageUrl || ASSETS.welcome}
                    alt="Kielelezo cha afya ya mfumo wa chakula — JOS HEALTH KNOWLEDGE HUB"
                    aspectClass="aspect-[4/3]"
                  />
                </div>
              </motion.section>
            )}

            {/* ==================== STEP 2: INTERACTIVE SLIDE CAROUSEL ==================== */}
            {progress.currentStep === 2 && !showingEduDone && currentSlide && (
              <motion.section
                key={`step-2-slide-${currentSlide.id}`}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="max-w-4xl mx-auto"
              >
                <div className="rounded-3xl border border-[#E2E9E4] bg-white p-5 sm:p-8 lg:p-10">
                  {/* Top metadata row: clean unboxed typography */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#15623E]">
                      <span>
                        {currentSlide.section === 'VIDONDA_VYA_TUMBO'
                          ? 'Sehemu A · Vidonda vya Tumbo'
                          : currentSlide.section === 'ACID_REFLUX'
                            ? 'Sehemu B · Acid Reflux'
                            : 'Elimu ya Afya'}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-[#6E7F76] tabular-nums">
                      Slaidi {progress.slideIndex + 1} / {activeSlides.length}
                    </div>
                  </div>

                  {/* Slide progress bar segments */}
                  <div className="grid gap-1.5 mb-7" style={{ gridTemplateColumns: `repeat(${activeSlides.length}, minmax(0, 1fr))` }}>
                    {activeSlides.map((s, idx) => (
                      <div
                        key={s.id}
                        className={`h-1.5 rounded-full transition-colors ${
                          idx <= progress.slideIndex ? 'bg-[#15623E]' : 'bg-[#EBF4EE]'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Slide Content */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                    <div className="lg:col-span-6">
                      <MedicalVisual
                        imageUrl={currentSlide.imageUrl}
                        illustrationKey={currentSlide.illustrationKey}
                        alt={currentSlide.title}
                        aspectClass="aspect-[4/3]"
                      />
                    </div>

                    <div className="lg:col-span-6 space-y-4">
                      <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#13221B] leading-snug">
                        {currentSlide.title}
                      </h2>
                      <p className="text-base text-[#4A5D54] leading-relaxed">
                        {currentSlide.description}
                      </p>

                      {currentSlide.illustrationKey === 'warning_signs' && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                          <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                            Ukihisi dalili yoyote kati ya hizi za hatari, fika kituo cha afya au hospitali kwa uchunguzi wa haraka wa daktari.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Slide Navigation Footer */}
                  <div className="mt-7 pt-5 border-t border-[#E2E9E4] flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={handlePrevSlide}
                        className="min-h-[48px] px-5 py-2.5 rounded-xl border border-[#E2E9E4] text-[#13221B] hover:bg-[#F3F7F4] text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Nyuma</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNextSlide}
                        className="flex-1 sm:flex-initial min-h-[48px] px-6 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <span>
                          {progress.slideIndex === activeSlides.length - 1 ? 'Maliza Elimu' : 'Inayofuata'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                  </div>
                </div>
              </motion.section>
            )}

            {/* ==================== STEP 2 COMPLETION SCREEN ==================== */}
            {progress.currentStep === 2 && showingEduDone && (
              <motion.section
                key="step-2-done"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-xl mx-auto"
              >
                <div className="rounded-3xl border border-[#E2E9E4] bg-white p-7 sm:p-10 text-center space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#EBF4EE] text-[#15623E] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[#15623E]">Hatua ya 2 Imekamilika</p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#13221B]">
                      UMEKAMILISHA SEHEMU YA ELIMU
                    </h2>
                    <p className="text-sm sm:text-base text-[#4A5D54] leading-relaxed">
                      Hongera! Sasa tutajibu maswali machache rahisi yanayokusaidia kutathmini uzoefu wako na kukufungulia hatua zinazofuata.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowingEduDone(false)}
                      className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl border border-[#E2E9E4] text-sm font-medium text-[#13221B] hover:bg-[#F3F7F4] transition-colors cursor-pointer"
                    >
                      Pitia Tena Slaidi
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteEducation}
                      className="w-full sm:w-auto min-h-[52px] px-7 py-3 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white font-display font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>ENDELEA NA MASWALI</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {/* ==================== STEP 3: INTERACTIVE HEALTH ASSESSMENT ==================== */}
            {progress.currentStep === 3 && currentQuestion && (
              <motion.section
                key={`step-3-q-${progress.assessmentStepIndex}`}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.18 }}
                className="max-w-2xl mx-auto"
              >
                <div className="rounded-3xl border border-[#E2E9E4] bg-white p-6 sm:p-9 space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs sm:text-sm font-medium text-[#15623E]">
                      Tathmini Fupi ya Afya
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-[#6E7F76] tabular-nums">
                      Swali {progress.assessmentStepIndex + 1} / {ASSESSMENT_QUESTIONS.length}
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-[#EBF4EE] overflow-hidden">
                    <div
                      className="h-full bg-[#15623E] transition-all duration-200"
                      style={{
                        width: `${Math.round(
                          ((progress.assessmentStepIndex + 1) / (ASSESSMENT_QUESTIONS.length + 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-[#13221B] leading-snug">
                      {currentQuestion.question}
                    </h2>
                    <p className="text-sm text-[#6E7F76]">{currentQuestion.helperText}</p>
                  </div>

                  <div className="space-y-3">
                    {currentQuestion.options.map((opt) => {
                      const selected =
                        progress.assessmentAnswers[currentQuestion.key] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelectOption(currentQuestion.key, opt.value)}
                          className={`w-full min-h-[52px] px-4 py-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                            selected
                              ? 'border-[#15623E] bg-[#EBF4EE] text-[#13221B]'
                              : 'border-[#E2E9E4] bg-white hover:bg-[#F8FAF9] text-[#13221B]'
                          }`}
                        >
                          <span className="text-sm sm:text-base font-medium">{opt.label}</span>
                          <span
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              selected
                                ? 'border-[#15623E] bg-[#15623E] text-white'
                                : 'border-[#CBD5CE]'
                            }`}
                          >
                            {selected && <Check className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {currentQuestion.key === 'warningSigns' &&
                    progress.assessmentAnswers.warningSigns === 'ndiyo' && (
                      <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                        <div className="text-xs sm:text-sm text-red-900 leading-relaxed">
                          <strong>Tahadhari Muhimu ya Kiafya:</strong> Dalili ulizozitaja zinahitaji uchunguzi wa haraka wa kitabibu. Tafadhali fika hospitali au kituo cha afya kilicho karibu nawe mapema iwezekanavyo.
                        </div>
                      </div>
                    )}

                  <div className="pt-3 flex items-center justify-between gap-3 border-t border-[#E2E9E4]">
                    <button
                      type="button"
                      onClick={handlePrevQuestion}
                      className="min-h-[48px] px-5 py-2.5 rounded-xl border border-[#E2E9E4] text-sm font-medium text-[#13221B] hover:bg-[#F3F7F4] inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Nyuma</span>
                    </button>

                    <button
                      type="button"
                      disabled={!progress.assessmentAnswers[currentQuestion.key]}
                      onClick={handleNextQuestion}
                      className="min-h-[48px] px-7 py-2.5 rounded-xl bg-[#15623E] hover:bg-[#114F32] disabled:opacity-45 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Endelea</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {/* ==================== STEP 3 FINAL: LEAD DETAILS & EXPLICIT CONSENT ==================== */}
            {progress.currentStep === 3 && isShowingLeadForm && (
              <motion.section
                key="step-3-lead-form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-2xl mx-auto"
              >
                <form
                  onSubmit={handleSubmitAssessment}
                  className="rounded-3xl border border-[#E2E9E4] bg-white p-6 sm:p-9 space-y-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs sm:text-sm font-medium text-[#15623E]">
                      Kukamilisha Tathmini
                    </span>
                    <span className="text-xs text-[#6E7F76] tabular-nums">Hatua ya Mwisho · Maswali</span>
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="font-display text-2xl font-bold text-[#13221B]">
                      Taarifa zako za kufungua mwongozo
                    </h2>
                    <p className="text-sm text-[#4A5D54] leading-relaxed">
                      Taarifa hizi zinakusanywa kwa ajili ya kukamilisha usajili wako wa elimu ya afya, kukuunganisha na Dr. Revo, na kufungua eBook yako ya mwongozo pekee.
                    </p>
                  </div>

                  {progress.assessmentAnswers.warningSigns === 'ndiyo' && (
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                      <p className="text-xs sm:text-sm text-red-900 leading-relaxed">
                        Kumbuka: Kwa kuwa umeripoti dalili za tahadhari, tunakushauri sana umwone daktari hospitalini kwa uchunguzi wa kitaalamu mapema. Tathmini hii haitoi utambuzi wa ugonjwa.
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="lead-fullname" className="block text-sm font-medium text-[#13221B] mb-1.5">
                        Jina Kamili *
                      </label>
                      <input
                        id="lead-fullname"
                        type="text"
                        required
                        maxLength={160}
                        placeholder="Mfano: Amina Juma"
                        value={progress.fullName}
                        onChange={(e) => setProgress((p) => ({ ...p, fullName: e.target.value }))}
                        className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E2E9E4] bg-white text-[#13221B] placeholder:text-[#94A39B] focus:outline-none focus:border-[#15623E] focus:ring-2 focus:ring-[#15623E]/15"
                      />
                    </div>

                    <div>
                      <label htmlFor="lead-phone" className="block text-sm font-medium text-[#13221B] mb-1.5">
                        Namba ya Simu (WhatsApp / Kawaida) *
                      </label>
                      <input
                        id="lead-phone"
                        type="tel"
                        required
                        maxLength={40}
                        placeholder="Mfano: 0712345678 au +255712345678"
                        value={progress.phone}
                        onChange={(e) => setProgress((p) => ({ ...p, phone: e.target.value }))}
                        className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E2E9E4] bg-white text-[#13221B] placeholder:text-[#94A39B] focus:outline-none focus:border-[#15623E] focus:ring-2 focus:ring-[#15623E]/15"
                      />
                    </div>

                    <div>
                      <label htmlFor="lead-location" className="block text-sm font-medium text-[#13221B] mb-1.5">
                        Eneo / Mkoa Unakoishi (Hiari)
                      </label>
                      <input
                        id="lead-location"
                        type="text"
                        maxLength={160}
                        placeholder="Mfano: Dar es Salaam, Arusha, Mwanza..."
                        value={progress.location}
                        onChange={(e) => setProgress((p) => ({ ...p, location: e.target.value }))}
                        className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E2E9E4] bg-white text-[#13221B] placeholder:text-[#94A39B] focus:outline-none focus:border-[#15623E] focus:ring-2 focus:ring-[#15623E]/15"
                      />
                    </div>
                  </div>

                  {/* Explicit Consent */}
                  <label className="flex items-start gap-3 p-4 rounded-2xl bg-[#F8FAF9] border border-[#E2E9E4] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={progress.consentGiven}
                      onChange={(e) => setProgress((p) => ({ ...p, consentGiven: e.target.checked }))}
                      className="mt-0.5 w-5 h-5 rounded accent-[#15623E] shrink-0 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-[#4A5D54] leading-relaxed">
                      Ninakubali kwa hiari yangu taarifa zangu na majibu ya tathmini yahifadhiwe kwa usalama na{' '}
                      <strong className="text-[#13221B]">{settings.brandName}</strong> kwa madhumuni ya elimu ya afya na kupata mwongozo wa eBook.
                    </span>
                  </label>

                  <p className="text-xs text-[#6E7F76] leading-relaxed">
                    Kumbuka: Maswali haya hayatoi utambuzi wa vidonda vya tumbo au ugonjwa mwingine. Kwa uchunguzi wa uhakika wa kiafya, wasiliana na daktari.
                  </p>

                  {formError && (
                    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                      {formError}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handlePrevQuestion}
                      className="min-h-[48px] px-5 py-2.5 rounded-xl border border-[#E2E9E4] text-sm font-medium text-[#13221B] hover:bg-[#F3F7F4] inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Nyuma</span>
                    </button>

                    <button
                      type="submit"
                      disabled={submittingLead}
                      className="flex-1 sm:flex-initial min-h-[52px] px-7 py-3 rounded-xl bg-[#15623E] hover:bg-[#114F32] disabled:opacity-60 text-white font-display font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      {submittingLead ? (
                        <span>Inahifadhi...</span>
                      ) : (
                        <>
                          <span>HIFADHI NA ENDELEA</span>
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.section>
            )}

            {/* ==================== STEP 4: SAVE DR. REVO'S CONTACT ==================== */}
            {progress.currentStep === 4 && (
              <motion.section
                key="step-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-xl mx-auto"
              >
                <div className="rounded-3xl border border-[#E2E9E4] bg-white p-6 sm:p-9 space-y-6">
                  <div className="space-y-2 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#EBF4EE] text-[#15623E] flex items-center justify-center mx-auto mb-3">
                      <UserPlus className="w-7 h-7" />
                    </div>
                    <p className="text-xs font-medium text-[#15623E]">Hatua ya 4 · Mawasiliano Rasmi</p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#13221B]">
                      Hifadhi Mawasiliano ya Dr. Revo
                    </h2>
                    <p className="text-sm text-[#4A5D54] leading-relaxed">
                      Pakua kadi ya mawasiliano (VCF) ili namba ya Dr. Revo iingie moja kwa moja kwenye orodha ya namba za simu yako.
                    </p>
                  </div>

                  {/* Clean Contact Display Surface */}
                  <div className="rounded-2xl bg-[#F8FAF9] border border-[#E2E9E4] p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#6E7F76]">Jina la Mawasiliano</p>
                        <p className="font-display font-semibold text-base sm:text-lg text-[#13221B]">
                          {settings.contactName}
                        </p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-[#E2E9E4] grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-[#6E7F76]">Namba ya Simu</p>
                        <p className="font-mono text-sm font-medium text-[#13221B] tabular-nums flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-[#15623E]" />
                          {settings.contactPhone}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6E7F76]">Muundo wa Kimataifa</p>
                        <p className="font-mono text-sm font-medium text-[#13221B] tabular-nums mt-0.5">
                          {settings.contactPhoneIntl}
                        </p>
                      </div>
                    </div>
                  </div>

                  <a
                    href={buildVcfDownloadUrl()}
                    download="Dr_Revo_JOS_NATURAL_HERBS.vcf"
                    onClick={handleDownloadContactCard}
                    className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-[#15623E] hover:bg-[#114F32] text-white font-display font-semibold text-base flex items-center justify-center gap-2.5 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    <span>HIFADHI MAWASILIANO</span>
                  </a>

                  {progress.contactDownloaded && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-5 border-t border-[#E2E9E4] space-y-4 text-center"
                    >
                      <div className="space-y-1">
                        <p className="font-display font-semibold text-base text-[#13221B]">
                          Je, umehifadhi mawasiliano ya Dr. Revo kwenye simu yako?
                        </p>
                        <p className="text-xs text-[#6E7F76]">
                          Tovuti haiwezi kukagua orodha ya namba kwenye simu yako moja kwa moja; bofya hapa chini kuthibitisha binafsi.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmContactSaved}
                        className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-[#13221B] hover:bg-[#1F352B] text-white font-display font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Check className="w-5 h-5" />
                        <span>NDIYO, NIMEHIFADHI</span>
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.section>
            )}

            {/* ==================== STEP 5: JOIN WHATSAPP COMMUNITY ==================== */}
            {progress.currentStep === 5 && (
              <motion.section
                key="step-5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-xl mx-auto"
              >
                <div className="rounded-3xl border border-[#E2E9E4] bg-white p-6 sm:p-9 space-y-6">
                  <div className="space-y-2 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#EBF4EE] text-[#15623E] flex items-center justify-center mx-auto mb-3">
                      <MessageCircle className="w-7 h-7" />
                    </div>
                    <p className="text-xs font-medium text-[#15623E]">Hatua ya 5 · Jamii ya Elimu</p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#13221B]">
                      {settings.communityName}
                    </h2>
                    <p className="text-sm sm:text-base text-[#4A5D54] leading-relaxed pt-1">
                      {settings.communityMessage}
                    </p>
                  </div>

                  <a
                    href={settings.whatsappCommunityLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleWhatsappClick}
                    className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-[#15623E] hover:bg-[#114F32] text-white font-display font-semibold text-base flex items-center justify-center gap-2.5 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>JIUNGE NA WHATSAPP COMMUNITY</span>
                    <ExternalLink className="w-4 h-4 opacity-80" />
                  </a>

                  {progress.whatsappClicked && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-5 border-t border-[#E2E9E4] space-y-4 text-center"
                    >
                      <div className="space-y-1">
                        <p className="font-display font-semibold text-base text-[#13221B]">
                          Je, umefanikiwa kujiunga na community?
                        </p>
                        <p className="text-xs text-[#6E7F76]">
                          Baada ya kubofya Join kwenye WhatsApp na kurudi hapa, thibitisha ili kufungua kitabu chako cha eBook.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmCommunityJoined}
                        className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-[#13221B] hover:bg-[#1F352B] text-white font-display font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Check className="w-5 h-5" />
                        <span>NDIYO, NIMEJIUNGA</span>
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.section>
            )}

            {/* ==================== STEP 6: EBOOK UNLOCK ==================== */}
            {progress.currentStep === 6 && (
              <motion.section
                key="step-6"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-4xl mx-auto"
              >
                <div className="rounded-3xl border border-[#E2E9E4] bg-white p-6 sm:p-10">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-5">
                      <div className="max-w-[300px] mx-auto rounded-2xl overflow-hidden border border-[#E2E9E4] bg-white">
                        <img
                          src={assignedEbook?.coverUrl || ASSETS.ebookCover}
                          alt={assignedEbook?.title || 'Jalada la eBook'}
                          referrerPolicy="no-referrer"
                          className="w-full h-auto max-h-[420px] object-cover block"
                        />
                      </div>
                    </div>

                    <div className="lg:col-span-7 space-y-5">
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#15623E]">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Hatua ya 6 · Kitabu Kimefunguliwa</span>
                      </div>

                      <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#13221B]">
                        Umefanikiwa!
                      </h1>

                      <p className="text-base text-[#4A5D54] leading-relaxed">
                        Umekamilisha hatua zote. Sasa unaweza kupata kitabu chako cha elimu.
                      </p>

                      {assignedEbook ? (
                        <div className="pt-4 border-t border-[#E2E9E4] space-y-4">
                          <div className="space-y-1">
                            <p className="text-xs text-[#6E7F76]">
                              {assignedEbook.category} · PDF ({Math.max(1, Math.round(assignedEbook.fileSize / 1024))} KB)
                            </p>
                            <h2 className="font-display text-xl font-bold text-[#13221B]">
                              {assignedEbook.title}
                            </h2>
                            {assignedEbook.description && (
                              <p className="text-sm text-[#4A5D54] leading-relaxed">
                                {assignedEbook.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 pt-1">
                            <button
                              type="button"
                              onClick={handleOpenEbook}
                              className="flex-1 min-h-[52px] px-6 py-3.5 rounded-2xl bg-[#15623E] hover:bg-[#114F32] text-white font-display font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                            >
                              <BookOpen className="w-5 h-5" />
                              <span>FUNGUA EBOOK YANGU</span>
                            </button>

                            <a
                              href={getEbookDownloadUrl(assignedEbook)}
                              download={assignedEbook.fileName}
                              onClick={handleDownloadEbook}
                              className="min-h-[52px] px-5 py-3.5 rounded-2xl border border-[#E2E9E4] hover:bg-[#F3F7F4] text-[#13221B] font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              <span>Pakua PDF</span>
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-[#F8FAF9] border border-[#E2E9E4] p-5 flex items-center gap-3 text-sm text-[#4A5D54]">
                          <Lock className="w-5 h-5 text-[#15623E] shrink-0" />
                          <span>Hakuna eBook iliyounganishwa na kampeni hii kwa sasa. Tafadhali wasiliana na Dr. Revo.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Quiet Footer with discreet 5-tap file icon */}
      <footer className="py-4 px-4 flex items-center justify-center gap-2 text-xs text-[#6E7F76]">
        <span>{settings.brandName} · {settings.presenterName}</span>
        <button
          type="button"
          onClick={handleSecretFileTap}
          aria-label="Nyaraka"
          className="p-2 rounded-lg text-[#94A39B] hover:text-[#6E7F76] transition-colors cursor-default"
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
      </footer>

      {/* In-App PDF Reader Modal */}
      {pdfModalOpen && assignedEbook && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={assignedEbook.title}
        >
          <div className="bg-white rounded-3xl border border-[#E2E9E4] w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E9E4] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-5 h-5 text-[#15623E] shrink-0" />
                <h3 className="font-display font-semibold text-sm sm:text-base text-[#13221B] truncate">
                  {assignedEbook.title}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={getEbookDownloadUrl(assignedEbook)}
                  download={assignedEbook.fileName}
                  onClick={handleDownloadEbook}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#15623E] hover:bg-[#114F32] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pakua PDF</span>
                </a>
                <a
                  href={getEbookInlineUrl(assignedEbook)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-[#E2E9E4] hover:bg-[#F3F7F4] text-xs font-medium text-[#13221B] inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Fungua Dirisha Jipya</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPdfModalOpen(false)}
                  aria-label="Funga"
                  className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-[#F3F7F4] flex items-center justify-center text-[#4A5D54] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#F3F7F4]">
              <iframe
                src={getEbookInlineUrl(assignedEbook)}
                title={assignedEbook.title}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
