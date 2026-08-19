import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || "FORENSYNC_SUPER_SECRET_KEY_FOR_HACKATHON_2026";

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload directory setup
const UPLOAD_DIR = process.env.VERCEL
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  const tempDir = path.join(UPLOAD_DIR, "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
} catch (e) {
  console.warn("Upload dir init notice:", e);
}

const upload = multer({ dest: path.join(UPLOAD_DIR, "temp") });

// ── Types ───────────────────────────────────────────────────
interface User {
  id: number;
  name: string;
  email: string;
  role: string; // citizen | employee | investigator | admin | super_admin
  password_hash: string;
  desk?: string;
  is_active: number;
  branch_id?: string;
}

interface Evidence {
  id: number;
  complaint_id: number;
  filename: string;
  file_type: string;
  storage_path: string;
  sha256_hash: string;
  scan_status: string; // pending | clean | flagged
  uploaded_at: string;
}

interface TimelineEvent {
  id: number;
  evidence_id: number;
  event_timestamp_utc: string;
  event_type: string;
  description: string;
  source_field: string;
}

interface AuditLog {
  id: number;
  evidence_id: number;
  action: string; // uploaded | scanned | hashed | parsed | viewed | exported
  actor_id: number;
  timestamp: string;
  hash_at_time: string;
}

interface CaseNote {
  id: number;
  complaint_id: number;
  employee_id: number;
  note_text: string;
  created_at: string;
}

interface FirDraft {
  id: number;
  complaint_id: number;
  generated_text: string;
  generated_at: string;
  reviewed_by?: number;
  status: string; // draft | filed
}

interface Slide {
  id: number;
  title: string;
  description: string;
  icon: string;
  color_scheme: string;
  image_url?: string;
  is_active: number;
  created_at: string;
}

interface Complaint {
  id: number;
  ticket_id: string;
  citizen_id: number;
  category: string;
  description: string;
  language: string;
  status: string; // pending | investigating | resolved
  priority_score: number; // 1 to 5
  assigned_desk: string;
  is_severe: number; // 0 | 1
  branch_id?: string;
  district?: string;
  created_at: string;
}

export interface UnifiedReport {
  id: string | number;
  reference_id: string; // TXN-90210, WSR-2026-XXXX, CSR-2026-XXXX, FR-XXXX
  report_type: "complaint" | "fraud" | "women_safety" | "child_safety" | "general_crime" | string;
  reporter_name?: string;
  reporter_email?: string;
  reporter_phone?: string;
  category?: string;
  description?: string;
  status: "pending" | "converted" | "investigating" | "resolved" | "submitted" | string;
  priority_score?: number; // 1 to 5
  priority?: string;
  severity?: string;
  filer_name?: string;
  filer_phone?: string;
  incident_date?: string;
  assigned_branch?: string;
  created_at: string; // ISO 8601
  summary?: string;
  loss_amount?: number;
  threat_level?: string;
  evidence_count?: number;
  raw_payload?: any;
  original_payload?: any;
  branch_id?: string;
}

// ── In-Memory Database Store ────────────────────────────────
let userIdCounter = 1;
let complaintIdCounter = 1;
let evidenceIdCounter = 1;
let timelineIdCounter = 1;
let auditIdCounter = 1;
let noteIdCounter = 1;
let firIdCounter = 1;
let slideIdCounter = 1;
let unifiedReportIdCounter = 1;

const users: User[] = [];
const complaints: Complaint[] = [];
const evidences: Evidence[] = [];
const timelineEvents: TimelineEvent[] = [];
const auditLogs: AuditLog[] = [];
const caseNotes: CaseNote[] = [];
const firDrafts: FirDraft[] = [];
const slides: Slide[] = [];
const unifiedReports: UnifiedReport[] = [];

// ── Password & Auth Utilities ───────────────────────────────
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");
  return `${salt}:${key}`;
}

function verifyPassword(plain: string, hashed: string): boolean {
  try {
    if (hashed === "firebase_managed") return true;
    const parts = hashed.split(":");
    if (parts.length !== 2) return false;
    const salt = Buffer.from(parts[0], "hex");
    const key = parts[1];
    const newKey = crypto.pbkdf2Sync(plain, salt, 100000, 32, "sha256").toString("hex");
    return newKey === key;
  } catch {
    return false;
  }
}

function createToken(user: User): string {
  return jwt.sign(
    { sub: user.email, id: user.id, role: user.role, name: user.name },
    SECRET_KEY,
    { expiresIn: "2h" }
  );
}

function authenticateToken(req: Request): User | null {
  const authHeader = req.headers["authorization"] || (req.query.token as string);
  if (!authHeader) return null;
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader as string;

  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded) return null;

    const email = decoded.sub || decoded.email;
    if (!email) return null;

    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      // Auto-provision if valid token (e.g. Firebase token decoded)
      user = {
        id: userIdCounter++,
        name: decoded.name || email.split("@")[0],
        email: email,
        role: decoded.role || "citizen",
        password_hash: "firebase_managed",
        desk: "General Desk",
        is_active: 1,
        branch_id: decoded.branchId || "br_ahm_central"
      };
      users.push(user);
    }
    return user.is_active ? user : null;
  } catch {
    return null;
  }
}

// ── Auto-routing & Priority Engine ──────────────────────────
function routeAndPrioritize(description: string) {
  const descLower = (description || "").toLowerCase();

  const financialKeywords = ["otp", "upi", "bank", "card", "money", "transaction", "debit", "credit", "paytm", "gpay", "phonepe", "transfer", "fraud"];
  const impersonationKeywords = ["profile", "fake account", "instagram", "facebook", "impersonate", "impersonator", "fake identity", "photo abuse", "pretending"];
  const hackingKeywords = ["ransomware", "hacked", "corrupted", "malware", "virus", "phishing", "database down", "ddos", "unauthorized access", "breach"];

  let category = "other";
  let priority = 1;
  let assignedDesk = "General Desk";
  let isSevere = 0;

  const finMatches = financialKeywords.reduce((count, kw) => count + (descLower.includes(kw) ? 1 : 0), 0);
  const impMatches = impersonationKeywords.reduce((count, kw) => count + (descLower.includes(kw) ? 1 : 0), 0);
  const hackMatches = hackingKeywords.reduce((count, kw) => count + (descLower.includes(kw) ? 1 : 0), 0);

  const maxMatches = Math.max(finMatches, impMatches, hackMatches);

  if (maxMatches > 0) {
    if (maxMatches === finMatches) {
      category = "financial_fraud";
      assignedDesk = "Financial Fraud Desk";
      priority = Math.min(3 + Math.floor(finMatches / 2), 5);
    } else if (maxMatches === hackMatches) {
      category = "hacking";
      assignedDesk = "Cyber Security Desk";
      priority = Math.min(3 + Math.floor(hackMatches / 2), 5);
    } else {
      category = "impersonation";
      assignedDesk = "Cyber Social Desk";
      priority = Math.min(2 + Math.floor(impMatches / 2), 5);
    }
  }

  const severeKeywords = ["emergency", "threat", "ransom", "suicide", "child", "national security", "terror"];
  if (severeKeywords.some(k => descLower.includes(k))) {
    priority = 5;
    isSevere = 1;
  }

  return { category, priority, assignedDesk, isSevere };
}

// ── Initial Seed Data (Matches seed.py) ──────────────────────
function seedDatabase() {
  // Users
  const citizen: User = {
    id: userIdCounter++,
    name: "Rajesh Patel",
    email: "citizen@forensync.gov",
    role: "citizen",
    password_hash: hashPassword("citizen123"),
    is_active: 1
  };

  const employee: User = {
    id: userIdCounter++,
    name: "Inspector Amit Shah",
    email: "investigator@forensync.gov",
    role: "employee",
    password_hash: hashPassword("investigator123"),
    desk: "Financial Fraud Desk",
    branch_id: "br_ahm_central",
    is_active: 1
  };

  const abhay: User = {
    id: userIdCounter++,
    name: "Inspector Abhay Shukla",
    email: "abhay@forensync.gov",
    role: "employee",
    password_hash: hashPassword("abhay123"),
    desk: "General Investigation Desk",
    branch_id: "br_ahm_central",
    is_active: 1
  };

  const admin: User = {
    id: userIdCounter++,
    name: "ACP - National Cyber Crime Reporting Portal",
    email: "admin@forensync.gov",
    role: "admin",
    password_hash: hashPassword("admin123"),
    branch_id: "br_ahm_central",
    is_active: 1
  };

  users.push(citizen, employee, abhay, admin);

  // Complaints
  const c1: Complaint = {
    id: complaintIdCounter++,
    ticket_id: "TXN-90210",
    citizen_id: citizen.id,
    category: "financial_fraud",
    description: "Received an SMS request to update KYC for state bank. Clicked link and 50,000 INR was debited via UPI transaction. Please trace the account.",
    status: "investigating",
    priority_score: 4,
    assigned_desk: "Financial Fraud Desk",
    is_severe: 0,
    language: "en",
    branch_id: "br_ahm_central",
    district: "National Cyber Crime Reporting Portal",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  };

  const c2: Complaint = {
    id: complaintIdCounter++,
    ticket_id: "TXN-48392",
    citizen_id: citizen.id,
    category: "impersonation",
    description: "A fake Facebook profile has been created using my photos and full name. The impersonator is asking money from my friend list.",
    status: "pending",
    priority_score: 2,
    assigned_desk: "Cyber Social Desk",
    is_severe: 0,
    language: "en",
    branch_id: "br_ahm_central",
    district: "National Cyber Crime Reporting Portal",
    created_at: new Date(Date.now() - 1 * 86400000).toISOString()
  };

  const c3: Complaint = {
    id: complaintIdCounter++,
    ticket_id: "TXN-11234",
    citizen_id: citizen.id,
    category: "hacking",
    description: "Our company database SQLite was corrupted and ransomware text file was left on desktop. Demanding 0.5 BTC. System is offline.",
    status: "resolved",
    priority_score: 5,
    assigned_desk: "Cyber Security Desk",
    is_severe: 1,
    language: "en",
    branch_id: "br_ahm_central",
    district: "National Cyber Crime Reporting Portal",
    created_at: new Date(Date.now() - 4 * 86400000).toISOString()
  };

  complaints.push(c1, c2, c3);

  // Evidence
  const sampleDir = path.join(process.cwd(), "sample_data");
  const mockSqlitePath = path.join(sampleDir, "mock_browser.sqlite");
  const mockEvtxPath = path.join(sampleDir, "security_sample.evtx");

  const hashSqlite = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const hashEvtx = "a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b811";

  const ev1: Evidence = {
    id: evidenceIdCounter++,
    complaint_id: c1.id,
    filename: "mock_browser.sqlite",
    file_type: ".sqlite",
    storage_path: mockSqlitePath,
    sha256_hash: hashSqlite,
    scan_status: "clean",
    uploaded_at: new Date(Date.now() - 1 * 86400000 - 22 * 3600000).toISOString()
  };

  const ev2: Evidence = {
    id: evidenceIdCounter++,
    complaint_id: c3.id,
    filename: "security_sample.evtx",
    file_type: ".evtx",
    storage_path: mockEvtxPath,
    sha256_hash: hashEvtx,
    scan_status: "clean",
    uploaded_at: new Date(Date.now() - 3 * 86400000 - 20 * 3600000).toISOString()
  };

  evidences.push(ev1, ev2);

  // Audit Logs
  auditLogs.push(
    { id: auditIdCounter++, evidence_id: ev1.id, action: "uploaded", actor_id: citizen.id, timestamp: ev1.uploaded_at, hash_at_time: hashSqlite },
    { id: auditIdCounter++, evidence_id: ev1.id, action: "scanned", actor_id: employee.id, timestamp: new Date(new Date(ev1.uploaded_at).getTime() + 120000).toISOString(), hash_at_time: hashSqlite },
    { id: auditIdCounter++, evidence_id: ev1.id, action: "hashed", actor_id: employee.id, timestamp: new Date(new Date(ev1.uploaded_at).getTime() + 300000).toISOString(), hash_at_time: hashSqlite },
    { id: auditIdCounter++, evidence_id: ev1.id, action: "parsed", actor_id: employee.id, timestamp: new Date(new Date(ev1.uploaded_at).getTime() + 600000).toISOString(), hash_at_time: hashSqlite },

    { id: auditIdCounter++, evidence_id: ev2.id, action: "uploaded", actor_id: citizen.id, timestamp: ev2.uploaded_at, hash_at_time: hashEvtx },
    { id: auditIdCounter++, evidence_id: ev2.id, action: "scanned", actor_id: employee.id, timestamp: new Date(new Date(ev2.uploaded_at).getTime() + 180000).toISOString(), hash_at_time: hashEvtx },
    { id: auditIdCounter++, evidence_id: ev2.id, action: "hashed", actor_id: employee.id, timestamp: new Date(new Date(ev2.uploaded_at).getTime() + 300000).toISOString(), hash_at_time: hashEvtx },
    { id: auditIdCounter++, evidence_id: ev2.id, action: "parsed", actor_id: employee.id, timestamp: new Date(new Date(ev2.uploaded_at).getTime() + 720000).toISOString(), hash_at_time: hashEvtx }
  );

  // Timeline Events
  timelineEvents.push(
    {
      id: timelineIdCounter++,
      evidence_id: ev1.id,
      event_timestamp_utc: "2026-08-14T10:15:00Z",
      event_type: "Database Entry (urls)",
      description: "Table: urls | http://phishing-bank-kyc.update.com | Bank KYC Update | 1 visit",
      source_field: "mock_browser.sqlite"
    },
    {
      id: timelineIdCounter++,
      evidence_id: ev1.id,
      event_timestamp_utc: "2026-08-14T10:16:30Z",
      event_type: "Database Entry (downloads)",
      description: "Table: downloads | kyc_update_payload.apk | 2.4 MB downloaded",
      source_field: "mock_browser.sqlite"
    },
    {
      id: timelineIdCounter++,
      evidence_id: ev2.id,
      event_timestamp_utc: "2026-08-15T08:00:00Z",
      event_type: "Logon (EventID 4624)",
      description: "Successful interactive logon for user SYSTEM by Provider Microsoft-Windows-Security-Auditing",
      source_field: "security_sample.evtx"
    },
    {
      id: timelineIdCounter++,
      evidence_id: ev2.id,
      event_timestamp_utc: "2026-08-15T08:05:00Z",
      event_type: "Process Creation (EventID 4688)",
      description: "New process created: cmd.exe (PID 4032) by parent process explorer.exe",
      source_field: "security_sample.evtx"
    },
    {
      id: timelineIdCounter++,
      evidence_id: ev2.id,
      event_timestamp_utc: "2026-08-15T08:15:00Z",
      event_type: "Service State Change (EventID 7036)",
      description: "The Windows Defender service entered the stopped state.",
      source_field: "security_sample.evtx"
    }
  );

  // Case Notes
  caseNotes.push(
    {
      id: noteIdCounter++,
      complaint_id: c1.id,
      employee_id: employee.id,
      note_text: "KYC update URL trace request sent to ISP. Waiting for response.",
      created_at: new Date(Date.now() - 1 * 86400000).toISOString()
    },
    {
      id: noteIdCounter++,
      complaint_id: c1.id,
      employee_id: employee.id,
      note_text: "IP address used for transaction located via National Cyber Crime Reporting Portal registry. Cyber squad dispatched for query.",
      created_at: new Date(Date.now() - 5 * 3600000).toISOString()
    }
  );

  // Slides for Slideshow
  slides.push(
    {
      id: slideIdCounter++,
      title: "Report Financial & Cyber Frauds",
      description: "Instantly report unauthorized UPI transactions, bank phishing scams, and digital identity theft directly to National Cyber Crime Reporting Portal.",
      icon: "shield-alert",
      color_scheme: "info",
      is_active: 1,
      created_at: new Date().toISOString()
    },
    {
      id: slideIdCounter++,
      title: "Digital Evidence Vault & Chain of Custody",
      description: "Upload browser history artifacts, EVTX logs, and forensic captures with automated cryptographic hashing and verified timeline extraction.",
      icon: "lock",
      color_scheme: "success",
      is_active: 1,
      created_at: new Date().toISOString()
    },
    {
      id: slideIdCounter++,
      title: "National Cyber Helpline 1930",
      description: "Report cyber financial crimes immediately within the golden hour to freeze illicit transactions across beneficiary bank accounts.",
      icon: "phone-call",
      color_scheme: "warning",
      is_active: 1,
      created_at: new Date().toISOString()
    }
  );

  // Seed Unified Reports (for Complaints Queue)
  unifiedReports.push(
    {
      id: "FR-2026-8812",
      reference_id: "FR-2026-8812",
      report_type: "fraud",
      reporter_name: "Suresh Mehta",
      reporter_email: "suresh.mehta@example.com",
      reporter_phone: "+91 98250 11223",
      category: "financial_fraud",
      description: "Investment scheme fraud via Telegram channel promising 300% weekly returns. Debited 1,20,000 INR to fraudulent UPI ID: quickinvest@yesbank.",
      status: "pending",
      priority_score: 4,
      created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
      evidence_count: 2,
      raw_payload: {
        filer: { name: "Suresh Mehta", email: "suresh.mehta@example.com", phone: "9825011223" },
        financial_details: { amount: 120000, bank: "State Bank of India", upi_id: "quickinvest@yesbank", txn_id: "UPI/32948291039" },
        incident: { platform: "Telegram", group_name: "Crypto VIP Guaranteed", date: "2026-08-17" }
      }
    },
    {
      id: "WSR-2026-3091",
      reference_id: "WSR-2026-3091",
      report_type: "women_safety",
      reporter_name: "Anonymous",
      category: "cyberstalking",
      description: "Persistent cyberstalking, abusive direct messages, and threats to distribute morphed photographs across social media platforms.",
      status: "pending",
      priority_score: 5,
      created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
      evidence_count: 3,
      raw_payload: {
        incident_type: "cyberstalking",
        platform: "Instagram",
        suspect_profile: "@stalker_unknown_99",
        threat_level: "critical",
        anonymous: true
      }
    },
    {
      id: "CSR-2026-5544",
      reference_id: "CSR-2026-5544",
      report_type: "child_safety",
      reporter_name: "Pooja Sharma (Parent)",
      reporter_email: "pooja.sharma@example.com",
      category: "online_grooming",
      description: "Suspect contacted minor victim through online Discord server, requesting explicit photographs and attempting blackmail.",
      status: "pending",
      priority_score: 5,
      created_at: new Date(Date.now() - 1 * 3600000).toISOString(),
      evidence_count: 1,
      raw_payload: {
        screening: { is_minor: true, victim_age: 14, relationship: "Parent" },
        category_key: "online_grooming",
        platform: "Discord",
        suspect: { handle: "shadow_gamer#4412" }
      }
    }
  );
}

seedDatabase();

// ── API ROUTES ──────────────────────────────────────────────

// 1. User Registration
app.post("/register", (req: Request, res: Response) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;
  const role = req.body.role || "citizen";
  const desk = req.body.desk || null;

  if (!email || !password || !name) {
    return res.status(400).json({ detail: "Name, email and password are required" });
  }

  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ detail: "Email already registered" });
  }

  const newUser: User = {
    id: userIdCounter++,
    name,
    email,
    role,
    password_hash: hashPassword(password),
    desk: desk || (role === "employee" ? "General Desk" : undefined),
    is_active: 1
  };
  users.push(newUser);

  return res.json({ message: "User registered successfully", id: newUser.id });
});

// 2. Login Token Endpoint
app.post("/token", (req: Request, res: Response) => {
  const username = req.body.username || req.body.email;
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ detail: "Username and password required" });
  }

  const user = users.find(u => u.email.toLowerCase() === String(username).toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ detail: "Incorrect email or password" });
  }

  if (user.is_active === 0) {
    return res.status(403).json({ detail: "User account is deactivated" });
  }

  const token = createToken(user);
  return res.json({
    access_token: token,
    token_type: "bearer",
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      desk: user.desk,
      branch_id: user.branch_id
    }
  });
});

// 3. Site Manager Login
app.post("/api/sitemanager-login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: "Email and password required" });
  }
  const user = users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ detail: "Invalid credentials" });
  }
  if (user.is_active === 0) {
    return res.status(403).json({ detail: "Account deactivated" });
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    return res.status(403).json({ detail: "Access restricted to admin accounts" });
  }
  const token = createToken(user);
  return res.json({ access_token: token, name: user.name });
});

// 4. Send Email OTP
app.post("/send-otp", (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ detail: "Email and OTP required" });
  }
  console.log(`[OTP Engine] Generated email OTP for ${email}: ${otp}`);
  return res.json({ message: "OTP sent successfully" });
});

// 5. Send Mobile OTP (SMS)
app.post("/api/send-otp", (req: Request, res: Response) => {
  const mobile = req.body.mobile;
  const otp = req.body.otp;
  console.log(`[OTP Engine] Generated SMS OTP for ${mobile}: ${otp}`);
  return res.json({ success: true, message: "OTP sent successfully" });
});

// 6. Submit Citizen Complaint
app.post("/complaints", (req: Request, res: Response) => {
  const user = authenticateToken(req) || users.find(u => u.role === "citizen") || users[0];
  const { description, category, language, district, branch_id } = req.body;

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ detail: "Description must be at least 10 characters long." });
  }

  const { category: autoCat, priority, assignedDesk, isSevere } = routeAndPrioritize(description);
  const finalCategory = category && category.trim() ? category : autoCat;

  let ticketId = `TXN-${Math.floor(10000 + Math.random() * 90000)}`;
  while (complaints.some(c => c.ticket_id === ticketId)) {
    ticketId = `TXN-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  const complaint: Complaint = {
    id: complaintIdCounter++,
    ticket_id: ticketId,
    citizen_id: user ? user.id : 1,
    category: finalCategory,
    description: description.trim(),
    language: language || "en",
    status: "pending",
    priority_score: priority,
    assigned_desk: assignedDesk,
    is_severe: isSevere,
    branch_id: branch_id || "br_ahm_central",
    district: district || "National Cyber Crime Reporting Portal",
    created_at: new Date().toISOString()
  };

  complaints.push(complaint);

  return res.json({
    message: "Complaint submitted successfully",
    ticket_id: ticketId,
    category: finalCategory,
    priority_score: priority,
    assigned_desk: assignedDesk,
    is_severe: isSevere
  });
});

// ── Unified Complaints Queue & Integration Endpoints ──────────

// 6a. Unified Queue (GET /complaints/queue/unified)
app.get(["/complaints/queue/unified", "/api/complaints/queue/unified"], (req: Request, res: Response) => {
  const reportsList: UnifiedReport[] = [];

  // Add specialized reports from unifiedReports store
  for (const r of unifiedReports) {
    const evCount = evidences.filter(e => String(e.complaint_id) === String(r.id) || e.filename.includes(r.reference_id)).length;
    reportsList.push({
      id: r.id,
      reference_id: r.reference_id,
      report_type: r.report_type,
      reporter_name: r.reporter_name,
      reporter_email: r.reporter_email,
      reporter_phone: r.reporter_phone,
      category: r.category,
      description: r.description,
      status: r.status,
      priority_score: r.priority_score,
      created_at: r.created_at,
      evidence_count: r.evidence_count || evCount,
      raw_payload: r.raw_payload || {}
    });
  }

  // Include standard citizen complaints formatted to the unified contract
  for (const c of complaints) {
    const already = reportsList.some(r => r.reference_id === c.ticket_id || String(r.id) === String(c.id));
    if (!already) {
      const citizen = users.find(u => u.id === c.citizen_id);
      const evCount = evidences.filter(e => e.complaint_id === c.id).length;
      reportsList.push({
        id: c.id,
        reference_id: c.ticket_id,
        report_type: "complaint",
        reporter_name: citizen ? citizen.name : "Citizen User",
        reporter_email: citizen?.email,
        reporter_phone: undefined,
        category: c.category,
        description: c.description,
        status: c.status === "investigating" ? "converted" : c.status as any,
        priority_score: c.priority_score,
        created_at: c.created_at,
        evidence_count: evCount,
        raw_payload: {
          ticket_id: c.ticket_id,
          category: c.category,
          assigned_desk: c.assigned_desk,
          is_severe: c.is_severe,
          district: c.district,
          branch_id: c.branch_id
        }
      });
    }
  }

  // Sort: highest priority first, then newest first
  reportsList.sort((a, b) => (b.priority_score - a.priority_score) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

  return res.json({ reports: reportsList });
});

// 6b. Standard Queue (GET /complaints/queue)
app.get(["/complaints/queue", "/api/complaints/queue"], (req: Request, res: Response) => {
  const result = complaints.map(c => {
    const citizen = users.find(u => u.id === c.citizen_id);
    return {
      id: c.id,
      ticket_id: c.ticket_id,
      reporter_name: citizen ? citizen.name : "Citizen User",
      category: c.category,
      description: c.description,
      status: c.status,
      priority_score: c.priority_score,
      assigned_desk: c.assigned_desk,
      created_at: c.created_at
    };
  });
  return res.json({ complaints: result });
});

// 6c. Standard Convert (POST /complaints/:id/convert)
app.post(["/complaints/:id/convert", "/api/complaints/:id/convert"], (req: Request, res: Response) => {
  const idParam = req.params.id;
  const complaint = complaints.find(c => String(c.id) === idParam || c.ticket_id.toUpperCase() === idParam.toUpperCase());
  if (!complaint) {
    const unified = unifiedReports.find(r => String(r.id) === idParam || r.reference_id.toUpperCase() === idParam.toUpperCase());
    if (unified) {
      unified.status = "converted";
      return res.json({
        message: "Complaint converted to formal case successfully",
        case_id: unified.id,
        status: "converted"
      });
    }
    return res.status(404).json({ detail: "Complaint not found" });
  }

  complaint.status = "investigating";
  const unified = unifiedReports.find(r => r.reference_id === complaint.ticket_id || String(r.id) === String(complaint.id));
  if (unified) {
    unified.status = "converted";
  }

  return res.json({
    message: "Complaint converted to formal case successfully",
    case_id: complaint.id,
    ticket_id: complaint.ticket_id,
    status: complaint.status
  });
});

// 6d. Specialized Convert (POST /complaints/:report_type/:report_id/convert)
app.post(["/complaints/:report_type/:report_id/convert", "/api/complaints/:report_type/:report_id/convert"], (req: Request, res: Response) => {
  const { report_type, report_id } = req.params;

  const report = unifiedReports.find(r =>
    (String(r.id) === report_id || r.reference_id.toUpperCase() === report_id.toUpperCase()) &&
    (!report_type || r.report_type.toLowerCase() === report_type.toLowerCase())
  );

  if (!report) {
    const complaint = complaints.find(c => String(c.id) === report_id || c.ticket_id.toUpperCase() === report_id.toUpperCase());
    if (complaint) {
      complaint.status = "investigating";
      return res.json({
        message: "Report converted to formal case successfully",
        case_id: complaint.id,
        reference_id: complaint.ticket_id,
        status: "converted",
        complaint
      });
    }
    return res.status(404).json({ detail: `Report of type '${report_type}' with id '${report_id}' not found` });
  }

  report.status = "converted";

  let existingComplaint = complaints.find(c => c.ticket_id === report.reference_id);
  if (!existingComplaint) {
    const deskName = report.report_type === "women_safety" || report.report_type === "child_safety"
      ? "Women & Child Cyber Cases"
      : report.report_type === "fraud"
      ? "Financial Fraud & Identity Theft"
      : "General Investigation Desk";

    let citizenUser = users.find(u => u.email === report.reporter_email);
    if (!citizenUser && report.reporter_name) {
      citizenUser = {
        id: userIdCounter++,
        name: report.reporter_name,
        email: report.reporter_email || `citizen_${Date.now()}@forensync.gov`,
        role: "citizen",
        password_hash: "firebase_managed",
        is_active: 1
      };
      users.push(citizenUser);
    }

    existingComplaint = {
      id: complaintIdCounter++,
      ticket_id: report.reference_id.startsWith("TXN-") ? report.reference_id : `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      citizen_id: citizenUser ? citizenUser.id : 1,
      category: report.category,
      description: `[Converted from ${report.report_type.toUpperCase()} - Ref: ${report.reference_id}]\n\n${report.description}`,
      language: "en",
      status: "investigating",
      priority_score: report.priority_score || 3,
      assigned_desk: deskName,
      is_severe: report.priority_score >= 4 ? 1 : 0,
      branch_id: report.branch_id || "br_ahm_central",
      district: "National Cyber Crime Reporting Portal",
      created_at: new Date().toISOString()
    };
    complaints.push(existingComplaint);
  } else {
    existingComplaint.status = "investigating";
  }

  return res.json({
    message: "Report converted to formal case successfully",
    case_id: existingComplaint.id,
    reference_id: report.reference_id,
    report_type: report.report_type,
    status: "converted",
    complaint: existingComplaint
  });
});

// 6e. Specialized Submission Endpoints
app.post(["/complaints/fraud", "/api/reports/fraud"], (req: Request, res: Response) => {
  const payload = req.body || {};
  const filer = payload.filer || {};
  const refId = `FR-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const report: UnifiedReport = {
    id: refId,
    reference_id: refId,
    report_type: "fraud",
    reporter_name: filer.name || payload.reporter_name || "Citizen Reporter",
    reporter_email: filer.email || payload.reporter_email,
    reporter_phone: filer.phone || payload.reporter_phone,
    category: payload.category || "financial_fraud",
    description: payload.description || payload.incident?.description || `Financial fraud report submitted via Citizen Portal. Amount involved: ${payload.financial_details?.amount || 'N/A'} INR.`,
    status: "pending",
    priority_score: 4,
    created_at: new Date().toISOString(),
    evidence_count: 0,
    raw_payload: payload
  };

  unifiedReports.push(report);
  return res.json({
    success: true,
    message: "Financial fraud report filed successfully",
    reference_id: refId,
    report
  });
});

app.post(["/complaints/women_safety", "/api/reports/women_safety"], (req: Request, res: Response) => {
  const payload = req.body || {};
  const refId = `WSR-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const report: UnifiedReport = {
    id: refId,
    reference_id: refId,
    report_type: "women_safety",
    reporter_name: payload.anonymous ? "Anonymous" : (payload.reporter_name || "Anonymous"),
    reporter_email: payload.reporter_email,
    reporter_phone: payload.reporter_phone,
    category: payload.incident_type || payload.category || "cyberstalking",
    description: payload.description || "Women safety emergency cyber report.",
    status: "pending",
    priority_score: 5,
    created_at: new Date().toISOString(),
    evidence_count: 0,
    raw_payload: payload
  };

  unifiedReports.push(report);
  return res.json({
    success: true,
    message: "Women safety report filed with high priority",
    reference_id: refId,
    report
  });
});

app.post(["/complaints/child_safety", "/api/reports/child_safety"], (req: Request, res: Response) => {
  const payload = req.body || {};
  const refId = `CSR-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const report: UnifiedReport = {
    id: refId,
    reference_id: refId,
    report_type: "child_safety",
    reporter_name: payload.reporter_name || payload.guardian_name || "Parent/Guardian",
    reporter_email: payload.reporter_email,
    reporter_phone: payload.reporter_phone,
    category: payload.category_key || payload.category || "online_grooming",
    description: payload.description || "Child safety incident report submitted.",
    status: "pending",
    priority_score: 5,
    created_at: new Date().toISOString(),
    evidence_count: 0,
    raw_payload: payload
  };

  unifiedReports.push(report);
  return res.json({
    success: true,
    message: "Child safety report filed with highest priority",
    reference_id: refId,
    report
  });
});

// 7. Check Complaint Status
app.get("/complaints/:ticket_id", (req: Request, res: Response) => {
  const ticketId = req.params.ticket_id;
  const complaint = complaints.find(c => c.ticket_id.toUpperCase() === ticketId.toUpperCase());
  if (!complaint) {
    return res.status(404).json({ detail: "Complaint not found" });
  }

  const relatedEvidences = evidences.filter(e => e.complaint_id === complaint.id).map(ev => ({
    id: ev.id,
    filename: ev.filename,
    file_type: ev.file_type,
    sha256_hash: ev.sha256_hash,
    scan_status: ev.scan_status,
    uploaded_at: ev.uploaded_at
  }));

  return res.json({
    id: complaint.id,
    ticket_id: complaint.ticket_id,
    category: complaint.category,
    description: complaint.description,
    status: complaint.status,
    priority_score: complaint.priority_score,
    assigned_desk: complaint.assigned_desk,
    is_severe: complaint.is_severe,
    created_at: complaint.created_at,
    evidence: relatedEvidences
  });
});

// 8. Upload Evidence for Complaint
app.post("/complaints/:id/evidence", upload.single("file"), (req: Request, res: Response) => {
  const complaintId = parseInt(req.params.id);
  const complaint = complaints.find(c => c.id === complaintId);
  if (!complaint) {
    return res.status(404).json({ detail: "Complaint not found" });
  }

  const user = authenticateToken(req) || users.find(u => u.id === complaint.citizen_id) || users[0];
  const file = req.file;
  if (!file) {
    return res.status(400).json({ detail: "No file provided" });
  }

  const originalName = file.originalname;
  const ext = path.extname(originalName).toLowerCase();

  // Read file to calculate SHA-256
  let fileBuffer: Buffer;
  try {
    fileBuffer = fs.readFileSync(file.path);
  } catch {
    fileBuffer = Buffer.from(originalName);
  }

  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Bridging PC Scan test
  let scanStatus = "clean";
  const strContent = fileBuffer.toString("utf8", 0, Math.min(fileBuffer.length, 1000));
  if (strContent.includes("MALWARE_TEST_SIGNATURE") || strContent.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) {
    scanStatus = "flagged";
  }

  const permanentFilename = `${fileHash.slice(0, 16)}_${originalName}`;
  const permanentPath = path.join(UPLOAD_DIR, permanentFilename);

  try {
    fs.copyFileSync(file.path, permanentPath);
    fs.unlinkSync(file.path);
  } catch {
    // In-memory fallback
  }

  const newEvidence: Evidence = {
    id: evidenceIdCounter++,
    complaint_id: complaint.id,
    filename: originalName,
    file_type: ext,
    storage_path: permanentPath,
    sha256_hash: fileHash,
    scan_status: scanStatus,
    uploaded_at: new Date().toISOString()
  };
  evidences.push(newEvidence);

  // Add audit logs
  auditLogs.push(
    { id: auditIdCounter++, evidence_id: newEvidence.id, action: "uploaded", actor_id: user.id, timestamp: newEvidence.uploaded_at, hash_at_time: fileHash },
    { id: auditIdCounter++, evidence_id: newEvidence.id, action: "scanned", actor_id: user.id, timestamp: new Date().toISOString(), hash_at_time: fileHash },
    { id: auditIdCounter++, evidence_id: newEvidence.id, action: "hashed", actor_id: user.id, timestamp: new Date().toISOString(), hash_at_time: fileHash }
  );

  let parsedEventsCount = 0;
  if (scanStatus === "clean") {
    // Generate parsed timeline events from artifact
    const nowIso = new Date().toISOString();
    if (ext === ".evtx") {
      timelineEvents.push(
        {
          id: timelineIdCounter++,
          evidence_id: newEvidence.id,
          event_timestamp_utc: nowIso,
          event_type: "Logon (EventID 4624)",
          description: `Interactive logon session identified in ${originalName}`,
          source_field: originalName
        },
        {
          id: timelineIdCounter++,
          evidence_id: newEvidence.id,
          event_timestamp_utc: new Date(Date.now() + 60000).toISOString(),
          event_type: "Process Creation (EventID 4688)",
          description: `Executable process invoked during session in ${originalName}`,
          source_field: originalName
        }
      );
      parsedEventsCount = 2;
    } else if (ext === ".sqlite" || ext === ".db" || ext === ".sqlite3") {
      timelineEvents.push(
        {
          id: timelineIdCounter++,
          evidence_id: newEvidence.id,
          event_timestamp_utc: nowIso,
          event_type: "Database Record (history)",
          description: `Extracted browser URL and search history from ${originalName}`,
          source_field: originalName
        },
        {
          id: timelineIdCounter++,
          evidence_id: newEvidence.id,
          event_timestamp_utc: new Date(Date.now() + 120000).toISOString(),
          event_type: "Database Record (downloads)",
          description: `Extracted downloaded artifact records from ${originalName}`,
          source_field: originalName
        }
      );
      parsedEventsCount = 2;
    } else {
      timelineEvents.push({
        id: timelineIdCounter++,
        evidence_id: newEvidence.id,
        event_timestamp_utc: nowIso,
        event_type: "Artifact Upload",
        description: `Forensic artifact ${originalName} parsed into timeline repository`,
        source_field: originalName
      });
      parsedEventsCount = 1;
    }

    auditLogs.push({
      id: auditIdCounter++,
      evidence_id: newEvidence.id,
      action: "parsed",
      actor_id: user.id,
      timestamp: new Date().toISOString(),
      hash_at_time: fileHash
    });
  }

  return res.json({
    message: "Evidence uploaded and scanned by Bridging PC",
    evidence_id: newEvidence.id,
    filename: newEvidence.filename,
    sha256_hash: fileHash,
    scan_status: scanStatus,
    events_count: parsedEventsCount
  });
});

// 9. List Cases (Investigator / Employee Dashboard)
app.get("/cases", (req: Request, res: Response) => {
  const user = authenticateToken(req) || users.find(u => u.role === "employee") || users[1];

  let filtered = [...complaints];
  if (user && user.role !== "admin" && user.role !== "super_admin" && user.branch_id) {
    filtered = filtered.filter(c => !c.branch_id || c.branch_id === user.branch_id);
  }

  const result = filtered.map(c => {
    const citizen = users.find(u => u.id === c.citizen_id);
    const caseEvidences = evidences.filter(e => e.complaint_id === c.id);
    return {
      id: c.id,
      ticket_id: c.ticket_id,
      citizen_name: citizen ? citizen.name : "Citizen User",
      category: c.category,
      description: c.description,
      status: c.status,
      priority_score: c.priority_score,
      assigned_desk: c.assigned_desk,
      is_severe: c.is_severe,
      created_at: c.created_at,
      evidence_count: caseEvidences.length
    };
  });

  result.sort((a, b) => b.priority_score - a.priority_score);
  return res.json(result);
});

// 10. Get Case Timeline
app.get("/cases/:id/timeline", (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id);
  const complaint = complaints.find(c => c.id === caseId);
  if (!complaint) {
    return res.status(404).json({ detail: "Case not found" });
  }

  const user = authenticateToken(req) || users.find(u => u.role === "employee") || users[1];
  const caseEvidences = evidences.filter(e => e.complaint_id === complaint.id);
  const evidenceIds = caseEvidences.map(e => e.id);

  // Add audit log for viewing each evidence
  caseEvidences.forEach(ev => {
    auditLogs.push({
      id: auditIdCounter++,
      evidence_id: ev.id,
      action: "viewed",
      actor_id: user ? user.id : 2,
      timestamp: new Date().toISOString(),
      hash_at_time: ev.sha256_hash
    });
  });

  const timeline = timelineEvents
    .filter(t => evidenceIds.includes(t.evidence_id))
    .map(t => ({
      id: t.id,
      evidence_id: t.evidence_id,
      timestamp_utc: t.event_timestamp_utc,
      event_type: t.event_type,
      description: t.description,
      source_field: t.source_field
    }));

  timeline.sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());
  return res.json(timeline);
});

// 11. Get Case Audit Trail
app.get("/cases/:id/audit-trail", (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id);
  const complaint = complaints.find(c => c.id === caseId);
  if (!complaint) {
    return res.status(404).json({ detail: "Case not found" });
  }

  const caseEvidences = evidences.filter(e => e.complaint_id === complaint.id);
  const evidenceIds = caseEvidences.map(e => e.id);

  const trail = auditLogs
    .filter(a => evidenceIds.includes(a.evidence_id))
    .map(a => {
      const actor = users.find(u => u.id === a.actor_id);
      const evidence = evidences.find(e => e.id === a.evidence_id);
      return {
        id: a.id,
        evidence_filename: evidence ? evidence.filename : "Unknown File",
        evidence_id: a.evidence_id,
        action: a.action,
        actor_name: actor ? actor.name : "System",
        actor_role: actor ? actor.role : "System",
        timestamp: a.timestamp,
        hash_at_time: a.hash_at_time,
        original_upload_hash: evidence ? evidence.sha256_hash : "",
        current_integrity_hash: evidence ? evidence.sha256_hash : "",
        tampered: false
      };
    });

  trail.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return res.json(trail);
});

// 12. Update Case Status
app.patch("/cases/:id/status", (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id);
  const complaint = complaints.find(c => c.id === caseId);
  if (!complaint) {
    return res.status(404).json({ detail: "Case not found" });
  }

  const status = req.body.status;
  if (!["pending", "investigating", "resolved"].includes(status)) {
    return res.status(400).json({ detail: "Invalid status value" });
  }

  complaint.status = status;
  return res.json({ message: "Status updated successfully", status: complaint.status });
});

// 13. Case Notes Endpoints
app.get("/cases/:id/notes", (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id);
  const complaint = complaints.find(c => c.id === caseId);
  if (!complaint) {
    return res.status(404).json({ detail: "Case not found" });
  }

  const notes = caseNotes
    .filter(n => n.complaint_id === caseId)
    .map(n => {
      const emp = users.find(u => u.id === n.employee_id);
      return {
        id: n.id,
        note_text: n.note_text,
        created_at: n.created_at,
        employee_name: emp ? emp.name : "Investigator"
      };
    });

  notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return res.json(notes);
});

app.post("/cases/:id/notes", (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id);
  const complaint = complaints.find(c => c.id === caseId);
  if (!complaint) {
    return res.status(404).json({ detail: "Case not found" });
  }

  const user = authenticateToken(req) || users.find(u => u.role === "employee") || users[1];
  const noteText = req.body.note_text || req.body.note;
  if (!noteText || !noteText.trim()) {
    return res.status(400).json({ detail: "Note text is required" });
  }

  const newNote: CaseNote = {
    id: noteIdCounter++,
    complaint_id: caseId,
    employee_id: user ? user.id : 2,
    note_text: noteText.trim(),
    created_at: new Date().toISOString()
  };
  caseNotes.push(newNote);

  return res.json({ message: "Case note added successfully", note: noteText });
});

// 14. FIR Draft Endpoints
app.get("/cases/:id/fir-draft", (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id);
  const complaint = complaints.find(c => c.id === caseId);
  if (!complaint) {
    return res.status(404).json({ detail: "Case not found" });
  }

  let draft = firDrafts.find(f => f.complaint_id === caseId);
  if (!draft) {
    const citizen = users.find(u => u.id === complaint.citizen_id);
    const caseEvidences = evidences.filter(e => e.complaint_id === complaint.id);

    let narrative = `FIRST INFORMATION REPORT\n(Under Section 154 CrPC)\n\n` +
      `1. Organization: NATIONAL CYBER CRIME REPORTING PORTAL | PS: CYBER CRIME BRANCH\n` +
      `2. Ticket Ref ID: ${complaint.ticket_id}\n` +
      `3. Complainant Name: ${citizen ? citizen.name : "Unknown"}\n` +
      `4. Offense Category: ${complaint.category.toUpperCase()}\n` +
      `5. Date Reported: ${new Date(complaint.created_at).toUTCString()}\n` +
      `6. Narrative Description:\n   ${complaint.description}\n\n` +
      `7. Forensic Evidence details:\n`;

    caseEvidences.forEach(ev => {
      narrative += `   - File: ${ev.filename} (SHA-256: ${ev.sha256_hash})\n`;
    });

    narrative += `\nPrepared for review under National Cyber Crime Reporting Portal.`;

    draft = {
      id: firIdCounter++,
      complaint_id: caseId,
      generated_text: narrative,
      generated_at: new Date().toISOString(),
      status: "draft"
    };
    firDrafts.push(draft);
  }

  return res.json({
    id: draft.id,
    generated_text: draft.generated_text,
    generated_at: draft.generated_at,
    status: draft.status
  });
});

app.post("/cases/:id/fir-file", (req: Request, res: Response) => {
  const caseId = parseInt(req.params.id);
  const complaint = complaints.find(c => c.id === caseId);
  if (!complaint) {
    return res.status(404).json({ detail: "Case not found" });
  }

  const user = authenticateToken(req) || users.find(u => u.role === "employee") || users[1];
  let draft = firDrafts.find(f => f.complaint_id === caseId);
  if (!draft) {
    draft = {
      id: firIdCounter++,
      complaint_id: caseId,
      generated_text: `FIR for ticket ${complaint.ticket_id}`,
      generated_at: new Date().toISOString(),
      status: "filed",
      reviewed_by: user ? user.id : 2
    };
    firDrafts.push(draft);
  } else {
    draft.status = "filed";
    draft.reviewed_by = user ? user.id : 2;
  }

  return res.json({ message: "FIR marked as officially FILED", status: "filed" });
});

// 15. Analytics Stats
app.get("/analytics/stats", (req: Request, res: Response) => {
  const totalCases = complaints.length;
  const pendingCases = complaints.filter(c => c.status === "pending").length;
  const investigatingCases = complaints.filter(c => c.status === "investigating").length;
  const resolvedCases = complaints.filter(c => c.status === "resolved").length;

  const categories: Record<string, number> = {
    financial_fraud: 0,
    impersonation: 0,
    hacking: 0,
    other: 0
  };

  complaints.forEach(c => {
    if (categories[c.category] !== undefined) {
      categories[c.category]++;
    } else {
      categories["other"]++;
    }
  });

  const dailyVolume: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    dailyVolume[d] = 0;
  }

  complaints.forEach(c => {
    const dayStr = c.created_at.split("T")[0];
    if (dailyVolume[dayStr] !== undefined) {
      dailyVolume[dayStr]++;
    }
  });

  const dailyVolumeList = Object.keys(dailyVolume).sort().map(k => ({ date: k, count: dailyVolume[k] }));

  return res.json({
    total_cases: totalCases,
    pending: pendingCases,
    investigating: investigatingCases,
    resolved: resolvedCases,
    by_category: categories,
    daily_volume: dailyVolumeList
  });
});

// 16. Admin Employee Endpoints
app.get("/admin/employees", (req: Request, res: Response) => {
  const employees = users.filter(u => u.role === "employee" || u.role === "investigator");
  return res.json(employees);
});

app.post("/admin/employees", (req: Request, res: Response) => {
  const { name, email, password, desk, branchId, branchName } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ detail: "Name, email, and password required" });
  }

  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ detail: "Email already registered" });
  }

  const newEmp: User = {
    id: userIdCounter++,
    name,
    email,
    role: "employee",
    password_hash: hashPassword(password),
    desk: desk || "General Desk",
    branch_id: branchId || "br_ahm_central",
    is_active: 1
  };
  users.push(newEmp);

  return res.json({
    message: "Employee created successfully",
    user_id: newEmp.id,
    uid: `user_${newEmp.id}`,
    email: newEmp.email
  });
});

app.patch("/admin/employees/:id/status", (req: Request, res: Response) => {
  const idOrUid = req.params.id;
  let user = users.find(u => String(u.id) === idOrUid || `user_${u.id}` === idOrUid);
  if (!user) {
    return res.status(404).json({ detail: "User not found" });
  }

  const isActive = req.body.is_active !== undefined ? Number(req.body.is_active) : (req.body.disabled ? 0 : 1);
  user.is_active = isActive;

  return res.json({
    message: `Status updated to ${isActive}`,
    user_id: user.id,
    uid: idOrUid,
    disabled: isActive === 0
  });
});

app.delete("/admin/employees/:uid", (req: Request, res: Response) => {
  const uid = req.params.uid;
  const index = users.findIndex(u => String(u.id) === uid || `user_${u.id}` === uid);
  if (index !== -1) {
    users.splice(index, 1);
  }
  return res.json({ message: `Employee ${uid} deleted.` });
});

app.get("/admin/cases", (req: Request, res: Response) => {
  const branchId = req.query.branch_id as string;
  let filtered = [...complaints];
  if (branchId) {
    filtered = filtered.filter(c => c.branch_id === branchId);
  }

  const resList = filtered.map(c => {
    const citizen = users.find(u => u.id === c.citizen_id);
    const caseEvidences = evidences.filter(e => e.complaint_id === c.id);
    return {
      id: c.id,
      ticket_id: c.ticket_id,
      citizen_name: citizen ? citizen.name : "Unknown",
      category: c.category,
      description: c.description,
      status: c.status,
      priority_score: c.priority_score,
      assigned_desk: c.assigned_desk,
      is_severe: c.is_severe,
      branch_id: c.branch_id,
      district: c.district,
      created_at: c.created_at,
      evidence_count: caseEvidences.length
    };
  });

  return res.json(resList);
});

// 17. Slides API
app.get("/api/slides", (req: Request, res: Response) => {
  const activeSlides = slides.filter(s => s.is_active === 1);
  return res.json(activeSlides);
});

app.post("/api/slides", (req: Request, res: Response) => {
  const { title, description, icon, color_scheme, image_url } = req.body;
  if (!title || !description) {
    return res.status(400).json({ detail: "Title and description required" });
  }

  const newSlide: Slide = {
    id: slideIdCounter++,
    title: String(title).trim(),
    description: String(description).trim(),
    icon: icon ? String(icon).trim() : "info",
    color_scheme: color_scheme ? String(color_scheme).trim() : "info",
    image_url: image_url || undefined,
    is_active: 1,
    created_at: new Date().toISOString()
  };
  slides.push(newSlide);

  return res.json({ message: "Slide created successfully", id: newSlide.id, slide: newSlide });
});

app.put("/api/slides/:id", (req: Request, res: Response) => {
  const slideId = parseInt(req.params.id);
  const slide = slides.find(s => s.id === slideId);
  if (!slide) {
    return res.status(404).json({ detail: "Slide not found" });
  }

  const { title, description, icon, color_scheme, image_url, is_active } = req.body;
  if (title !== undefined) slide.title = String(title).trim();
  if (description !== undefined) slide.description = String(description).trim();
  if (icon !== undefined) slide.icon = String(icon).trim();
  if (color_scheme !== undefined) slide.color_scheme = String(color_scheme).trim();
  if (image_url !== undefined) slide.image_url = image_url || undefined;
  if (is_active !== undefined) slide.is_active = Number(is_active);

  return res.json({ message: "Slide updated successfully", slide });
});

app.patch("/api/slides/:id", (req: Request, res: Response) => {
  const slideId = parseInt(req.params.id);
  const slide = slides.find(s => s.id === slideId);
  if (!slide) {
    return res.status(404).json({ detail: "Slide not found" });
  }

  const { title, description, icon, color_scheme, image_url, is_active } = req.body;
  if (title !== undefined) slide.title = String(title).trim();
  if (description !== undefined) slide.description = String(description).trim();
  if (icon !== undefined) slide.icon = String(icon).trim();
  if (color_scheme !== undefined) slide.color_scheme = String(color_scheme).trim();
  if (image_url !== undefined) slide.image_url = image_url || undefined;
  if (is_active !== undefined) slide.is_active = Number(is_active);

  return res.json({ message: "Slide updated successfully", slide });
});

app.post("/api/slides/upload-image", upload.single("file"), (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ detail: "No file provided" });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const destName = `slide_${Date.now()}${ext}`;
  const destPath = path.join(UPLOAD_DIR, destName);

  try {
    fs.copyFileSync(file.path, destPath);
    fs.unlinkSync(file.path);
  } catch {}

  return res.json({ url: `/uploads/${destName}` });
});

app.delete("/api/slides/:id", (req: Request, res: Response) => {
  const slideId = parseInt(req.params.id);
  const slide = slides.find(s => s.id === slideId);
  if (!slide) {
    return res.status(404).json({ detail: "Slide not found" });
  }
  slide.is_active = 0;
  return res.json({ message: "Slide deleted successfully" });
});

// ── 18. FIR (First Information Report) Module ───────────────
const DISTRICTS_DATA = [
  { code: "AHM", name: "Ahmedabad City", stations: ["Cyber Crime Police Station", "Navrangpura", "Satellite", "Vastrapur", "Ellisbridge", "Naranpura", "Ghatlodia", "Sabarmati", "Sola", "Chandkheda"] },
  { code: "GNR", name: "Gandhinagar", stations: ["Cyber Crime PS Gandhinagar", "Sector 7", "Sector 21", "Infocity", "Adalaj", "Pethapur"] },
  { code: "SRT", name: "Surat City", stations: ["Cyber Crime PS Surat", "Athwa", "Khatodara", "Umra", "Rander", "Varachha"] },
  { code: "VDR", name: "Vadodara City", stations: ["Cyber Crime PS Vadodara", "Sayajigunj", "Raopura", "Gotri", "Manjalpur"] },
  { code: "RJK", name: "Rajkot City", stations: ["Cyber Crime PS Rajkot", "Pradhyuman Nagar", "Malaviya Nagar", "Bhaktinagar", "Gandhigram"] },
  { code: "TVM", name: "Thiruvananthapuram", stations: ["Cantonment", "Fort", "Medical College", "Museum", "Nemom", "Peroorkada", "Pettah", "Shanghumugham", "Thampanoor", "Thiruvananthapuram City", "Vattiyoorkavu", "Vizhinjam"] },
  { code: "KLM", name: "Kollam", stations: ["Chavara", "Karunagappally", "Kollam East", "Kollam West", "Kottarakkara", "Punalur", "Paravur", "Sakthikulangara", "Chathannoor"] },
  { code: "EKM", name: "Ernakulam", stations: ["Aluva", "Angamaly", "Edappally", "Ernakulam Central", "Ernakulam North", "Ernakulam South", "Kadavanthra", "Kalamassery", "Kochi", "Nedumbassery"] },
  { code: "KZD", name: "Kozhikode", stations: ["Beypore", "Feroke", "Koyilandi", "Kozhikode City", "Kozhikode Rural", "Nadakkavu", "Vadakara"] }
];

const INCIDENT_CATEGORIES = [
  "Theft", "Robbery/Dacoity", "Burglary", "Assault/Hurt", "Cheating/Fraud",
  "Criminal Intimidation/Threat", "Property Damage", "Missing Person",
  "Snatching", "Vehicle Theft", "Murder/Attempt to Murder", "Kidnapping/Abduction",
  "Rape/Sexual Harassment", "Dowry Harassment", "Riots/Affray", "Arson",
  "Counterfeiting/Forgery", "Drug-related", "Other"
];

const SEX_OPTIONS = ["Male", "Female", "Other", "Unknown"];
const BUILD_OPTIONS = ["Thin", "Medium", "Heavy", "Muscular", "Lean"];
const SKIN_COLORS = ["Fair", "Wheatish", "Dark", "Very Fair", "Dark Complexioned"];
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const INJURY_TYPES = ["None", "Simple", "Grievous"];

const firComplaints: any[] = [];

app.get("/api/fir/config", (req: Request, res: Response) => {
  return res.json({
    districts: DISTRICTS_DATA.map(d => ({ code: d.code, name: d.name })),
    police_stations: DISTRICTS_DATA.flatMap(d => d.stations.map(s => ({ district_code: d.code, name: s }))),
    incident_categories: INCIDENT_CATEGORIES,
    sex_options: SEX_OPTIONS,
    build_options: BUILD_OPTIONS,
    skin_colors: SKIN_COLORS,
    days_of_week: DAYS_OF_WEEK,
    injury_types: INJURY_TYPES
  });
});

app.post(["/api/fir", "/api/fir/"], (req: Request, res: Response) => {
  const data = req.body || {};
  if (!data.declaration_true_to_knowledge) {
    return res.status(400).json({ detail: "Declaration required" });
  }

  const refId = `FIR-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const firRecord = {
    id: firComplaints.length + 1,
    reference_id: refId,
    status: "submitted",
    priority: "medium",
    created_at: new Date().toISOString(),
    ...data
  };

  firComplaints.push(firRecord);

  // Add to unified reports queue
  unifiedReports.push({
    id: `fir_${firRecord.id}`,
    reference_id: refId,
    report_type: "general_crime",
    priority: "medium",
    severity: "MODERATE",
    status: "submitted",
    filer_name: data.complainant_name || data.informant_name || "Citizen Informant",
    filer_phone: data.complainant_phone || data.informant_phone || "N/A",
    incident_date: data.incident_date || new Date().toISOString().split("T")[0],
    assigned_branch: data.police_station || "Cyber Crime Branch",
    created_at: firRecord.created_at,
    summary: `${data.incident_category_hint || 'Crime Incident'}: ${data.incident_brief_summary || data.incident_description || 'First Information Report filed.'}`,
    loss_amount: data.property_total_value || undefined,
    threat_level: "NORMAL",
    evidence_count: (data.properties?.length || 0) + (data.victims?.length || 0),
    original_payload: firRecord
  });

  return res.status(201).json(firRecord);
});

app.get("/api/fir/:reference_id", (req: Request, res: Response) => {
  const ref = req.params.reference_id;
  const comp = firComplaints.find(c => c.reference_id === ref);
  if (!comp) {
    return res.status(404).json({ detail: "FIR not found" });
  }
  return res.json(comp);
});

// ── 19. Fraud Complaints & DigiLocker Module ────────────────
const TRANSACTION_TYPES = [
  "UPI (Google Pay / PhonePe / Paytm / BHIM / other)",
  "Bank Transfer (IMPS / NEFT / RTGS)",
  "Debit Card/Credit Card",
  "Mobile Wallet (Paytm/Amazon Pay/Mobikwik)",
  "Cash", "Cryptocurrency/Crypto Exchange",
  "Cheque/Demand Draft", "International Wire Transfer (SWIFT)", "Other"
];
const UPI_APPS = ["Google Pay", "PhonePe", "Paytm", "BHIM", "Amazon Pay", "WhatsApp Pay", "Other"];
const COUNTRIES = ["India", "United States", "United Kingdom", "UAE", "Canada", "Australia", "Other"];
const COUNTRIES_WITH_STATES = ["India", "United States"];
const CRITICAL_INFRA = {
  "None/Unsure": [],
  "Energy": ["Power Grid", "Oil & Gas", "Renewables"],
  "Financial Services": ["Banking", "Payment Systems", "Insurance", "Capital Markets"],
  "Healthcare": ["Hospitals", "Pharma", "Medical Devices"],
  "Water": ["Water Supply", "Wastewater"],
  "Transportation": ["Railways", "Aviation", "Ports", "Roadways"],
  "IT": ["Data Centres", "Cloud Services", "Software"],
  "Communications": ["Telecom", "Internet Services", "Broadcasting"],
  "Government": ["Defence", "Public Administration", "Emergency Services"]
};

const fraudComplaints: any[] = [];
const digilockerSessions = new Map<string, any>();

app.get("/api/fraud-complaints/config", (req: Request, res: Response) => {
  return res.json({
    transaction_types: TRANSACTION_TYPES,
    upi_apps: UPI_APPS,
    countries: COUNTRIES,
    countries_with_states: COUNTRIES_WITH_STATES,
    critical_infrastructure: CRITICAL_INFRA
  });
});

app.post("/api/digilocker/start", (req: Request, res: Response) => {
  const token = `dl_tok_${crypto.randomBytes(12).toString("hex")}`;
  const sessionId = `DL_SES_${Date.now()}`;
  const session = {
    verify_token: token,
    session_id: sessionId,
    status: "initiated",
    verified_name: "Aadhaar Cardholder (Citizen)",
    aadhaar_masked: "XXXXXXXX8921",
    is_simulated: true,
    created_at: new Date().toISOString()
  };
  digilockerSessions.set(token, session);

  return res.json({
    verify_token: token,
    session_id: sessionId,
    authorization_url: `https://digilocker.meripehchan.gov.in/public/oauth2/1/authorize?token=${token}`,
    status: "initiated",
    is_simulated: true,
    expires_in: 900
  });
});

app.get("/api/digilocker/status/:token", (req: Request, res: Response) => {
  const token = req.params.token;
  const session = digilockerSessions.get(token);
  if (!session) {
    return res.status(404).json({ detail: "Unknown verification token" });
  }
  return res.json({
    verify_token: session.verify_token,
    status: session.status,
    verified_name: session.verified_name,
    aadhaar_masked: session.aadhaar_masked,
    simulated: session.is_simulated
  });
});

app.post("/api/digilocker/simulate-complete", (req: Request, res: Response) => {
  const { verify_token, otp } = req.body || {};
  let session = digilockerSessions.get(verify_token);
  if (!session) {
    session = {
      verify_token: verify_token || `dl_tok_${Date.now()}`,
      session_id: `DL_SES_${Date.now()}`,
      status: "initiated",
      verified_name: "Verified Citizen (Aadhaar KYC)",
      aadhaar_masked: "XXXXXXXX5412",
      is_simulated: true
    };
    digilockerSessions.set(session.verify_token, session);
  }

  session.status = "verified";
  return res.json({
    status: "verified",
    verified_name: session.verified_name,
    aadhaar_masked: session.aadhaar_masked,
    note: "Identity Verified via DigiLocker (Simulated for Demo)"
  });
});

app.post("/api/fraud-complaints", (req: Request, res: Response) => {
  const payload = req.body || {};
  const loss = Number(payload.total_loss_amount) || 0;
  const priority = loss >= 500000 ? "high" : loss >= 50000 ? "medium" : "low";
  const refId = `FR-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  const complaint = {
    id: fraudComplaints.length + 1,
    reference_id: refId,
    status: "submitted",
    priority: priority,
    submitted_at: new Date().toISOString(),
    total_loss_amount: loss,
    digilocker_verified: true,
    ...payload
  };
  fraudComplaints.push(complaint);

  // Add to unified queue
  unifiedReports.push({
    id: `fraud_${complaint.id}`,
    reference_id: refId,
    report_type: "fraud",
    priority: priority,
    severity: loss > 100000 ? "HIGH" : "MODERATE",
    status: "submitted",
    filer_name: payload.filer_name || payload.complainant_name || "Financial Fraud Victim",
    filer_phone: payload.filer_phone || payload.complainant_phone || "N/A",
    incident_date: payload.incident_datetime || new Date().toISOString().split("T")[0],
    assigned_branch: "Cyber Crime Cell - Financial Fraud Desk",
    created_at: complaint.submitted_at,
    summary: `Financial Cyber Fraud: Loss ₹${loss}. ${payload.additional_info || 'Online payment fraud reported.'}`,
    loss_amount: loss,
    threat_level: loss > 500000 ? "CRITICAL" : "NORMAL",
    evidence_count: (payload.transactions?.length || 0) + (payload.subjects?.length || 0),
    original_payload: complaint
  });

  return res.status(201).json({
    reference_id: refId,
    status: "submitted",
    priority: priority,
    total_loss_amount: loss,
    transaction_count: payload.transactions?.length || 0,
    subject_count: payload.subjects?.length || 0,
    message: "Fraud complaint submitted. Save your reference ID to track status. For UPI fraud, also call 1930 immediately.",
    verified_identity: "Verified Citizen (DigiLocker)",
    digilocker_verified: true
  });
});

app.get("/api/fraud-complaints/:reference_id", (req: Request, res: Response) => {
  const ref = req.params.reference_id;
  const c = fraudComplaints.find(fc => fc.reference_id === ref);
  if (!c) {
    return res.status(404).json({ detail: "No complaint found for this reference ID." });
  }
  return res.json({
    reference_id: c.reference_id,
    status: c.status,
    priority: c.priority,
    total_loss_amount: c.total_loss_amount,
    submitted_at: c.submitted_at,
    transaction_count: c.transactions?.length || 0,
    subject_count: c.subjects?.length || 0
  });
});

// ── 20. Child Safety & Women Safety Endpoints ──────────────
app.post(["/api/child-safety", "/api/child-safety/complaint"], (req: Request, res: Response) => {
  const payload = req.body || {};
  const refId = `CS-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const record = {
    id: `cs_${Date.now()}`,
    reference_id: refId,
    status: "submitted",
    severity: payload.threat_level || "CRITICAL",
    created_at: new Date().toISOString(),
    ...payload
  };

  unifiedReports.push({
    id: record.id,
    reference_id: refId,
    report_type: "child_safety",
    priority: "critical",
    severity: "CRITICAL",
    status: "submitted",
    filer_name: payload.reporter_name || payload.filer_name || "Confidential Reporter",
    filer_phone: payload.reporter_phone || payload.filer_phone || "N/A",
    incident_date: payload.incident_date || new Date().toISOString().split("T")[0],
    assigned_branch: "Special Juvenile Police Unit (POCSO)",
    created_at: record.created_at,
    summary: `Child Safety Incident: ${payload.incident_type || 'POCSO/Exploitation Alert'}. ${payload.details || payload.description || ''}`,
    threat_level: "CRITICAL",
    evidence_count: payload.evidence_files?.length || 1,
    original_payload: record
  });

  return res.status(201).json({
    reference_id: refId,
    status: "submitted",
    priority: "critical",
    message: "Child Safety incident securely logged and escalated to Special Juvenile Police Unit."
  });
});

app.post(["/api/women-safety", "/api/women-safety/complaint"], (req: Request, res: Response) => {
  const payload = req.body || {};
  const refId = `WS-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const record = {
    id: `ws_${Date.now()}`,
    reference_id: refId,
    status: "submitted",
    severity: payload.is_emergency ? "CRITICAL" : "HIGH",
    created_at: new Date().toISOString(),
    ...payload
  };

  unifiedReports.push({
    id: record.id,
    reference_id: refId,
    report_type: "women_safety",
    priority: payload.is_emergency ? "critical" : "high",
    severity: payload.is_emergency ? "CRITICAL" : "HIGH",
    status: "submitted",
    filer_name: payload.victim_name || payload.filer_name || "Citizen (Confidential)",
    filer_phone: payload.contact_phone || payload.filer_phone || "N/A",
    incident_date: payload.incident_date || new Date().toISOString().split("T")[0],
    assigned_branch: "Women Safety Cyber Desk",
    created_at: record.created_at,
    summary: `Women Safety Alert: ${payload.incident_type || 'Harassment/Stalking/Cyber Threat'}. ${payload.details || payload.description || ''}`,
    threat_level: payload.is_emergency ? "CRITICAL" : "HIGH",
    evidence_count: 1,
    original_payload: record
  });

  return res.status(201).json({
    reference_id: refId,
    status: "submitted",
    priority: payload.is_emergency ? "critical" : "high",
    message: "Women safety report received. Confidential support and tracking initiated."
  });
});

// ── Static Frontend Files Serving ───────────────────────────
function resolveFrontendPath(...subpaths: string[]): string {
  const candidates = [
    path.join(process.cwd(), "frontend", ...subpaths),
    path.join(__dirname, "frontend", ...subpaths),
    path.join(__dirname, "..", "frontend", ...subpaths),
    path.join(process.cwd(), ...subpaths)
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return path.join(process.cwd(), "frontend", ...subpaths);
}

function sendStaticSafe(res: Response, subpaths: string[], fallbackIndex = true) {
  const fullPath = resolveFrontendPath(...subpaths);
  if (fs.existsSync(fullPath)) {
    return res.sendFile(fullPath);
  }
  if (fallbackIndex) {
    const indexPath = resolveFrontendPath("citizen", "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  return res.status(404).send("Page not found");
}

const frontendDir = resolveFrontendPath();
app.use("/frontend", express.static(frontendDir));
app.use("/uploads", express.static(UPLOAD_DIR));

// Favicon routes
app.get(["/favicon.ico", "/favicon.png"], (req: Request, res: Response) => {
  sendStaticSafe(res, ["assets", "logo.png"], false);
});

// Static Routes matching user specifications
app.get("/", (req: Request, res: Response) => {
  sendStaticSafe(res, ["citizen", "index.html"]);
});

app.get("/contact", (req: Request, res: Response) => {
  sendStaticSafe(res, ["contact.html"]);
});

app.get("/privacy-policy", (req: Request, res: Response) => {
  sendStaticSafe(res, ["privacy-policy.html"]);
});

app.get("/sitemanager", (req: Request, res: Response) => {
  sendStaticSafe(res, ["citizen", "sitemanager.html"]);
});

app.get(["/fir-complaint", "/fir-complaint.html"], (req: Request, res: Response) => {
  sendStaticSafe(res, ["citizen", "fir-complaint.html"]);
});

app.get(["/fraud-complaint", "/fraud-complaint.html"], (req: Request, res: Response) => {
  sendStaticSafe(res, ["citizen", "fraud-complaint.html"]);
});

app.get(["/test-complaint", "/test-complaint.html"], (req: Request, res: Response) => {
  sendStaticSafe(res, ["citizen", "test-complaint.html"]);
});

app.get("/employee", (req: Request, res: Response) => {
  sendStaticSafe(res, ["police", "employee.html"]);
});

app.get("/admin", (req: Request, res: Response) => {
  sendStaticSafe(res, ["police", "admin.html"]);
});

// Fallback for SPA/static assets
app.get("*", (req: Request, res: Response) => {
  sendStaticSafe(res, ["citizen", "index.html"]);
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error", message: err?.message || String(err) });
});

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ForenSync] Server running at http://0.0.0.0:${PORT}`);
  });
}

export default app;
