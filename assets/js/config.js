/* ==========================================================================
   Nishok Greens — lead capture settings
   Paste your form endpoint below. Nothing else needs to change.

   Works with any service that accepts a JSON POST, e.g.
   • Formspree      endpoint: 'https://formspree.io/f/xxxxxxx'
   • Web3Forms      endpoint: 'https://api.web3forms.com/submit', accessKey: 'your-access-key'
   • Getform/Basin  endpoint: the form URL they give you
   • Your CRM / API endpoint: your own URL (respond 2xx on success)
   • Google Apps Script web app (writes to a Google Sheet):
                    endpoint: 'https://script.google.com/macros/s/.../exec', mode: 'no-cors'

   While `endpoint` is empty the forms run in demo mode: they validate and
   show the thank-you message, but nothing is sent.
   ========================================================================== */
window.NISHOK_FORMS = {
  // Google Sheet: paste your Apps Script web-app URL (ends in /exec). See google-sheet/SETUP.md
  endpoint: '',
  accessKey: '',          // only needed for Web3Forms
  mode: 'no-cors',        // 'no-cors' for Google Apps Script; use 'json' for Formspree, Web3Forms or your own API
  timeoutMs: 15000,
  fallbackPhone: '+91 62625 85888', // shown if sending fails
};
