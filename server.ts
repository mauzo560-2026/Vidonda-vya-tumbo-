import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const UPLOADS_ROOT = path.resolve(__dirname, 'uploads');
const EBOOKS_DIR = path.resolve(UPLOADS_ROOT, 'ebooks');
const IMAGES_DIR = path.resolve(UPLOADS_ROOT, 'images');
const DATA_DIR = path.resolve(__dirname, 'data');
const ADMIN_SECRET_FILE = path.resolve(DATA_DIR, 'admin_secret.json');

fs.mkdirSync(EBOOKS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

interface StoredPasscodeRecord {
  salt: string;
  hash: string;
  updatedAt: string;
}

function readStoredPasscode(): StoredPasscodeRecord | null {
  if (!fs.existsSync(ADMIN_SECRET_FILE)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(ADMIN_SECRET_FILE, 'utf-8')) as StoredPasscodeRecord;
    if (raw.salt && raw.hash) return raw;
    return null;
  } catch {
    return null;
  }
}

function hashPasscode(passcode: string, salt?: string): StoredPasscodeRecord {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, usedSalt, 64).toString('hex');
  return {
    salt: usedSalt,
    hash: derived,
    updatedAt: new Date().toISOString(),
  };
}

function verifyStoredPasscode(input: string, record: StoredPasscodeRecord): boolean {
  const derived = crypto.scryptSync(input, record.salt, 64);
  const target = Buffer.from(record.hash, 'hex');
  if (derived.length !== target.length) return false;
  return crypto.timingSafeEqual(derived, target);
}

function verifyEnvPasscode(input: string, envPasscode: string): boolean {
  const a = Buffer.from(input, 'utf-8');
  const b = Buffer.from(envPasscode, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createGateToken(): string {
  const exp = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${exp}.${nonce}`;
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

function verifyGateToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp || !nonce || !sig) return false;
  const expected = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(`${expStr}.${nonce}`)
    .digest('hex');
  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface FirebaseConfigFile {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseConfigFile | null {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (!fs.existsSync(cfgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as FirebaseConfigFile;
  } catch {
    return null;
  }
}

const firebaseCfg = loadFirebaseConfig();
const BOOTSTRAPPED_ADMIN_EMAIL = 'jabirsoloka560@gmail.com';

// Generates a real, multi-page standards-compliant PDF 1.4 educational booklet on startup
function buildDefaultKiswahiliPdf(): Buffer {
  const pagesText: string[][] = [
    [
      'JOS HEALTH KNOWLEDGE HUB',
      'Dr. Revo - JOS NATURAL HERBS',
      ' ',
      'MWONGOZO WA ELIMU YA AFYA YA MFUMO WA CHAKULA',
      'Vidonda vya Tumbo na Acid Reflux',
      ' ',
      'UTANGULIZI',
      'Karibu kwenye mwongozo huu maalum wa elimu ya afya.',
      'Lengo la kijitabu hiki ni kukupa uelewa sahihi, rahisi,',
      'na wa kitaalamu kuhusu mfumo wa chakula, hasa vidonda',
      'vya tumbo (Peptic Ulcers) na kiungulia/acid reflux.',
    ],
    [
      'SEHEMU YA KWANZA: VIDONDA VYA TUMBO',
      ' ',
      '1. Vidonda vya Tumbo ni Nini?',
      'Vidonda vya tumbo (Peptic Ulcers) ni michubuko au vidonda',
      'vinavyojitokeza kwenye ukuta wa ndani wa tumbo au sehemu',
      'ya kwanza ya utumbo mdogo (duodenum).',
      ' ',
      '2. Sababu Kuu za Vidonda vya Tumbo',
      '- Maambukizi ya bakteria aitwaye Helicobacter pylori (H. pylori).',
      '- Matumizi ya muda mrefu ya dawa fulani za maumivu (NSAIDs)',
      '  kama vile ibuprofen, diclofenac, na aspirin bila ushauri.',
      ' ',
      '3. Dhana Potofu',
      'Vyakula vyenye pilipili au msongo wa mawazo pekee si chanzo',
      'kikuu cha vidonda vya tumbo, ingawa vinaweza kuongeza maumivu.',
    ],
    [
      'SEHEMU YA PILI: ACID REFLUX NA KIUNGULIA',
      ' ',
      '1. Acid Reflux ni Nini?',
      'Hii ni hali ambapo tindikali ya tumboni hurudi juu kuelekea',
      'kwenye koo la chakula (oesophagus) pale misuli ya mlango',
      'wa tumbo inapolegea au kufunguka isivyo kawaida.',
      ' ',
      '2. Dalili za Kawaida',
      '- Kiungulia (hisia ya moto kifuani).',
      '- Ladha ya uchachu au uchungu mdomoni.',
      '- Kikohozi cha muda mrefu au koo kukereketa.',
      ' ',
      '3. Hatua za Kujisaidia na Wakati wa Kumwona Daktari',
      'Epuka kulala mara tu baada ya kula, punguza mlo mkubwa usiku,',
      'na fika hospitali ukiona dalili za hatari kama kushindwa',
      'kumeza, kutapika damu, au choo cheusi.',
      ' ',
      'Mawasiliano: Dr. Revo - 0652421286 (+255652421286)',
    ],
  ];

  const escapePdfText = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageIds: number[] = [];
  const contentIds: number[] = [];
  let nextObjId = 4;

  for (let i = 0; i < pagesText.length; i++) {
    pageIds.push(nextObjId++);
    contentIds.push(nextObjId++);
  }

  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj\n`
  );
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  for (let i = 0; i < pagesText.length; i++) {
    const pId = pageIds[i];
    const cId = contentIds[i];
    const lines = pagesText[i];

    let streamBody = 'BT\n/F1 12 Tf\n54 740 Td\n20 TL\n';
    lines.forEach((line, idx) => {
      if (idx === 0) {
        streamBody += `/F1 15 Tf\n(${escapePdfText(line)}) Tj\nT*\n/F1 11 Tf\n`;
      } else {
        streamBody += `(${escapePdfText(line)}) Tj\nT*\n`;
      }
    });
    streamBody += 'ET\n';

    objects.push(
      `${pId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${cId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${cId} 0 obj\n<< /Length ${Buffer.byteLength(streamBody, 'utf-8')} >>\nstream\n${streamBody}endstream\nendobj\n`
    );
  }

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf-8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf-8');
}

const DEFAULT_EBOOK_FILENAME = 'mwongozo_vidonda_na_acid_reflux.pdf';
const defaultPdfPath = path.join(EBOOKS_DIR, DEFAULT_EBOOK_FILENAME);
if (!fs.existsSync(defaultPdfPath)) {
  fs.writeFileSync(defaultPdfPath, buildDefaultKiswahiliPdf());
}

const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]+$/;

function resolveConfinedPath(baseDir: string, filename: string): string | null {
  if (!SAFE_FILENAME_RE.test(filename)) return null;
  const resolved = path.resolve(baseDir, filename);
  if (!resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}

interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedUser | null> {
  if (!firebaseCfg?.apiKey) return null;
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseCfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const u = data.users?.[0];
    if (!u?.localId || !u?.email) return null;
    return {
      uid: u.localId,
      email: u.email,
      emailVerified: Boolean(u.emailVerified),
    };
  } catch {
    return null;
  }
}

async function isAuthorizedAdmin(user: VerifiedUser, idToken: string): Promise<boolean> {
  if (!user.emailVerified) return false;
  if (user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  if (!firebaseCfg?.projectId) return false;
  try {
    const dbId = firebaseCfg.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseCfg.projectId)}/databases/${encodeURIComponent(dbId)}/documents/admins/${encodeURIComponent(user.uid)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization Bearer token' });
    return;
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Empty ID token' });
    return;
  }
  const user = await verifyFirebaseIdToken(idToken);
  if (!user) {
    res.status(401).json({ error: 'Invalid Firebase authentication token' });
    return;
  }
  const ok = await isAuthorizedAdmin(user, idToken);
  if (!ok) {
    res.status(403).json({ error: 'Admin privileges required' });
    return;
  }
  next();
}

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, EBOOKS_DIR),
    filename: (_req, _file, cb) => {
      const id = crypto.randomUUID();
      cb(null, `ebook_${id}.pdf`);
    },
  }),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (
      mime === 'application/pdf' ||
      mime === 'application/x-pdf' ||
      mime.includes('pdf') ||
      ext === '.pdf' ||
      mime === 'application/octet-stream' ||
      mime === ''
    ) {
      cb(null, true);
    } else {
      cb(new Error('Tafadhali chagua faili la PDF pekee.'));
    }
  },
});

const ALLOWED_IMAGE_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.avif',
  '.bmp',
]);

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
    filename: (_req, file, cb) => {
      const id = crypto.randomUUID();
      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/heic': '.heic',
        'image/heif': '.heif',
        'image/avif': '.avif',
        'image/bmp': '.bmp',
        'image/svg+xml': '.svg',
      };
      const origExt = path.extname(file.originalname || '').toLowerCase();
      const ext = extMap[file.mimetype] || (ALLOWED_IMAGE_EXTS.has(origExt) ? origExt : '.jpg');
      cb(null, `media_${id}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const origExt = path.extname(file.originalname || '').toLowerCase();
    const isImageMime = file.mimetype.startsWith('image/');
    const isOctetImage =
      (!file.mimetype || file.mimetype === 'application/octet-stream') &&
      ALLOWED_IMAGE_EXTS.has(origExt);
    if (isImageMime || isOctetImage || ALLOWED_IMAGE_EXTS.has(origExt)) {
      cb(null, true);
    } else {
      cb(new Error('Tafadhali chagua faili la picha (JPG, PNG, WEBP, n.k.).'));
    }
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'JOS HEALTH KNOWLEDGE HUB' });
  });

  // Admin Secret Passcode Status
  app.get('/api/admin/passcode-status', (_req, res) => {
    const envCode = process.env.ADMIN_PASSCODE?.trim();
    const stored = readStoredPasscode();
    res.json({
      envControlled: Boolean(envCode),
      needsSetup: !envCode && !stored,
    });
  });

  // First-run atomic passcode bootstrap (when ADMIN_PASSCODE env is empty and no hash exists yet)
  app.post('/api/admin/setup-passcode', (req, res) => {
    const envCode = process.env.ADMIN_PASSCODE?.trim();
    if (envCode) {
      res.status(409).json({ error: 'Msimbo wa siri tayari umewekwa kupitia mipangilio ya seva.' });
      return;
    }
    if (readStoredPasscode()) {
      res.status(409).json({ error: 'Msimbo wa siri tayari umeshawekwa.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (passcode.length < 4 || passcode.length > 64) {
      res.status(400).json({ error: 'Msimbo wa siri lazima uwe na herufi/namba 4 hadi 64.' });
      return;
    }
    const record = hashPasscode(passcode);
    try {
      fs.writeFileSync(ADMIN_SECRET_FILE, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    } catch {
      res.status(409).json({ error: 'Msimbo wa siri tayari umeshawekwa.' });
      return;
    }
    res.json({ ok: true, gateToken: createGateToken() });
  });

  // Verify secret passcode (checks env ADMIN_PASSCODE first, then scrypt hash)
  app.post('/api/admin/verify-passcode', (req, res) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!passcode) {
      res.status(400).json({ error: 'Weka msimbo wa siri.' });
      return;
    }

    const envCode = process.env.ADMIN_PASSCODE?.trim();
    if (envCode) {
      if (!verifyEnvPasscode(passcode, envCode)) {
        res.status(401).json({ error: 'Msimbo wa siri si sahihi.' });
        return;
      }
      res.json({ ok: true, gateToken: createGateToken() });
      return;
    }

    const stored = readStoredPasscode();
    if (!stored) {
      res.status(400).json({ error: 'Msimbo wa siri bado haujawekwa.' });
      return;
    }
    if (!verifyStoredPasscode(passcode, stored)) {
      res.status(401).json({ error: 'Msimbo wa siri si sahihi.' });
      return;
    }
    res.json({ ok: true, gateToken: createGateToken() });
  });

  // Validate an existing in-memory gateToken
  app.get('/api/admin/verify-gate', (req, res) => {
    const token = typeof req.headers['x-admin-gate'] === 'string' ? req.headers['x-admin-gate'] : '';
    if (!verifyGateToken(token)) {
      res.status(401).json({ valid: false });
      return;
    }
    res.json({ valid: true });
  });

  // Change secret passcode (requires authenticated Firebase Admin + valid gate token)
  app.post('/api/admin/change-passcode', requireAdminAuth, (req, res) => {
    const envCode = process.env.ADMIN_PASSCODE?.trim();
    if (envCode) {
      res.status(400).json({ error: 'Msimbo wa siri unadhibitiwa na Environment Secret (ADMIN_PASSCODE).' });
      return;
    }
    const token = typeof req.headers['x-admin-gate'] === 'string' ? req.headers['x-admin-gate'] : '';
    if (!verifyGateToken(token)) {
      res.status(401).json({ error: 'Uthibitisho wa msimbo wa siri unahitajika.' });
      return;
    }
    const newPasscode = typeof req.body?.newPasscode === 'string' ? req.body.newPasscode.trim() : '';
    if (newPasscode.length < 4 || newPasscode.length > 64) {
      res.status(400).json({ error: 'Msimbo mpya lazima uwe na herufi/namba 4 hadi 64.' });
      return;
    }
    const record = hashPasscode(newPasscode);
    fs.writeFileSync(ADMIN_SECRET_FILE, JSON.stringify(record), { mode: 0o600 });
    res.json({ ok: true, gateToken: createGateToken() });
  });

  // Default eBook info endpoint
  app.get('/api/default-ebook', (_req, res) => {
    const stat = fs.statSync(defaultPdfPath);
    res.json({
      fileName: DEFAULT_EBOOK_FILENAME,
      fileSize: stat.size,
      pdfUrl: `/api/files/ebooks/${DEFAULT_EBOOK_FILENAME}`,
    });
  });

  // Upload PDF (Admin only)
  app.post('/api/upload/pdf', requireAdminAuth, (req, res) => {
    pdfUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Imeshindwa kupakia faili la PDF.';
        res.status(400).json({ error: message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Hakuna faili la PDF lililochaguliwa.' });
        return;
      }

      // Verify %PDF- header bytes so Android octet-stream uploads are safely validated
      try {
        const fd = fs.openSync(req.file.path, 'r');
        const buf = Buffer.alloc(1024);
        const bytesRead = fs.readSync(fd, buf, 0, 1024, 0);
        fs.closeSync(fd);
        const head = buf.subarray(0, bytesRead).toString('latin1');
        if (!head.includes('%PDF-')) {
          fs.unlinkSync(req.file.path);
          res.status(400).json({ error: 'Faili lililochaguliwa si PDF halisi. Tafadhali chagua faili la .pdf.' });
          return;
        }
      } catch {
        // Ignore read verification error if file was created properly
      }

      const rawName = req.file.originalname || req.file.filename;
      const normalizedName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;

      res.json({
        url: `/api/files/ebooks/${req.file.filename}`,
        fileName: normalizedName,
        storedFileName: req.file.filename,
        fileSize: req.file.size,
      });
    });
  });

  // Upload Image for logo, welcome image, slide, or eBook cover (Admin only)
  app.post('/api/upload/image', requireAdminAuth, (req, res) => {
    imageUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Image upload failed';
        res.status(400).json({ error: message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }
      res.json({
        url: `/api/files/images/${req.file.filename}`,
        fileName: req.file.filename,
        fileSize: req.file.size,
      });
    });
  });

  // Serve PDF files safely (inline or download)
  app.get('/api/files/ebooks/:filename', (req, res) => {
    const filePath = resolveConfinedPath(EBOOKS_DIR, req.params.filename);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: 'PDF file not found' });
      return;
    }
    const isDownload = req.query.download === '1';
    const rawDisplay = typeof req.query.name === 'string' ? req.query.name : req.params.filename;
    const safeDisplay = rawDisplay.replace(/[^a-zA-Z0-9._\-\s]/g, '').trim() || req.params.filename;
    const finalName = safeDisplay.toLowerCase().endsWith('.pdf') ? safeDisplay : `${safeDisplay}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${finalName}"`
    );
    res.sendFile(filePath);
  });

  // Serve uploaded images safely
  app.get('/api/files/images/:filename', (req, res) => {
    const filePath = resolveConfinedPath(IMAGES_DIR, req.params.filename);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Image file not found' });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  });

  // Dynamic VCF Contact Card Download (Android/iOS friendly)
  app.get('/api/contact-card.vcf', (req, res) => {
    const clean = (val: unknown, fallback: string, maxLen = 120) => {
      if (typeof val !== 'string' || !val.trim()) return fallback;
      return val.replace(/[\r\n;]/g, ' ').trim().slice(0, maxLen);
    };

    const name = clean(req.query.name, 'Dr. Revo - JOS NATURAL HERBS');
    const phoneLocal = clean(req.query.phone, '0652421286', 40);
    const phoneIntl = clean(req.query.intl, '+255652421286', 40);
    const org = clean(req.query.org, 'JOS NATURAL HERBS');
    const note = clean(
      req.query.note,
      'Elimu ya Afya ya Mfumo wa Chakula - JOS HEALTH KNOWLEDGE HUB',
      300
    );

    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name}`,
      `N:Revo;Dr.;;;`,
      `ORG:${org}`,
      `TITLE:Health Education & Natural Wellness`,
      `TEL;TYPE=CELL,VOICE:${phoneIntl}`,
      `TEL;TYPE=WORK,VOICE:${phoneLocal}`,
      `NOTE:${note}`,
      'END:VCARD',
      '',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Dr_Revo_JOS_NATURAL_HERBS.vcf"');
    res.send(vcf);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JOS HEALTH KNOWLEDGE HUB running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
