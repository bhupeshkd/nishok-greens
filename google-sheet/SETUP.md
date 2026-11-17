# Send website leads to a Google Sheet

About 5 minutes. You only do this once.

## 1. Create the sheet
1. Go to <https://sheets.new> (signed in with the Google account that should own the leads).
2. Name it, e.g. **Nishok Greens — Website Leads**.

## 2. Add the script
1. In the sheet: **Extensions → Apps Script**.
2. Delete everything in `Code.gs`, then paste the full contents of [`Code.gs`](Code.gs) from this folder.
3. Optional: to get an email for every lead, set `NOTIFY_EMAIL` near the top, e.g. `'sales@nishokgreens.com'`.
4. Click **Save** (disk icon).

## 3. Publish it as a web app
1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" → **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone  *(needed so website visitors can submit; they can only add rows, never read the sheet)*
4. Click **Deploy**, then **Authorize access** and allow it with your Google account.
   If you see "Google hasn't verified this app": **Advanced → Go to (project name)**. This is your own script.
5. Copy the **Web app URL** (ends in `/exec`).

Check it: open that URL in a browser. You should see
`{"success":true,"message":"Nishok Greens lead endpoint is live."}`

## 4. Connect the website
Open `assets/js/config.js` and paste the URL:

```js
endpoint: 'https://script.google.com/macros/s/XXXXXXXX/exec',
mode: 'no-cors',
```

Submit a test enquiry on the site. A **Leads** tab appears in the sheet with headers and your test row.

## Good to know
- **Columns:** received time (IST), form type, name, mobile, email, interest, configuration, date, slot, consent, UTM / ad-click fields, referrer, page, plus **Lead Status** (starts as "New") and **Notes** for your sales team.
- **Editing the script later:** after changing `Code.gs`, use **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. This keeps the same URL. Choosing "New deployment" instead gives a new URL that you'd have to paste into `config.js` again.
- **Limits:** a free Google account allows about 100 notification emails a day; rows themselves are effectively unlimited for a website's lead volume.
- **Failures:** Google's reply can't be read by the browser in this mode, so the site only shows an error if the network request itself fails. If a lead ever seems missing, check **Executions** in the Apps Script editor.
- **Privacy:** the sheet holds personal details. Share it only with people who need it.
