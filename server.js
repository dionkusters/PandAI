
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
      const isAfbeelding = fileMediaType.startsWith('image/');
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

function bouwPrompt(toon, documentTekst) {
  return `Je bent een expert vastgoedcopywriter in Nederland. Analyseer het bijgevoegde inventarisatiedocument en extraheer alle pandgegevens.
${documentTekst ? '\nDOCUMENT INHOUD:\n' + documentTekst + '\n' : ''}
Schrijfstijl: ${toon}

Genereer een professionele Funda verkooptekst met EXACT deze structuur:

TITEL:
[Pakkende titel van 7-12 woorden die het unieke kenmerk benadrukt]

KORT:
[Precies 56 woorden - dit is de Funda intro die direct zichtbaar is. Begin met het sterkste kenmerk, eindig met een nieuwsgierigheidsprikkel]

VOLLEDIG:
[350-500 woorden totaal. Opbouw:
- Alinea 1 (60-80 woorden): Sfeer en gevoel, waarom is deze woning bijzonder?
- Alinea 2 (60-80 woorden): Begane grond rondleiding
- Alinea 3 (60-80 woorden): Verdieping(en) en slaapkamers
- Alinea 4 (40-60 woorden): Tuin, garage, buitenruimte
- Alinea 5 (40-60 woorden): Locatie en omgeving
- Bullet lijst: 5-7 belangrijkste kenmerken (oneven aantal werkt beter)
- Afsluitende zin met uitnodiging tot bezichtiging]

SOCIAL:
[Max 80 woorden, eigen creatieve invalshoek, 4-5 relevante hashtags]

Schrijfstijl: ${toon}

Belangrijke regels:
- Varieer de opbouw en zinsstructuur elke keer anders
- Begin NOOIT met "Deze woning" of "Dit pand"
- Vermijd clichés zoals "sfeervolle woning", "kindvriendelijke wijk", "instapklaar"
- Schrijf vanuit het perspectief van de koper (jij/je), niet de verkoper
- Gebruik concrete details en feiten, geen vage superlatieven
- Schrijf in correct Nederlands

function bouwHandmatigPrompt(data, toon) {
  return `Je bent een expert vastgoedcopywriter in Nederland.

PANDGEGEVENS:
${Object.entries(data).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Schrijfstijl: ${toon}

Genereer met EXACT deze structuur:

TITEL:
[Pakkende titel maximaal 12 woorden]

KORT:
[Funda intro 2-3 zinnen, max 60 woorden]

VOLLEDIG:
[Verkooptekst 150-200 woorden, geen bulletpoints, eindig met uitnodiging tot bezichtiging]

SOCIAL:
[Social media caption max 80 woorden met 4-5 hashtags]

Schrijf in correct Nederlands.`;
}

app.listen(PORT, () => console.log(`PandAI draait op poort ${PORT}`));
