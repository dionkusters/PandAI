const express = require('express');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_WACHTWOORD = process.env.ADMIN_WACHTWOORD || 'pandai-admin-2024';

app.use(express.json({ limit: '10mb' }));

const DATA_PAD = '/tmp/pandai_data.json';

function laadData() {
  try {
    if (fs.existsSync(DATA_PAD)) {
      return JSON.parse(fs.readFileSync(DATA_PAD, 'utf8'));
    }
  } catch (e) {}
  return {
    codes: [
      { code: 'DEMO2024', naam: 'Demo Account', actief: true, aangemaakt: new Date().toISOString(), gebruik: 0 }
    ],
    logs: []
  };
}

function slaDataOp(data) {
  try { fs.writeFileSync(DATA_PAD, JSON.stringify(data, null, 2)); } catch (e) {}
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/tool', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/inloggen', (req, res) => {
  const { code } = req.body;
  const data = laadData();
  const gevonden = data.codes.find(c => c.code.toUpperCase() === (code || '').toUpperCase() && c.actief);

  if (!gevonden) {
    return res.status(401).json({ succes: false, fout: 'Ongeldige of inactieve toegangscode.' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'onbekend';
  gevonden.gebruik = (gevonden.gebruik || 0) + 1;
  gevonden.laatste_gebruik = new Date().toISOString();

  data.logs.unshift({
    id: Date.now(),
    code: gevonden.code,
    naam: gevonden.naam,
    ip: ip,
    tijdstip: new Date().toISOString(),
    actie: 'ingelogd'
  });

  if (data.logs.length > 500) data.logs = data.logs.slice(0, 500);
  slaDataOp(data);

  res.json({ succes: true, naam: gevonden.naam });
});

app.post('/api/log-generatie', (req, res) => {
  const { code } = req.body;
  const data = laadData();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'onbekend';

  data.logs.unshift({
    id: Date.now(),
    code: code || 'onbekend',
    naam: (data.codes.find(c => c.code === code) || {}).naam || 'onbekend',
    ip: ip,
    tijdstip: new Date().toISOString(),
    actie: 'tekst_gegenereerd'
  });

  if (data.logs.length > 500) data.logs = data.logs.slice(0, 500);
  slaDataOp(data);
  res.json({ ok: true });
});

app.get('/api/admin/codes', (req, res) => {
  if (req.headers['x-admin-wachtwoord'] !== ADMIN_WACHTWOORD) return res.status(403).json({ fout: 'Geen toegang' });
  res.json(laadData().codes);
});

app.get('/api/admin/logs', (req, res) => {
  if (req.headers['x-admin-wachtwoord'] !== ADMIN_WACHTWOORD) return res.status(403).json({ fout: 'Geen toegang' });
  res.json(laadData().logs.slice(0, 100));
});

app.post('/api/admin/codes', (req, res) => {
  if (req.headers['x-admin-wachtwoord'] !== ADMIN_WACHTWOORD) return res.status(403).json({ fout: 'Geen toegang' });
  const { naam, code } = req.body;
  if (!naam || !code) return res.status(400).json({ fout: 'Naam en code zijn verplicht' });
  const data = laadData();
  if (data.codes.find(c => c.code.toUpperCase() === code.toUpperCase())) {
    return res.status(400).json({ fout: 'Code bestaat al' });
  }
  data.codes.push({ code: code.toUpperCase(), naam, actief: true, aangemaakt: new Date().toISOString(), gebruik: 0 });
  slaDataOp(data);
  res.json({ ok: true });
});

app.patch('/api/admin/codes/:code', (req, res) => {
  if (req.headers['x-admin-wachtwoord'] !== ADMIN_WACHTWOORD) return res.status(403).json({ fout: 'Geen toegang' });
  const data = laadData();
  const gevonden = data.codes.find(c => c.code === req.params.code);
  if (!gevonden) return res.status(404).json({ fout: 'Code niet gevonden' });
  gevonden.actief = !gevonden.actief;
  slaDataOp(data);
  res.json({ ok: true, actief: gevonden.actief });
});

app.delete('/api/admin/codes/:code', (req, res) => {
  if (req.headers['x-admin-wachtwoord'] !== ADMIN_WACHTWOORD) return res.status(403).json({ fout: 'Geen toegang' });
  const data = laadData();
  data.codes = data.codes.filter(c => c.code !== req.params.code);
  slaDataOp(data);
  res.json({ ok: true });
});

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
