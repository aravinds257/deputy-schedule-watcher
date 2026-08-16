# Deputy Schedule & Excel Exporter (GitHub Pages Ready)

A modern, fast, client-side web application to connect with the **Deputy API**, retrieve your personal shifts & schedules for custom date ranges (e.g. July 2026), automatically resolve your employee/member profile, display an interactive spreadsheet preview, and export clean formatted **Excel (`.xlsx`)** and **CSV** files.

Designed to be hosted directly on **GitHub Pages** with zero backend or server maintenance.

---

## 🌟 Key Features

- 🔐 **Deputy Authentication & Permanent Bearer Token Support**:
  - Securely authenticate using your Deputy Permanent API Token or Bearer Token.
  - All credentials stay 100% in your local browser (`localStorage`) and are never sent to external servers.
- 👤 **Automatic Member Profile Resolution**:
  - Automatically queries `/api/v1/me` to get your `memberId`, full name, and role.
  - Automatically filters shift queries so you only see shifts belonging to you (the authenticated user).
- 📅 **Custom Date Range & Presets**:
  - Query shifts for specific months (e.g., July 2026: `2026-07-01` to `2026-07-31`) or standard ranges (*This Month*, *Next Month*, *Last Month*).
  - Uses Deputy's endpoint `POST /api/schedule/v2/me/shifts:search` with ISO timezone offset format.
- 📊 **Interactive Schedule Preview & Excel (.xlsx) Exporter**:
  - Interactive table with sorting by date, hours, position, status, and live search.
  - 1-Click download of formatted Excel spreadsheets generated with **SheetJS**, complete with total hours formulas, customized column widths, and metadata.
- 🌐 **GitHub Pages & CORS Resilience**:
  - Built-in toggle for CORS Proxies (e.g. `corsproxy.io`) so requests from `*.github.io` succeed seamlessly without browser CORS blocking.
  - Emergency fallback for pasting raw JSON responses.
- 🧪 **Instant Demo Mode**:
  - Test the entire UI and Excel export flow with sample shifts without needing your token right away.

---

## 🚀 How to Obtain Your Deputy Bearer Token (15 Seconds)

1. Log in to your Deputy organization in your web browser:
   ```
   https://a2c28219075424.uk.deputy.com
   ```
2. Navigate directly to the developer OAuth clients page:
   ```
   https://a2c28219075424.uk.deputy.com/exec/devapp/oauth_clients
   ```
   *(Or click **Profile Icon** &rarr; **Account Settings** &rarr; **Developer Tools**)*
3. Click **"Get an access token"** / **"Permanent Token"**.
4. Copy the token string and paste it into the **Bearer Token** field in the app.

---

## 📂 Deploying to GitHub Pages

### Option A: Standard GitHub Pages Deployment (Recommended)

1. Create a new GitHub repository (e.g. `deputy-schedule-exporter`).
2. Push this folder to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Deputy schedule exporter app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/deputy-schedule-exporter.git
   git push -u origin main
   ```
3. In GitHub:
   - Go to your repository **Settings** &rarr; **Pages**.
   - Under **Build and deployment** &gt; **Source**, select **GitHub Actions** (or select **Deploy from a branch** &rarr; `main` &rarr; `/ (root)`).
4. Your application will be live at:
   `https://<your-username>.github.io/deputy-schedule-exporter/`

---

## 💻 Running Locally

You can run this app locally using any static web server:

```bash
# Using Python 3:
python3 -m http.server 8080

# Or using Node.js npx serve:
npx serve .
```

Open your browser at `http://localhost:8080`.

---

## 📡 Deputy API Endpoint Reference

- **Profile**: `GET https://{instance}.deputy.com/api/v1/me`
- **Shifts Search**: `POST https://{instance}.deputy.com/api/schedule/v2/me/shifts:search`
  - **Payload**:
    ```json
    {
      "data": {
        "start": "2026-07-01T00:00:00+01:00",
        "end": "2026-07-31T23:59:59+01:00",
        "locationIds": [],
        "locationMode": "ALL",
        "expandMetadata": true
      }
    }
    ```
