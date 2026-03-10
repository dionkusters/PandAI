import Anthropic from "@anthropic-ai/sdk";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { type, data, toon, fileBase64, fileMediaType, fileType, tekst } = req.body;
    let messages = [];

    const prompt = bouwPrompt(toon, tekst || "");

    if (fileBase64 && (fileMediaType?.startsWith("image/") || fileMediaType === "application/pdf")) {
      // Afbeelding of PDF: stuur als vision/document
      messages = [{
        role: "user",
        content: [
          fileMediaType === "application/pdf"
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
            : { type: "image", source: { type: "base64", media_type: fileMediaType, data: fileBase64 } },
          { type: "text", text: prompt }
        ]
      }];
    } else if (tekst) {
      // Word of Excel: uitgelezen tekst
      messages = [{ role: "user", content: prompt }];
    } else {
      // Handmatige data
      messages = [{ role: "user", content: bouwHandmatigPrompt(data, toon) }];
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages
    });

    const resultaat = response.content.map(i => i.text || "").join("");
    res.status(200).json({ resultaat });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Er ging iets mis" });
  }
}

function bouwPrompt(toon, documentTekst) {
  return `Je bent een expert vastgoedcopywriter in Nederland. Analyseer het bijgevoegde inventarisatiedocument van een makelaarsbezichtiging en extraheer alle pandgegevens.
${documentTekst ? "\nDOCUMENT INHOUD:\n" + documentTekst + "\n" : ""}
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
${Object.entries(data).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

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
