
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
      max_tokens: 1000,
      messages
    });

    const resultaat = response.content.map(i => i.text || '').join('');
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
