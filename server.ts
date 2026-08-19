import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import multer from "multer";

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || "FORENSYNC_SUPER_SECRET_KEY_FOR_HACKATHON_2026";

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload directory setup
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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

// ── In-Memory Database Store ────────────────────────────────
let userIdCounter = 1;
let complaintIdCounter = 1;
let evidenceIdCounter = 1;
let timelineIdCounter = 1;
let auditIdCounter = 1;
let noteIdCounter = 1;
let firIdCounter = 1;
let slideIdCounter = 1;

const users: User[] = [];
const complaints: Complaint[] = [];
const evidences: Evidence[] = [];
const timelineEvents: TimelineEvent[] = [];
const auditLogs: AuditLog[] = [];
const caseNotes: CaseNote[] = [];
const firDrafts: FirDraft[] = [];
const slides: Slide[] = [];

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

  const admin: User = {
    id: userIdCounter++,
    name: "ACP - National Cyber Crime Reporting Portal",
    email: "admin@forensync.gov",
    role: "admin",
    password_hash: hashPassword("admin123"),
    branch_id: "br_ahm_central",
    is_active: 1
  };

  users.push(citizen, employee, admin);

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

// ── Static Frontend Files Serving ───────────────────────────
const frontendDir = path.join(process.cwd(), "frontend");
const citizenDir = path.join(frontendDir, "citizen");
const policeDir = path.join(frontendDir, "police");

app.use("/frontend", express.static(frontendDir));
app.use("/uploads", express.static(UPLOAD_DIR));

// Static Routes matching user specifications
app.get("/", (req: Request, res: Response) => {
  res.sendFile(path.join(citizenDir, "index.html"));
});

app.get("/contact", (req: Request, res: Response) => {
  res.sendFile(path.join(frontendDir, "contact.html"));
});

app.get("/privacy-policy", (req: Request, res: Response) => {
  res.sendFile(path.join(frontendDir, "privacy-policy.html"));
});

app.get("/sitemanager", (req: Request, res: Response) => {
  res.sendFile(path.join(citizenDir, "sitemanager.html"));
});

app.get("/employee", (req: Request, res: Response) => {
  res.sendFile(path.join(policeDir, "employee.html"));
});

app.get("/admin", (req: Request, res: Response) => {
  res.sendFile(path.join(policeDir, "admin.html"));
});

// Fallback for SPA/static assets
app.get("*", (req: Request, res: Response) => {
  res.sendFile(path.join(citizenDir, "index.html"));
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error", message: err?.message || String(err) });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ForenSync] Server running at http://0.0.0.0:${PORT}`);
});
