const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_WACHTWOORD = process.env.ADMIN_WACHTWOORD || 'pandai-admin-2024';

app.use(express.json({ limit: '10mb' }));

// ─── DATA OPSLAG VIA ENVIRONMENT VARIABLES ────────────────────────────────────
// Codes leven in PANDAI_CODES (Railway variable) — nooit kwijt bij deploy
// Logs leven in geheugen — verdwijnen bij deploy maar codes blijven altijd

let codesInMemory = null;
let logsInMemory = [];

function laadCodes() {
  if (codesInMemory) return codesInMemory;

  if (process.env.PANDAI_CODES) {
    try {
      codesInMemory = JSON.parse(process.env.PANDAI_CODES);
      console.log('Codes geladen uit PANDAI_CODES:', codesInMemory.length, 'codes');
      return codesInMemory;
    } catch (e) {
      console.error('Fout bij parsen PANDAI_CODES:', e.message);
    }
  }

  console.log('PANDAI_CODES niet ingesteld, gebruik demo code');
  codesInMemory = [
    { code: 'DEMO2024', naam: 'Demo Account', actief: true, aangemaakt: new Date().toISOString(), gebruik: 0 }
  ];
  return codesInMemory;
}

function printCodesVoorRailway() {
  console.log('--- KOPIEER DIT NAAR RAILWAY PANDAI_CODES ---');
  console.log(JSON.stringify(codesInMemory));
  console.log('---------------------------------------------');
}

function voegCodeToe(nieuwCode) {
  const codes = laadCodes();
  codes.push(nieuwCode);
  codesInMemory = codes;
  printCodesVoorRailway();
  return codes;
}

function wijzigCode(codeNaam, wijzigingen) {
  const codes = laadCodes();
  const gevonden = codes.find(c => c.code === codeNaam);
  if (gevonden) Object.assign(gevonden, wijzigingen);
  codesInMemory = codes;
  printCodesVoorRailway();
  return gevonden;
}

function verwijderCode(codeNaam) {
  const codes = laadCodes();
  codesInMemory = codes.filter(c => c.code !== codeNaam);
  printCodesVoorRailway();
  return codesInMemory;
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/tool', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.use(express.static(path.join(__dirname, 'public')));

// ─── AUTH ──────────────────────────────────────────────────────────────────────

app.post('/api/inloggen', (req, res) => {
  const { code } = req.body;
  const codes = laadCodes();
  const gevonden = codes.find(c => c.code.toUpperCase() === (code || '').toUpperCase() && c.actief);

  if (!gevonden) {
    return res.status(401).json({ succes: false, fout: 'Ongeldige of inactieve toegangscode.' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'onbekend';
  gevonden.gebruik = (gevonden.gebruik || 0) + 1;
  gevonden.laatste_gebruik = new Date().toISOString();

  logsInMemory.unshift({
    id: Date.now(),
    code: gevonden.code,
    naam: gevonden.naam,
    ip,
    tijdstip: new Date().toISOString(),
    actie: 'ingelogd'
  });

  if (logsInMemory.length > 500) logsInMemory = logsInMemory.slice(0, 500);
  res.json({ succes: true, naam: gevonden.naam });
});

app.post('/api/log-generatie', (req, res) => {
  const { code } = req.body;
  const codes = laadCodes();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'onbekend';

  logsInMemory.unshift({
    id: Date.now(),
    code: code || 'onbekend',
    naam: (codes.find(c => c.code === code) || {}).naam || 'onbekend',
    ip,
    tijdstip: new Date().toISOString(),
    actie: 'tekst_gegenereerd'
  });

  if (logsInMemory.length > 500) logsInMemory = logsInMemory.slice(0, 500);
  res.json({ ok: true });
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

function checkAdmin(req, res) {
  if (req.headers['x-admin-wachtwoord'] !== ADMIN_WACHTWOORD) {
    res.status(403).json({ fout: 'Geen toegang' });
    return false;
  }
  return true;
}

app.get('/api/admin/codes', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json(laadCodes());
});

app.get('/api/admin/logs', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json(logsInMemory.slice(0, 100));
});

app.post('/api/admin/codes', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { naam, code } = req.body;
  if (!naam || !code) return res.status(400).json({ fout: 'Naam en code zijn verplicht' });

  const codes = laadCodes();
  if (codes.find(c => c.code.toUpperCase() === code.toUpperCase())) {
    return res.status(400).json({ fout: 'Code bestaat al' });
  }

  voegCodeToe({ code: code.toUpperCase(), naam, actief: true, aangemaakt: new Date().toISOString(), gebruik: 0 });
  res.json({ ok: true });
});

app.patch('/api/admin/codes/:code', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const codes = laadCodes();
  const huidig = codes.find(c => c.code === req.params.code);
  if (!huidig) return res.status(404).json({ fout: 'Code niet gevonden' });
  const gevonden = wijzigCode(req.params.code, { actief: !huidig.actief });
  res.json({ ok: true, actief: gevonden.actief });
});

app.delete('/api/admin/codes/:code', (req, res) => {
  if (!checkAdmin(req, res)) return;
  verwijderCode(req.params.code);
  res.json({ ok: true });
});

// Export huidige codes als JSON string voor Railway
app.get('/api/admin/export-codes', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({ pandai_codes: JSON.stringify(laadCodes()) });
});

// ─── AI GENERATIE ──────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/genereer', async (req, res) => {
  try {
    const { toon, fileBase64, fileMediaType, tekst, data, schrijfstijl } = req.body;
    let messages = [];

    const stijlInstructie = schrijfstijl && schrijfstijl.length > 0
      ? '\n\nSCHRIJFSTIJL VAN DEZE MAKELAAR (analyseer en kopieer exact deze stijl):\n' +
        schrijfstijl.map((t, i) => 'Voorbeeld ' + (i+1) + ':\n' + t).join('\n\n')
      : '';

    if (fileBase64 && fileMediaType) {
      const isPDF = fileMediaType === 'application/pdf';
      messages = [{
        role: 'user',
        content: [
          isPDF
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
            : { type: 'image', source: { type: 'base64', media_type: fileMediaType, data: fileBase64 } },
          { type: 'text', text: bouwPrompt(toon, '', stijlInstructie) }
        ]
      }];
    } else if (tekst) {
      messages = [{ role: 'user', content: bouwPrompt(toon, tekst, stijlInstructie) }];
    } else {
      messages = [{ role: 'user', content: bouwHandmatigPrompt(data, toon, stijlInstructie) }];
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages
    });

    const raw = response.content.map(i => i.text || '').join('');
    const resultaat = raw.replace(/\*\*/g, '').replace(/\*/g, '');
    res.json({ resultaat });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Er ging iets mis' });
  }
});

const PROMPT_STRUCTUUR = `
Genereer een professionele Funda verkooptekst met EXACT deze structuur:

TITEL:
[Pakkende titel van 7-12 woorden die het unieke kenmerk benadrukt]

KORT:
[Precies 56 woorden - Funda intro die direct zichtbaar is. Begin met het sterkste kenmerk, eindig met een nieuwsgierigheidsprikkel]

VOLLEDIG:
[350-500 woorden totaal. Opbouw: Alinea 1 sfeer en gevoel waarom is deze woning bijzonder. Alinea 2 begane grond rondleiding. Alinea 3 verdiepingen en slaapkamers. Alinea 4 tuin en buitenruimte. Alinea 5 locatie en omgeving. Sluit af met 5-7 bullet punten van de belangrijkste kenmerken en een uitnodiging tot bezichtiging]

SOCIAL:
[Max 80 woorden, creatieve invalshoek, 4-5 relevante hashtags]

Regels: varieer de opbouw elke keer anders. Begin nooit met Deze woning of Dit pand. Vermijd cliches zoals sfeervolle woning, kindvriendelijke wijk of instapklaar. Schrijf vanuit perspectief van de koper. Gebruik concrete feiten. Schrijf in correct Nederlands.`;

function bouwPrompt(toon, documentTekst, stijlInstructie) {
  return 'Je bent een expert vastgoedcopywriter in Nederland. Analyseer het bijgevoegde inventarisatiedocument en extraheer alle pandgegevens.\n' +
    (documentTekst ? '\nDOCUMENT INHOUD:\n' + documentTekst + '\n' : '') +
    '\nSchrijfstijl: ' + toon +
    (stijlInstructie || '') +
    PROMPT_STRUCTUUR;
}

function bouwHandmatigPrompt(data, toon, stijlInstructie) {
  const pandInfo = Object.entries(data).map(([k, v]) => '- ' + k + ': ' + v).join('\n');
  return 'Je bent een expert vastgoedcopywriter in Nederland.\n\nPANDGEGEVENS:\n' +
    pandInfo +
    '\n\nSchrijfstijl: ' + toon +
    (stijlInstructie || '') +
    PROMPT_STRUCTUUR;
}

app.listen(PORT, () => console.log('PandAI draait op poort ' + PORT));
