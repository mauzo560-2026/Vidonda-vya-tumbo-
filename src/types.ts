export type FunnelStep = 1 | 2 | 3 | 4 | 5 | 6;

export type SlideSection = 'VIDONDA_VYA_TUMBO' | 'ACID_REFLUX' | 'JUMLA';

export type FunnelEventType =
  | 'landing_page_viewed'
  | 'welcome_started'
  | 'education_started'
  | 'education_completed'
  | 'assessment_started'
  | 'assessment_completed'
  | 'contact_card_downloaded'
  | 'contact_save_confirmed'
  | 'whatsapp_invitation_clicked'
  | 'community_join_confirmed'
  | 'ebook_unlocked'
  | 'ebook_opened'
  | 'ebook_downloaded';

export interface Campaign {
  id: string;
  name: string;
  topic: string;
  description?: string;
  assignedEbookId?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EducationalSlide {
  id: string;
  campaignId: string;
  section: SlideSection;
  order: number;
  title: string;
  description: string;
  imageUrl?: string;
  illustrationKey?: string;
  isActive: boolean;
  updatedAt?: unknown;
}

export interface Ebook {
  id: string;
  title: string;
  description?: string;
  category: string;
  coverUrl?: string;
  pdfUrl: string;
  fileName: string;
  fileSize: number;
  storageProvider: 'server' | 'firebase_storage';
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Lead {
  id: string;
  sessionId: string;
  campaignId: string;
  fullName: string;
  phone: string;
  location?: string;
  consentGiven: boolean;
  currentStep: FunnelStep;
  educationCompleted: boolean;
  assessmentCompleted: boolean;
  contactDownloaded: boolean;
  contactConfirmed: boolean;
  whatsappClicked: boolean;
  communityConfirmed: boolean;
  ebookUnlocked: boolean;
  ebookOpened: boolean;
  ebookDownloaded: boolean;
  assignedEbookId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AssessmentAnswers {
  upperAbdominalDiscomfort: string;
  heartburn: string;
  acidRegurgitation: string;
  symptomFrequency: string;
  symptomDuration: string;
  priorMedicalAssessment: string;
  wantsMoreEducation: string;
  warningSigns: string;
}

export interface AssessmentRecord {
  id: string;
  leadId: string;
  campaignId: string;
  upperAbdominalDiscomfort: string;
  heartburn: string;
  acidRegurgitation: string;
  symptomFrequency: string;
  symptomDuration: string;
  priorMedicalAssessment: string;
  wantsMoreEducation: string;
  hasWarningSigns: boolean;
  consentGiven: boolean;
  createdAt?: unknown;
}

export interface FunnelEventRecord {
  id: string;
  sessionId: string;
  campaignId: string;
  eventType: FunnelEventType;
  ebookId?: string;
  consentGranted: boolean;
  createdAt?: unknown;
}

export interface PublicSettings {
  brandName: string;
  presenterName: string;
  contactName: string;
  contactPhone: string;
  contactPhoneIntl: string;
  whatsappNumber: string;
  contactOrganization: string;
  contactNote?: string;
  communityName: string;
  communityMessage: string;
  whatsappCommunityLink: string;
  metaPixelId?: string;
  logoUrl?: string;
  welcomeImageUrl?: string;
  updatedAt?: unknown;
}

export interface VisitorProgressState {
  sessionId: string;
  campaignId: string;
  currentStep: FunnelStep;
  slideIndex: number;
  educationCompleted: boolean;
  assessmentStepIndex: number;
  assessmentAnswers: Partial<AssessmentAnswers>;
  assessmentSubmitted: boolean;
  fullName: string;
  phone: string;
  location: string;
  consentGiven: boolean;
  trackingConsent: boolean | null;
  contactDownloaded: boolean;
  contactConfirmed: boolean;
  whatsappClicked: boolean;
  communityConfirmed: boolean;
  ebookUnlocked: boolean;
  ebookOpened: boolean;
  ebookDownloaded: boolean;
}
