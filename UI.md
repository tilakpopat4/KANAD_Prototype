# Kanad Shield - Complete UI Documentation

> Comprehensive design system for Citizen Portal, Police Dashboard, and Admin Interface

---

## Table of Contents

1. [Design System Overview](#design-system-overview)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Layout Components](#layout-components)
5. [Multi-Language Support](#multi-language-support)
6. [Citizen Portal Features](#citizen-portal-features)
7. [Form Components](#form-components)
8. [Button Styles](#button-styles)
9. [Cards & Modals](#cards--modals)
10. [Tables](#tables)
11. [Animations](#animations)

---

## Design System Overview

**Theme:** Light, professional, government-grade security aesthetic  
**Style:** Minimal glassmorphism with clean borders and subtle shadows  
**Border Radius:** 8px (standard), 12px (cards), 50% (avatars)  
**Border:** 1px solid rgba patterns for subtle definition

---

## Color Palette

### CSS Variables (Root)

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg-dark` | #f8fafc | Page background |
| `--card-bg` | #ffffff | Card surfaces |
| `--border-color` | #a3bece | Default borders |
| `--border-hover` | #289ee7 | Hover/active borders |
| `--neon-cyan` | #18548e | Primary brand color |
| `--neon-purple` | #289ee7 | Accent/secondary |
| `--text-primary` | #3e5877 | Main text |
| `--text-secondary` | #5f7a99 | Secondary text |
| `--success` | #10b981 | Success states |
| `--warning` | #9d705a | FIR reviews/warnings |
| `--danger` | #ef4444 | Errors/danger |

### Background Gradients

```css
body {
    background: #f8fafc;
    background-image: 
        radial-gradient(at 0% 0%, rgba(40, 158, 231, 0.04) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(157, 112, 90, 0.04) 0px, transparent 50%);
}
```

---

## Typography

### Font Families

| Font | Type | Usage |
|------|------|-------|
| **Outfit** | Body font | Paragraphs, labels, buttons |
| **Space Grotesk** | Display font | Headings, titles, monospace elements |

### Font Weights

- Light: 300
- Regular: 400
- Medium: 500
- SemiBold: 600
- Bold: 700
- ExtraBold: 800

### Heading Hierarchy

| Level | Size | Weight |
|-------|------|--------|
| H1 | clamp(2.1rem, 5vw, 4rem) | 700 |
| H2 | 32px | 600 |
| H3 | 22px | 500 |
| H4 | 18px | 500 |
| Body | 14px | 400 |
| Small | 12-13px | 400 |

---

## Layout Components

### Container

```css
.container {
    max-width: 100%;
    margin: 0 auto;
    padding: 20px 50px;
}
```

### Glass Panel (Primary Card)

```css
.glass-panel {
    background: #ffffff;
    border: 1px solid #a3bece;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 20px 0 rgba(24, 84, 142, 0.05);
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.glass-panel:hover {
    border-color: #289ee7;
    box-shadow: 0 8px 30px 0 rgba(40, 158, 231, 0.1);
}
```

### Logo Styles

| Element | Styles |
|---------|--------|
| `.logo-icon` | 40x40px, gradient bg (#18548e to #289ee7), 8px radius |
| `.logo-text` | 24px, weight 700, #18548e |
| `.logo-sub` | 10px, uppercase, #289ee7, letter-spacing 0.2em |

---

## Form Components

### Form Control (Input/Textarea/Select)

```css
.form-control {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #a3bece;
    border-radius: 10px;
    background: #ffffff;
    color: #3e5877;
    font-size: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.form-control:focus {
    border-color: #289ee7;
    box-shadow: 0 0 0 4px rgba(40, 158, 231, 0.08);
    outline: none;
}
```

### Search Input

```css
.search-input {
    background: #fff;
    border: 1px solid rgba(24,84,142,0.15);
    border-radius: 40px;
    padding: 10px 18px;
    padding-left: 44px;
    min-width: 260px;
    transition: box-shadow 0.2s ease, border-color 0.2s ease, width 0.2s ease;
}

.search-input:focus {
    box-shadow: 0 8px 22px rgba(24,84,142,0.12);
    border-color: #289ee7;
    width: 320px;
}
```

### Checkbox Group

```html
<div class="checkbox-wrap">
    <input type="checkbox" id="checkbox1">
    <label for="checkbox1">Label text</label>
</div>
```

---

## Button Styles

### Primary Button

```css
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #18548e;
    color: #fff;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover {
    background: #156bc8;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(21,107,200,0.25);
}
```

### Secondary Button

```css
.btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #fff;
    color: #18548e;
    border: 1.5px solid #18548e;
    padding: 10px 22px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary:hover {
    background: rgba(24, 84, 142, 0.06);
    box-shadow: 0 6px 18px rgba(24, 84, 142, 0.12);
    transform: translateY(-1px);
}
```

### Danger Button

```css
.btn-danger {
    background: #ef4444;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
}

.btn-danger:hover {
    background: #dc2626;
}
```

### Button Sizes

| Class | Padding | Font |
|-------|---------|------|
| `.btn-sm` | 8px 16px | 12px |
| `.btn-md` | 12px 24px | 14px |
| `.btn-lg` | 16px 32px | 16px |

---

## Cards & Modals

### Service Card (Dashboard)

```css
.service-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 25px 20px;
    text-align: center;
    background: #fff;
    border: 1px solid #a3bece;
    border-radius: 12px;
    cursor: pointer;
    transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.service-card:hover {
    transform: translateY(-2px);
    border-color: #289ee7;
    box-shadow: 0 8px 24px rgba(24, 84, 142, 0.12);
}

.service-card i {
    width: 48px;
    height: 48px;
    color: #18548e;
}
```

### Modal

```css
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(24, 84, 142, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: none;
    align-items: center;
    justify-content: center;
}

.modal-overlay.active {
    display: flex;
}

.modal-content {
    background: #fff;
    border-radius: 16px;
    max-width: 800px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    animation: modalSlide 0.3s ease;
}

@keyframes modalSlide {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
}

.modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid #a3bece;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
```

---

## Tables

### Data Table

```css
.table-container {
    overflow-x: auto;
    background: #fff;
    border: 1px solid #a3bece;
    border-radius: 12px;
}

.data-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    min-width: 640px;
}

.data-table th {
    background: rgba(24, 84, 142, 0.04);
    color: #18548e;
    font-weight: 600;
    padding: 12px 16px;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.08em;
    border-bottom: 2px solid #e9eef2;
}

.data-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #e9eef2;
}

.data-table tbody tr:hover {
    background: rgba(40, 158, 231, 0.03);
}
```

### Status Badges

| Class | Background | Color |
|-------|------------|-------|
| `.badge-pending` | rgba(245, 158, 11, 0.15) | #d97706 |
| `.badge-approved` | rgba(16, 185, 129, 0.15) | #059669 |
| `.badge-rejected` | rgba(239, 68, 68, 0.15) | #dc2626 |

---

## Multi-Language Support

### Supported Languages

| Language | Code | Coverage |
|----------|------|----------|
| English | `en` | Full |
| Hindi | `hi` | Full |
| Gujarati | `gu` | Full |

### Language Selector

Added to the footer of all pages:

```html
<footer class="app-footer">
    <div class="footer-lang-selector">
        <i data-lucide="languages" style="width: 14px; height: 14px;"></i>
        <select id="footer-lang-select" onchange="setLanguage(this.value)">
            <option value="en" selected>English</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="gu">ગુજરાતી (Gujarati)</option>
        </select>
    </div>
</footer>
```

### CSS Styles

```css
.footer-lang-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 16px;
    padding-left: 16px;
    border-left: 1px solid var(--border-color);
}

.footer-lang-selector select {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px 8px;
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    outline: none;
}

.footer-lang-selector select:hover,
.footer-lang-selector select:focus {
    border-color: var(--neon-cyan);
    box-shadow: 0 0 0 2px rgba(100, 200, 255, 0.2);
}
```

### Translation Implementation

**File: `frontend/src/citizen/citizen.js`** (Citizen Portal)

```javascript
const i18n = {
    en: { /* English translations */ },
    hi: { /* Hindi translations */ },
    gu: { /* Gujarati translations */ }
};

let currentLang = "en";

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('kanad-lang', lang);
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang] && i18n[lang][key]) {
            if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
                el.placeholder = i18n[lang][key];
            } else if (el.tagName === 'OPTION') {
                el.text = i18n[lang][key];
            } else {
                el.textContent = i18n[lang][key];
            }
        }
    });
}
```

**File: `frontend/src/police/police.js`** (Police Portal)

```javascript
// Same i18n structure as citizen.js
// Includes additional police-specific translations:
// - Portal titles
// - Complaint statuses
// - Action buttons
```

### Usage

Add `data-i18n` attribute to any element that needs translation:

```html
<button data-i18n="form_submit">Submit</button>
<a href="/contact" data-i18n="footer_contact">Contact Us</a>
<span data-i18n="footer_rights">All rights reserved</span>
```

### Affected Pages

| Page | Language Support |
|------|----------------|
| `/frontend/src/citizen/index.html` | ✅ Full |
| `/frontend/src/citizen/fraud-complaint.html` | ✅ Full |
| `/frontend/src/citizen/sitemanager.html` | ✅ Full |
| `/frontend/public/contact.html` | ✅ Full |
| `/frontend/src/police/employee.html` | ✅ Full |
| `/frontend/src/police/admin.html` | ✅ Full |
| `/frontend/src/police/dashboard.html` | ✅ Full |

---

## Citizen Portal Features

### 1. Dashboard Home

#### Hero Section
- **Grid Layout**: 1.15fr / 0.85fr split
- **Background**: Gradient overlay + Unsplash image

```css
.hero-section {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 28px;
    background: linear-gradient(180deg, #f7f1e8 0%, #b8bfd0 100%);
    border: 1px solid rgba(24,84,142,0.12);
    border-radius: 18px;
    padding: 28px;
}
```

#### Service Cards Grid

```css
.services-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-top: 30px;
}

@media (max-width: 1024px) {
    .services-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
    .services-grid { grid-template-columns: 1fr; }
}
```

---

### 2. Financial Frauds

#### Hero Section
- **Background**: `linear-gradient(135deg, rgba(215, 195, 150, 0.18), rgba(24,84,142,0.08))`
- **Icon**: `banknote` (48x48, #18548e)
- **Description**: "Report UPI, SMS, Bank, or Credit Card frauds"

#### Form Fields

| Field | Type | Required | Options |
|-------|------|----------|---------|
| Fraud Type | Select | Yes | UPI, SMS Phishing, Bank, Credit Card, Other |
| Amount Lost | Number | Yes | INR value |
| Incident Date | DateTime | Yes | Date/time picker |
| Details | Textarea | Yes | Free text |
| Evidence | File | No | Attachment upload |

---

### 3. Cyber Tipline (Child Safety)

#### Hero Section
- **Theme**: Warm, approachable but serious
- **Background**: Cream/amber tones
- **Color**: #d7861d amber accent

```css
.child-safety-shell {
    background: linear-gradient(180deg, #fffdf9 0%, #f7f1e8 100%);
    border: 1px solid rgba(24,84,142,0.12);
    box-shadow: 0 12px 30px rgba(24,84,142,0.08);
}

.child-safety-hero {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 28px;
    padding: 10px 10px 18px;
}
```

#### Alert Boxes

```css
.child-safety-alert-box {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 12px;
    padding: 14px 18px;
}

.child-safety-alert-box.danger {
    background: rgba(200, 60, 60, 0.1);
    border: 1px solid rgba(200, 60, 60, 0.25);
}

.child-safety-alert-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(220, 60, 60, 0.9);
    color: white;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

#### Form Fields

| Field | Type | Required |
|-------|------|----------|
| Problem Type | Select | Yes |
| Victim Age | Number | Yes |
| Description | Textarea | Yes |
| Suspect Info | Text | No |
| Evidence | File | No |
