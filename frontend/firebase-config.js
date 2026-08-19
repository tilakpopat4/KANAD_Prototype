// ============================================================
// FIREBASE CONFIGURATION — ForenSync Cyber Portal
// ============================================================
// Replace placeholder values with your actual Firebase config.
// Found at: Firebase Console → Project Settings → General → Web App
//
// After updating, also:
//   1. In Firestore → Rules: paste the rules from implementation_plan.md
//   2. Run backend/scripts/setup_admin.py once to create super_admin
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBFaZ6MTu1D4xdykQAZFHtkQw3xGfjwXWg",
  authDomain: "forensync-b3a45.firebaseapp.com",
  projectId: "forensync-b3a45",
  storageBucket: "forensync-b3a45.firebasestorage.app",
  messagingSenderId: "679454217435",
  appId: "1:679454217435:web:0a2cdd9b569ad340e1e8fe",
  measurementId: "G-MXH1TP3JF9"
};

// ── 30 Cyber Cell Branches ──────────────────────────
const CYBER_BRANCHES = [
  { id:'br_ahm_central',   name:'National Cyber Crime Cell \u2013 Central Zone', district:'Central Zone', zone:'Central', location:'Central Zone, New Delhi \u2013 110 001' },
  { id:'br_ahm_east',      name:'National Cyber Crime Cell \u2013 East Zone',    district:'East Zone',    zone:'East',    location:'East Zone Branch' },
  { id:'br_ahm_west',      name:'National Cyber Crime Cell \u2013 West Zone',    district:'West Zone',    zone:'West',    location:'West Zone Branch' },
  { id:'br_ahm_north',     name:'National Cyber Crime Cell \u2013 North Zone',   district:'North Zone',   zone:'North',   location:'North Zone Branch' },
  { id:'br_ahm_south',     name:'National Cyber Crime Cell \u2013 South Zone',   district:'South Zone',   zone:'South',   location:'South Zone Branch' },
  { id:'br_gandhinagar',   name:'Gandhinagar Cyber Cell',                     district:'Gandhinagar',  zone:'Central', location:'Sector 11, Gandhinagar' },
  { id:'br_surat_central', name:'Surat Cyber Cell \u2013 Central',            district:'Surat',        zone:'Central', location:'Athwa, Surat' },
  { id:'br_surat_east',    name:'Surat Cyber Cell \u2013 East',               district:'Surat',        zone:'East',    location:'Udhna, Surat' },
  { id:'br_surat_west',    name:'Surat Cyber Cell \u2013 West',               district:'Surat',        zone:'West',    location:'Vesu, Surat' },
  { id:'br_vadodara',      name:'Vadodara Cyber Cell',                        district:'Vadodara',     zone:'Central', location:'Fatehganj, Vadodara' },
  { id:'br_rajkot',        name:'Rajkot Cyber Cell',                          district:'Rajkot',       zone:'Central', location:'Race Course, Rajkot' },
  { id:'br_bhavnagar',     name:'Bhavnagar Cyber Cell',                       district:'Bhavnagar',    zone:'Central', location:'Bhavnagar' },
  { id:'br_jamnagar',      name:'Jamnagar Cyber Cell',                        district:'Jamnagar',     zone:'Central', location:'Jamnagar' },
  { id:'br_junagadh',      name:'Junagadh Cyber Cell',                        district:'Junagadh',     zone:'Central', location:'Junagadh' },
  { id:'br_anand',         name:'Anand Cyber Cell',                           district:'Anand',        zone:'Central', location:'Anand' },
  { id:'br_nadiad',        name:'Nadiad Cyber Cell',                          district:'Kheda',        zone:'Central', location:'Nadiad, Kheda' },
  { id:'br_mehsana',       name:'Mehsana Cyber Cell',                         district:'Mehsana',      zone:'North',   location:'Mehsana' },
  { id:'br_palanpur',      name:'Palanpur Cyber Cell',                        district:'Banaskantha',  zone:'North',   location:'Palanpur, Banaskantha' },
  { id:'br_himmatnagar',   name:'Himmatnagar Cyber Cell',                     district:'Sabarkantha',  zone:'North',   location:'Himmatnagar, Sabarkantha' },
  { id:'br_godhra',        name:'Godhra Cyber Cell',                          district:'Panchmahal',   zone:'East',    location:'Godhra, Panchmahal' },
  { id:'br_dahod',         name:'Dahod Cyber Cell',                           district:'Dahod',        zone:'East',    location:'Dahod' },
  { id:'br_bharuch',       name:'Bharuch Cyber Cell',                         district:'Bharuch',      zone:'South',   location:'Bharuch' },
  { id:'br_navsari',       name:'Navsari Cyber Cell',                         district:'Navsari',      zone:'South',   location:'Navsari' },
  { id:'br_valsad',        name:'Valsad Cyber Cell',                          district:'Valsad',       zone:'South',   location:'Valsad' },
  { id:'br_vapi',          name:'Vapi Cyber Cell',                            district:'Valsad',       zone:'South',   location:'Vapi, Valsad' },
  { id:'br_morbi',         name:'Morbi Cyber Cell',                           district:'Morbi',        zone:'West',    location:'Morbi' },
  { id:'br_surendranagar', name:'Surendranagar Cyber Cell',                   district:'Surendranagar',zone:'West',    location:'Surendranagar' },
  { id:'br_amreli',        name:'Amreli Cyber Cell',                          district:'Amreli',       zone:'West',    location:'Amreli' },
  { id:'br_porbandar',     name:'Porbandar Cyber Cell',                       district:'Porbandar',    zone:'West',    location:'Porbandar' },
  { id:'br_kutch_bhuj',    name:'Kutch Cyber Cell \u2013 Bhuj',               district:'Kutch',        zone:'West',    location:'Bhuj, Kutch' },
];

// District → Primary Branch mapping (for auto-routing citizen complaints)
const DISTRICT_BRANCH_MAP = {
  'Ahmedabad':       'br_ahm_central',
  'Gandhinagar':     'br_gandhinagar',
  'Surat':           'br_surat_central',
  'Vadodara':        'br_vadodara',
  'Rajkot':          'br_rajkot',
  'Bhavnagar':       'br_bhavnagar',
  'Jamnagar':        'br_jamnagar',
  'Junagadh':        'br_junagadh',
  'Anand':           'br_anand',
  'Kheda':           'br_nadiad',
  'Mehsana':         'br_mehsana',
  'Banaskantha':     'br_palanpur',
  'Sabarkantha':     'br_himmatnagar',
  'Panchmahal':      'br_godhra',
  'Dahod':           'br_dahod',
  'Bharuch':         'br_bharuch',
  'Navsari':         'br_navsari',
  'Valsad':          'br_valsad',
  'Morbi':           'br_morbi',
  'Surendranagar':   'br_surendranagar',
  'Amreli':          'br_amreli',
  'Porbandar':       'br_porbandar',
  'Kutch':           'br_kutch_bhuj',
  'Arvalli':         'br_himmatnagar',
  'Botad':           'br_bhavnagar',
  'Chhota Udaipur':  'br_vadodara',
  'Devbhumi Dwarka': 'br_jamnagar',
  'Gir Somnath':     'br_junagadh',
  'Mahisagar':       'br_godhra',
  'Narmada':         'br_bharuch',
  'Tapi':            'br_surat_central',
  'Dang':            'br_navsari',
};

// All Gujarat districts for the citizen complaint form
const GUJARAT_DISTRICTS = [
  'Ahmedabad','Amreli','Anand','Arvalli','Banaskantha','Bharuch','Bhavnagar',
  'Botad','Chhota Udaipur','Dahod','Dang','Devbhumi Dwarka','Gandhinagar',
  'Gir Somnath','Jamnagar','Junagadh','Kheda','Kutch','Mahisagar','Mehsana',
  'Morbi','Narmada','Navsari','Panchmahal','Patan','Porbandar','Rajkot',
  'Sabarkantha','Surat','Surendranagar','Tapi','Valsad','Vadodara',
];

// Desk options for employees
const DESK_OPTIONS = [
  'Financial Fraud Desk',
  'Cyber Social Desk',
  'Cyber Security Desk',
  'General Desk',
];

// ── Firestore Security Rules (paste in Firebase Console) ──────
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuth() { return request.auth != null; }
    function isSuperAdmin() {
      return isAuth() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
    }
    match /branches/{branchId} {
      allow read: if isAuth();
      allow write: if isSuperAdmin();
    }
    match /users/{uid} {
      allow read: if isAuth() && (isSuperAdmin() || request.auth.uid == uid);
      allow write: if isSuperAdmin();
    }
  }
}
*/
