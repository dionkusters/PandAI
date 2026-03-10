# PandAI — Verkoopteksten Generator

## 🚀 Live zetten in 10 minuten

### Stap 1 — GitHub account aanmaken
1. Ga naar **github.com** en maak een gratis account aan
2. Klik op **"New repository"** (groene knop rechtsboven)
3. Naam: `pandai`
4. Zet op **Public**
5. Klik **"Create repository"**

### Stap 2 — Bestanden uploaden naar GitHub
1. In je nieuwe repository, klik op **"uploading an existing file"**
2. Sleep de volgende bestanden erin:
   - `package.json`
   - `vercel.json`
   - De map `api/` met daarin `genereer.js`
   - De map `public/` met daarin `index.html`
3. Klik **"Commit changes"**

### Stap 3 — Vercel account aanmaken
1. Ga naar **vercel.com**
2. Klik **"Sign up"** → kies **"Continue with GitHub"**
3. Geef Vercel toegang tot je GitHub account

### Stap 4 — Project importeren
1. Klik op **"Add New Project"**
2. Selecteer je `pandai` repository
3. Klik **"Deploy"** — Vercel detecteert alles automatisch

### Stap 5 — API key instellen ⚠️ BELANGRIJK
1. Ga naar **console.anthropic.com**
2. Maak een account aan en ga naar **"API Keys"**
3. Klik **"Create Key"** — kopieer de key (begint met `sk-ant-...`)
4. Ga terug naar Vercel → jouw project → **"Settings"** → **"Environment Variables"**
5. Voeg toe:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** jouw API key
6. Klik **"Save"**
7. Ga naar **"Deployments"** → klik **"Redeploy"**

### Stap 6 — Live! 🎉
Je app is nu live op: `pandai.vercel.app` (of vergelijkbaar)
Deel deze URL met makelaars voor je demo!

---

## 💰 Kosten
- Vercel hosting: **gratis**
- GitHub: **gratis**
- Anthropic API: ~**€0,003 per gegenereerde tekst** (3 cent per gebruik)

## 📞 Hulp nodig?
Vraag het aan PandAI via claude.ai!
