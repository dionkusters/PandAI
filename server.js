const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/genereer', async (req, res) => {
  try {
    const { toon, fileBase64, fileMediaType, tekst, data } = req.body;
    let messages = [];

    if (fileBase64 && fileMediaType) {
      const isPDF = fileMediaType === 'application/pdf';
      messages = [{
        role: 'user',
        content: [
          isPDF
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
            : { type: 'image', source: { type: 'base64', media_type: fileMediaType, data: fileBase64 } },
          { type: 'text', text: bouwPrompt(toon, '') }
        ]
      }];
    } else if (tekst) {
      messages = [{ role: 'user', content: bouwPrompt(toon, tekst) }];
    } else {
      messages = [{ role: 'user', content: bouwHandmatigPrompt(data, toon) }];
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

function bouwPrompt(toon, documentTekst) {
  return 'Je bent een expert vastgoedcopywriter in Nederland. Analyseer het bijgevoegde inventarisatiedocument en extraheer alle pandgegevens.\n' +
    (documentTekst ? '\nDOCUMENT INHOUD:\n' + documentTekst + '\n' : '') +
    '\nSchrijfstijl: ' + toon +
    PROMPT_STRUCTUUR;
}

function bouwHandmatigPrompt(data, toon) {
  const pandInfo = Object.entries(data).map(([k, v]) => '- ' + k + ': ' + v).join('\n');
  return 'Je bent een expert vastgoedcopywriter in Nederland.\n\nPANDGEGEVENS:\n' +
    pandInfo +
    '\n\nSchrijfstijl: ' + toon +
    PROMPT_STRUCTUUR;
}

app.listen(PORT, () => console.log('PandAI draait op poort ' + PORT));
