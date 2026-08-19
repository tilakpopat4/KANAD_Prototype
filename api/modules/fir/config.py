"""
config.py — Static configuration for FIR module (dropdown values).
Based on NCRB I.I.F.-I Schema requirements.
"""

# Kerala districts with major police stations
DISTRICTS_DATA = [
    {"code": "TVM", "name": "Thiruvananthapuram", "stations": [
        "Cantonment", "Fort", "Medical College", "Museum", "Nemom", "Peroorkada",
        "Pettah", "Shanghumugham", "Thampanoor", "Thiruvananthapuram City",
        "Vattiyoorkavu", "Vizhinjam"
    ]},
    {"code": "KLM", "name": "Kollam", "stations": [
        "Chavara", "Karunagappally", "Kollam East", "Kollam West", "Kottarakkara",
        "Punalur", "Paravur", "Sakthikulangara", "Chathannoor"
    ]},
    {"code": "PTA", "name": "Pathanamthitta", "stations": [
        "Adoor", "Konni", "Kozhencherry", "Mallappally", "Pathanamthitta", "Ranni", "Thiruvalla"
    ]},
    {"code": "ALP", "name": "Alappuzha", "stations": [
        "Alappuzha North", "Alappuzha South", "Chengannur", "Cherthala", "Haripad",
        "Kayamkulam", "Mavelikkara"
    ]},
    {"code": "KTM", "name": "Kottayam", "stations": [
        "Changanasserry", "Ettumanoor", "Kanjirappally", "Kottayam", "Pala",
        "Ponkunnam", "Vaikom"
    ]},
    {"code": "IDK", "name": "Idukki", "stations": [
        "Adimali", "Munnar", "Nedumkandam", "Thodupuzha"
    ]},
    {"code": "EKM", "name": "Ernakulam", "stations": [
        "Aluva", "Angamaly", "Edappally", "Ernakulam Central", "Ernakulam North",
        "Ernakulam South", "Kadavanthra", "Kalamassery", "Kochi", "Nedumbassery"
    ]},
    {"code": "TSR", "name": "Thrissur", "stations": [
        "Chalakudy", "Guruvayur", "Irinjalakuda", "Kodungallur", "Thrissur City",
        "Thrissur East", "Thrissur West", "Wadakkancherry"
    ]},
    {"code": "PKD", "name": "Palakkad", "stations": [
        "Alathur", "Chittur", "Mannarkkad", "Ottappalam", "Palakkad City", "Shornur"
    ]},
    {"code": "MLP", "name": "Malappuram", "stations": [
        "Areacode", "Kondotty", "Kottakkal", "Malappuram", "Manjeri", "Perinthalmanna",
        "Ponnani", "Tirur", "Tirurangadi"
    ]},
    {"code": "KZD", "name": "Kozhikode", "stations": [
        "Beypore", "Feroke", "Koyilandi", "Kozhikode City", "Kozhikode Rural",
        "Nadakkavu", "Vadakara"
    ]},
    {"code": "WYD", "name": "Wayanad", "stations": ["Kalpetta", "Mananthavady", "Sulthan Bathery"]},
    {"code": "KNR", "name": "Kannur", "stations": [
        "Kannur City", "Kannur Rural", "Payyannur", "Taliparamba", "Thalassery"
    ]},
    {"code": "KSD", "name": "Kasaragod", "stations": [
        "Kanhangad", "Kasaragod", "Nileshwar", "Uppala"
    ]}
]

INCIDENT_CATEGORIES = [
    "Theft",
    "Robbery/Dacoity",
    "Burglary",
    "Assault/Hurt",
    "Cheating/Fraud",
    "Criminal Intimidation/Threat",
    "Property Damage",
    "Missing Person",
    "Snatching",
    "Vehicle Theft",
    "Murder/Attempt to Murder",
    "Kidnapping/Abduction",
    "Rape/Sexual Harassment",
    "Dowry Harassment",
    "Riots/Affray",
    "Arson",
    "Counterfeiting/Forgery",
    "Drug-related",
    "Other"
]

SEX_OPTIONS = ["Male", "Female", "Other", "Unknown"]

BUILD_OPTIONS = ["Thin", "Medium", "Heavy", "Muscular", "Lean"]

SKIN_COLORS = ["Fair", "Wheatish", "Dark", "Very Fair", "Dark Complexioned"]

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

INJURY_TYPES = ["None", "Simple", "Grievous"]

ACCUSED_STATUS_OPTIONS = ["Known", "Suspected", "Unknown"]
