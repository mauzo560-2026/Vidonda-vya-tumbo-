import type {
  AssessmentAnswers,
  Campaign,
  Ebook,
  EducationalSlide,
  PublicSettings,
} from '../types';

export const DEFAULT_CAMPAIGN_ID = 'vidonda_acid_reflux_01';
export const DEFAULT_EBOOK_ID = 'ebook_vidonda_acid_reflux_01';

export const ASSETS = {
  welcome: '/src/assets/images/welcome_digestive_care_1795206181856.jpg',
  stomachUlcer: '/src/assets/images/medical_stomach_ulcer_1795206181307.jpg',
  acidReflux: '/src/assets/images/medical_acid_reflux_1795206180813.jpg',
  medicalCheckup: '/src/assets/images/medical_care_checkup_1795206182335.jpg',
  ebookCover: '/src/assets/images/ebook_cover_digestive_1795206181948.jpg',
};

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  brandName: 'JOS HEALTH KNOWLEDGE HUB',
  presenterName: 'Dr. Revo • JOS NATURAL HERBS',
  contactName: 'Dr. Revo – JOS NATURAL HERBS',
  contactPhone: '0652421286',
  contactPhoneIntl: '+255652421286',
  whatsappNumber: '+255652421286',
  contactOrganization: 'JOS NATURAL HERBS',
  contactNote: 'Elimu ya Afya ya Mfumo wa Chakula — JOS HEALTH KNOWLEDGE HUB',
  communityName: 'JOS HEALTH EDUCATION COMMUNITY',
  communityMessage:
    'Karibu kwenye jamii ya elimu ya afya. Jiunge nasi ili uweze kufuatilia elimu na taarifa mbalimbali zinazoshirikishwa kwenye community.',
  whatsappCommunityLink: 'https://chat.whatsapp.com/G9c4tWHtfzV1M7nN0HfUmh?s=cl&p=a&iam=2',
  metaPixelId: '',
  logoUrl: '',
  welcomeImageUrl: ASSETS.welcome,
};

export const DEFAULT_CAMPAIGN: Campaign = {
  id: DEFAULT_CAMPAIGN_ID,
  name: 'VIDONDA VYA TUMBO NA ACID REFLUX',
  topic: 'Elimu ya Afya ya Mfumo wa Chakula: Vidonda vya Tumbo na Acid Reflux',
  description:
    'Kampeni ya elimu ya hatua kwa hatua inayowasaidia washiriki kuelewa vidonda vya tumbo na acid reflux kwa njia rahisi na ya kitaalamu.',
  assignedEbookId: DEFAULT_EBOOK_ID,
  isActive: true,
  isDefault: true,
};

export const DEFAULT_EBOOK: Ebook = {
  id: DEFAULT_EBOOK_ID,
  title: 'Mwongozo wa Elimu: Vidonda vya Tumbo na Acid Reflux',
  description:
    'Kijitabu cha elimu kinachoelezea kwa lugha rahisi kuhusu chanzo, dalili, utambuzi wa kitabibu, na hatua za kuzingatia kwa afya ya mfumo wa chakula.',
  category: 'Afya ya Mfumo wa Chakula',
  coverUrl: ASSETS.ebookCover,
  pdfUrl: '/api/files/ebooks/mwongozo_vidonda_na_acid_reflux.pdf',
  fileName: 'Mwongozo_Vidonda_vya_Tumbo_na_Acid_Reflux.pdf',
  fileSize: 2840,
  storageProvider: 'server',
  isActive: true,
};

export const DEFAULT_SLIDES: EducationalSlide[] = [
  {
    id: 'slide_01',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'VIDONDA_VYA_TUMBO',
    order: 1,
    title: 'Vidonda vya Tumbo ni Nini?',
    description:
      'Vidonda vya tumbo (Peptic Ulcers) ni michubuko au vidonda vinavyotokea kwenye ukuta wa ndani wa tumbo au sehemu ya kwanza ya utumbo mdogo. Hali hii hutokea pale utando wa ulinzi wa tumbo unaposhindwa kuhimili tindikali ya mmeng’enyo.',
    imageUrl: ASSETS.stomachUlcer,
    illustrationKey: 'ulcer_lining',
    isActive: true,
  },
  {
    id: 'slide_02',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'VIDONDA_VYA_TUMBO',
    order: 2,
    title: 'Vidonda vya Tumbo Hutokeaje?',
    description:
      'Sababu mbili kuu zinazotambulika kitabibu ni maambukizi ya bakteria aitwaye Helicobacter pylori (H. pylori) pamoja na matumizi ya muda mrefu ya baadhi ya dawa za kupunguza maumivu na uvimbe (NSAIDs) kama vile ibuprofen na aspirin.',
    imageUrl: ASSETS.stomachUlcer,
    illustrationKey: 'ulcer_causes',
    isActive: true,
  },
  {
    id: 'slide_03',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'VIDONDA_VYA_TUMBO',
    order: 3,
    title: 'Dalili Zinazoweza Kujitokeza',
    description:
      'Dalili zinazoweza kuonekana ni maumivu au hisia ya kuungua sehemu ya juu ya tumbo, kichefuchefu, na kujaa gesi tumboni. Hata hivyo, si kila maumivu ya tumbo ni vidonda, na baadhi ya watu wanaweza wasiwe na dalili zozote mwanzoni.',
    imageUrl: ASSETS.stomachUlcer,
    illustrationKey: 'ulcer_symptoms',
    isActive: true,
  },
  {
    id: 'slide_04',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'VIDONDA_VYA_TUMBO',
    order: 4,
    title: 'Dhana Potofu Zilizopo',
    description:
      'Vyakula vyenye pilipili au msongo wa mawazo si vyanzo vikuu vinavyosababisha vidonda vya tumbo. Ingawa vinaweza kuongeza maumivu au usumbufu kwa mtu ambaye tayari ana tatizo kwenye ukuta wa tumbo, havitengenezi vidonda vyenyewe.',
    imageUrl: ASSETS.stomachUlcer,
    illustrationKey: 'ulcer_myths',
    isActive: true,
  },
  {
    id: 'slide_05',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'VIDONDA_VYA_TUMBO',
    order: 5,
    title: 'Utambuzi wa Kitabibu',
    description:
      'Kuthibitisha vidonda vya tumbo hakufanywi kwa kubahatisha. Daktari hufanya tathmini ya kitabibu, vipimo vya maabara vya kugundua bakteria wa H. pylori, na ikihitajika kiafya, kipimo cha kuangalia ndani ya tumbo (endoscopy).',
    imageUrl: ASSETS.medicalCheckup,
    illustrationKey: 'ulcer_diagnosis',
    isActive: true,
  },
  {
    id: 'slide_06',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'VIDONDA_VYA_TUMBO',
    order: 6,
    title: 'Umuhimu wa Tiba Sahihi',
    description:
      'Matibabu hutegemea chanzo halisi kilichogunduliwa baada ya vipimo. Mara nyingi huhusisha dawa zilizoandikwa na daktari za kupunguza kiwango cha tindikali tumboni na tiba kamili ya kuondoa bakteria wa H. pylori pale inapohitajika.',
    imageUrl: ASSETS.medicalCheckup,
    illustrationKey: 'ulcer_care',
    isActive: true,
  },
  {
    id: 'slide_07',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'ACID_REFLUX',
    order: 7,
    title: 'Acid Reflux ni Nini?',
    description:
      'Acid reflux ni hali ambapo tindikali na vyakula vilivyoko tumboni hurudi juu kuelekea kwenye koo la chakula (oesophagus). Hali hii hutokea pale mlango wa misuli kati ya koo na tumbo unapolegea au kufunguka isivyo kawaida.',
    imageUrl: ASSETS.acidReflux,
    illustrationKey: 'reflux_what',
    isActive: true,
  },
  {
    id: 'slide_08',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'ACID_REFLUX',
    order: 8,
    title: 'Acid Reflux Hutokeaje?',
    description:
      'Kwa kawaida, misuli ya chini ya koo (Lower Esophageal Sphincter) hufunguka ili chakula kiingie tumboni kisha hujifunga. Inapolegea au shinikizo tumboni linapoongezeka, tindikali hupanda juu na kuchubua ukuta laini wa koo.',
    imageUrl: ASSETS.acidReflux,
    illustrationKey: 'reflux_mechanism',
    isActive: true,
  },
  {
    id: 'slide_09',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'ACID_REFLUX',
    order: 9,
    title: 'Dalili za Kawaida za Acid Reflux',
    description:
      'Dalili zinazotokea mara nyingi ni kiungulia (hisia ya moto katikati ya kifua), ladha ya uchachu au uchungu mdomoni, chakula kurudi kooni, na wakati mwingine kikohozi cha muda mrefu au koo kukereketa.',
    imageUrl: ASSETS.acidReflux,
    illustrationKey: 'reflux_symptoms',
    isActive: true,
  },
  {
    id: 'slide_10',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'ACID_REFLUX',
    order: 10,
    title: 'Vichocheo vya Kawaida',
    description:
      'Vichocheo hutofautiana kati ya mtu na mtu. Kula mlo mkubwa kupita kiasi, kulala chini muda mfupi baada ya kula, na baadhi ya vyakula au vinywaji vinaweza kuongeza uwezekano wa tindikali kupanda juu.',
    imageUrl: ASSETS.acidReflux,
    illustrationKey: 'reflux_triggers',
    isActive: true,
  },
  {
    id: 'slide_11',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'ACID_REFLUX',
    order: 11,
    title: 'Hatua za Mtindo wa Maisha',
    description:
      'Hatua rahisi kama kusubiri angalau saa 2 hadi 3 baada ya kula kabla ya kulala, kula milo ya kiasi, kutambua vyakula vinavyokukwaza binafsi, na kupata ushauri wa daktari husaidia kudhibiti usumbufu huu.',
    imageUrl: ASSETS.medicalCheckup,
    illustrationKey: 'reflux_lifestyle',
    isActive: true,
  },
  {
    id: 'slide_12',
    campaignId: DEFAULT_CAMPAIGN_ID,
    section: 'ACID_REFLUX',
    order: 12,
    title: 'Wakati wa Kumwona Daktari Haraka',
    description:
      'Pata huduma ya daktari mara moja ukiona dalili za tahadhari: kushindwa au maumivu wakati wa kumeza, kutapika mfululizo, kupungua uzito bila sababu, kutapika damu, au kutoa choo cheusi kama lami.',
    imageUrl: ASSETS.medicalCheckup,
    illustrationKey: 'warning_signs',
    isActive: true,
  },
];

export interface AssessmentQuestion {
  key: keyof AssessmentAnswers;
  question: string;
  helperText: string;
  options: { value: string; label: string }[];
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    key: 'upperAbdominalDiscomfort',
    question: 'Je, unahisi maumivu au usumbufu wa kuungua sehemu ya juu ya tumbo?',
    helperText: 'Sehemu ya juu ya tumbo ni kati ya mbavu na kitovu.',
    options: [
      { value: 'ndiyo_mara_kwa_mara', label: 'Ndiyo, mara kwa mara' },
      { value: 'wakati_mwingine', label: 'Wakati mwingine' },
      { value: 'hapana', label: 'Hapana' },
      { value: 'sitaki_kusema', label: 'Sitaki kusema' },
    ],
  },
  {
    key: 'heartburn',
    question: 'Je, unapata kiungulia (hisia ya moto au kuungua kifuani)?',
    helperText: 'Hasa baada ya kula au unapolala chini.',
    options: [
      { value: 'ndiyo_mara_kwa_mara', label: 'Ndiyo, mara kwa mara' },
      { value: 'wakati_mwingine', label: 'Wakati mwingine' },
      { value: 'hapana', label: 'Hapana' },
      { value: 'sitaki_kusema', label: 'Sitaki kusema' },
    ],
  },
  {
    key: 'acidRegurgitation',
    question: 'Je, unasikia ladha ya uchachu au majimaji/chakula kikirudi kooni?',
    helperText: 'Hali hii kitaalamu hujulikana kama acid regurgitation.',
    options: [
      { value: 'ndiyo_mara_kwa_mara', label: 'Ndiyo, mara kwa mara' },
      { value: 'wakati_mwingine', label: 'Wakati mwingine' },
      { value: 'hapana', label: 'Hapana' },
      { value: 'sitaki_kusema', label: 'Sitaki kusema' },
    ],
  },
  {
    key: 'symptomFrequency',
    question: 'Dalili hizi zinajitokeza mara ngapi kwa wastani?',
    helperText: 'Chagua jibu linalokaribia hali yako ya sasa.',
    options: [
      { value: 'kila_siku', label: 'Kila siku' },
      { value: 'mara_kadhaa_kwa_wiki', label: 'Mara kadhaa kwa wiki' },
      { value: 'mara_chache_kwa_mwezi', label: 'Mara chache kwa mwezi' },
      { value: 'sijapata_dalili', label: 'Sijapata dalili hizi' },
      { value: 'sitaki_kusema', label: 'Sitaki kusema' },
    ],
  },
  {
    key: 'symptomDuration',
    question: 'Umekuwa ukipata dalili hizi kwa muda gani?',
    helperText: 'Muda husaidia kuelewa historia ya hali yako kwa ujumla.',
    options: [
      { value: 'chini_ya_wiki_2', label: 'Chini ya wiki 2' },
      { value: 'wiki_2_hadi_miezi_3', label: 'Wiki 2 hadi miezi 3' },
      { value: 'zaidi_ya_miezi_3', label: 'Zaidi ya miezi 3' },
      { value: 'sijawahi_kupata', label: 'Sijawahi kupata' },
      { value: 'sitaki_kusema', label: 'Sitaki kusema' },
    ],
  },
  {
    key: 'priorMedicalAssessment',
    question: 'Je, umewahi kufanyiwa uchunguzi wa kitabibu kuhusu hali hii?',
    helperText: 'Mfano: kumwona daktari au kufanyiwa vipimo hospitalini.',
    options: [
      { value: 'ndiyo_nimewahi', label: 'Ndiyo, nimewahi kufanyiwa uchunguzi' },
      { value: 'hapana_bado', label: 'Hapana, bado sijafanya uchunguzi' },
      { value: 'sitaki_kusema', label: 'Sitaki kusema' },
    ],
  },
  {
    key: 'wantsMoreEducation',
    question: 'Je, ungependa kuendelea kupokea elimu zaidi kuhusu afya ya mfumo wa chakula?',
    helperText: 'Kupitia mwongozo wetu wa eBook na taarifa za elimu.',
    options: [
      { value: 'ndiyo_ningependa', label: 'Ndiyo, ningependa kupata elimu zaidi' },
      { value: 'hapana_kwa_sasa', label: 'Hapana, kwa sasa inatosha' },
      { value: 'sitaki_kusema', label: 'Sitaki kusema' },
    ],
  },
  {
    key: 'warningSigns',
    question:
      'Je, unapata dalili zozote za tahadhari kama kushindwa kumeza, kutapika mara kwa mara, kupungua uzito bila sababu, kutapika damu, au choo cheusi?',
    helperText: 'Swali hili ni kwa usalama wako ili kujua kama unahitaji uangalizi wa haraka wa daktari.',
    options: [
      { value: 'ndiyo', label: 'Ndiyo, nina mojawapo ya dalili hizi' },
      { value: 'hapana', label: 'Hapana, sina dalili hizi' },
      { value: 'sitaki_kusema', label: 'Sitaki kusema' },
    ],
  },
];
