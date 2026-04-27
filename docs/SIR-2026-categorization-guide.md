# Maharashtra SIR 2026 Voter Categorization & Form Guide

## Match Result → User Category → Form Mapping

### **Case 1: LEGACY VOTER (2002 ✓ + 2024 ✓)**
**Definition:** Name exists in BOTH 2002 voter roll AND current 2024 roll  
**SIR Category:** Category 1 (Legacy Voters)  
**User Status:** Verified & Confirmed

| Field | Response |
|-------|----------|
| **Categorization** | Legacy Voter (Continuity Confirmed) |
| **Form Required** | No new form needed |
| **Next Step** | Enumeration verification (BLO visit in April onwards) |
| **Documents to Keep Ready** | ID Proof (Aadhaar, Voter ID, PAN, Passport) + Address Proof |
| **Message to User** | आपका नाम 2002 और 2024 दोनों विधानसभा सूचियों में मिल गया है। आप एक Legacy Voter हैं। BLO आपसे enumeration के समय मिलेंगे। |

---

### **Case 2: CURRENT ROLL ONLY (2024 ✓ + 2002 ✗)**
**Definition:** Name exists in current 2024 roll but NOT in 2002 roll  
**SIR Category:** Category 2 (Progeny Voters) OR new eligible voter  
**User Status:** Registered but needs mapping verification

| Field | Response |
|-------|----------|
| **Categorization** | Current Registered Voter (Needs Legacy Mapping) |
| **Form Required** | **Form 6 (if truly new)** OR provide **Relative's 2002 Details** |
| **Sub-Cases** | |
| → If parents/grandparents in 2002 roll | Provide their name, father's name, DOB → System maps you via lineage |
| → If no relative in 2002 roll | File **Form 6** (New Voter Enrollment) with documents |
| **Next Step** | Enumeration + mapping verification |
| **Documents to Keep Ready** | Birth Certificate, School Leaving Certificate, Aadhaar, Domicile Certificate, Property/Rent Agreement |
| **Message to User** | आप 2024 सूची में हैं लेकिन 2002 में नहीं। अगर आपके माता-पिता या दादा-दादी 2002 में थे तो उनका विवरण दें। नहीं तो Form 6 भरें। |

---

### **Case 3: LEGACY ONLY (2002 ✓ + 2024 ✗)**
**Definition:** Name in 2002 roll but MISSING from current 2024 roll  
**SIR Category:** Category 1 (Legacy) but deletion risk / SIR Restoration candidate  
**User Status:** Potentially deleted or not yet re-verified

| Field | Response |
|-------|----------|
| **Categorization** | Legacy Voter (Name Missing from Current Roll) |
| **Form Required** | **No immediate form** - SIR verification will restore |
| **Why Missing?** | Could be: misspelling update, administrative error, or genuine deletion |
| **Next Step** | **Critical:** During SIR enumeration (April onwards), BLO will verify you. Be present & confirm your continued eligibility. |
| **Documents to Keep Ready** | ID Proof, Address Proof, Father's name confirmation, DOB confirmation |
| **Action if still not restored** | File objection to ERO (Electoral Registration Officer) within 7 days of Draft Roll publication |
| **Message to User** | आप 2002 में थे लेकिन 2024 की सूची से हट गए हो। SIR प्रक्रिया के दौरान (अप्रैल से) BLO आपको verify करेंगे और restoration कर देंगे। अपना डेटा तैयार रखें। |

---

### **Case 4: NO MATCH (2002 ✗ + 2024 ✗)**
**Definition:** Name NOT in 2002 roll AND NOT in 2024 roll  
**SIR Category:** Category 3 (New Voters) OR non-resident  
**User Status:** Not yet registered

| Field | Response |
|-------|----------|
| **Categorization** | New/Unregistered Voter |
| **Form Required** | **Form 6** (New Voter Enrollment / Registration) |
| **Pre-Requisites** | Must be 18+ years old as on enrollment date |
| **Critical Documents** | Birth Certificate, School Certificate, Aadhaar, **Domicile Certificate** (to prove Maharashtra residency), Property/Rent agreement for address proof |
| **Next Step** | 1. Collect all 12 document sets (as per ECI guidelines) 2. File Form 6 before SIR enumeration ends 3. Submit to BLO during door-to-door visit OR directly to ERO office |
| **Deadline** | Before Draft Roll is finalized (typically by May 2026) |
| **Message to User** | आप किसी भी सूची में नहीं हैं। आपको नया मतदाता रजिस्ट्रेशन (Form 6) करना होगा। महत्वपूर्ण: Domicile Certificate और Property Documents जमा करें। |

---

## Special Cases

### **Spelling/DOB Mismatch Detected (Minor)**
**Action:** File **Form 8 (Correction Form)**  
**Timeline:** Do this ASAP, preferably before enumeration starts  
**Message:** आपके नाम/जन्मतिथि में छोटी त्रुटि है। तुरंत Form 8 भरकर सुधार करवाएं।

### **Name in 2002 but Different Father's Name**
**Action:** Conflict detected in SIR matching  
**Next Step:** Manual BLO verification required  
**Message:** आपके पिता का नाम अलग दिख रहा है। BLO आपसे मिलकर verify करेंगे।

---

## Document Checklist (SIR 2026 - ECI Approved)

### **Always Required:**
- [ ] Aadhaar Card (most preferred)
- [ ] Voter ID (if already have)
- [ ] PAN Card
- [ ] Passport

### **Address Proof (any one):**
- [ ] Electricity Bill
- [ ] Ration Card (BPL/APL)
- [ ] Rent Agreement
- [ ] Property Tax receipt

### **Age/DOB Proof (any one):**
- [ ] Birth Certificate
- [ ] School Leaving Certificate (with DOB)
- [ ] Board 10th Certificate

### **For Progeny/New Voters (Case 2 & 4):**
- [ ] **Domicile Certificate** (critical for Maharashtra residency proof)
- [ ] **Birth Certificate** (establishes continuity with parents if applicable)

---

## Quick Decision Tree

```
User's Match Result?
├─ 2002 ✓ + 2024 ✓ → CASE 1: Legacy Voter
│   └─ Action: No new form, attend enumeration verification
│
├─ 2024 ✓ + 2002 ✗ → CASE 2: Current Roll Only
│   ├─ Have parents in 2002? → Provide their details for mapping
│   └─ No relatives in 2002? → File Form 6 (New Voter)
│
├─ 2002 ✓ + 2024 ✗ → CASE 3: Legacy Only
│   └─ Action: Wait for SIR enumeration (BLO will verify & restore)
│
└─ 2002 ✗ + 2024 ✗ → CASE 4: No Match
    └─ Action: File Form 6 (New Voter) with 12 document sets
```

---

## Implementation Notes for VoterCheck Backend

### **Webhook Response Mapping:**

```javascript
// Based on buildVoterMatchSummary finalStatus:

const categorization = {
  "legacy_confirmed": {
    category: "Case 1: Legacy Voter",
    form: "No new form required",
    guidance: "Legacy Voter - Enumeration verification pending"
  },
  "current_roll_only": {
    category: "Case 2: Current Roll Only",
    form: "Form 6 (if no 2002 relative) OR provide relative details",
    guidance: "Progeny Voter - Mapping verification via BLO"
  },
  "legacy_only": {
    category: "Case 3: Legacy Only",
    form: "No form - SIR enumeration will restore",
    guidance: "Legacy voter not in current roll - will be restored during SIR"
  },
  "not_found": {
    category: "Case 4: No Match",
    form: "Form 6 (New Voter Registration)",
    guidance: "New/Unregistered - File Form 6 before SIR deadline"
  }
};
```

---

## Contact & Next Steps

**Maharashtra Election Commission SIR Helpline:** 1800-200-6070  
**District ERO Office:** Contact your local Electoral Registration Officer  
**BLO Details:** Will be provided during enumeration (April 2026 onwards)

---

*Last Updated: 27 Apr 2026*  
*Document Version: SIR-2026-v1.0*
