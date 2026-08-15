import os
import sqlite3
import urllib.request

def generate_sqlite(filepath):
    print(f"Generating mock SQLite file: {filepath}")
    conn = sqlite3.connect(filepath)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS web_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT,
        title TEXT,
        last_visit_time INTEGER, -- Unix timestamp in seconds
        visit_count INTEGER
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT,
        message TEXT,
        created_at TEXT -- ISO 8601 string
    )
    """)
    
    # Insert data
    cursor.executemany("""
    INSERT INTO web_history (url, title, last_visit_time, visit_count) VALUES (?, ?, ?, ?)
    """, [
        ("https://suspicious-domain.com/login", "Urgent Verification Required", 1792010100, 3),
        ("https://legit-bank.com/dashboard", "Online Banking Portal", 1792011200, 15),
        ("https://darkweb-forum.onion/hacks", "Exploit Marketplace", 1792015500, 1),
    ])
    
    cursor.executemany("""
    INSERT INTO app_logs (app_name, message, created_at) VALUES (?, ?, ?)
    """, [
        ("SystemUpdater", "Unauthorized configuration file change detected.", "2026-08-15T09:12:00Z"),
        ("Authenticator", "Failed MFA login attempt from IP 198.51.100.42", "2026-08-15T09:15:30Z"),
        ("SQLCipher", "Database decryption successful", "2026-08-15T09:30:10Z")
    ])
    
    conn.commit()
    conn.close()
    print("Mock SQLite file generated successfully.")

def download_evtx(filepath):
    # Try downloading a real evtx sample from github
    url = "https://raw.githubusercontent.com/Yamato-Security/hayabusa-sample-evtx/main/Security/Logon/4624_InteractiveLogon.evtx"
    print(f"Downloading sample EVTX file from {url}...")
    try:
        urllib.request.urlretrieve(url, filepath)
        print("EVTX file downloaded successfully.")
    except Exception as e:
        print(f"Failed to download EVTX file: {e}")
        print("Generating a fallback mock EVTX file (text file placeholder)...")
        # Write a dummy placeholder that we will check in parser
        with open(filepath, "wb") as f:
            f.write(b"ElfFile\x00\x00\x00Placeholder")

if __name__ == "__main__":
    os.makedirs("sample_data", exist_ok=True)
    generate_sqlite("sample_data/mock_browser.sqlite")
    download_evtx("sample_data/security_sample.evtx")
