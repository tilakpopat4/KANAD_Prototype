# ForenSync - UI Consistency Rules

## Header and Footer - MUST REMAIN CONSISTENT ACROSS ALL PAGES

Every HTML page (index.html, employee.html, sitemanager.html, contact.html,
privacy-policy.html, etc.) MUST use the same canonical header and footer.

---

## Canonical Footer

All pages use this exact footer HTML. Do not alter it per-page:

    <footer class="app-footer">
        <a href="/contact">Contact Us</a>
        <a href="/privacy-policy">Privacy Policy</a>
        <span>&copy; National Cyber Crime Reporting Portal. All rights reserved.</span>
    </footer>

The .app-footer CSS class lives ONLY in frontend/style.css.
NEVER add inline styles to .app-footer elements.

---

## Canonical Header (citizen-facing pages)

    <header class="notranslate">
        <div class="logo-area" onclick="window.location.href='/'" style="cursor:pointer;">
            <img src="/frontend/assets/logo.png" alt="CCI Logo" class="logo-img">
            <div>
                <div class="logo-text">ForenSync</div>
                <div class="logo-sub">National Cyber Crime Reporting Portal</div>
            </div>
        </div>
    </header>

---

## Rules

1. NEVER change footer or header HTML on one page without updating ALL other pages.
2. NEVER add inline styles to .app-footer, .app-footer a, or .app-footer span.
   All footer styling is in frontend/style.css only.
3. NEVER put the footer inside a nested grid column.
   It must be a direct child of .container or the outermost wrapper.
4. When adding a NEW PAGE, always include the canonical footer and header above.
5. All header/footer layout changes must go into frontend/style.css so they apply site-wide.
