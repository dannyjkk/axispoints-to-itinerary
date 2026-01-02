import OpenAI from 'openai';

let openai = null;
const getClient = () => {
  if (openai) return openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  openai = new OpenAI({ apiKey: key });
  return openai;
};

// Fallback: if LLM fails or API key missing, return the raw string as a single "airport"
const fallbackResolution = (raw) => ({
  airports: [
    {
      iata: raw?.trim() || '',
      city: null,
      country: null,
      distanceKm: 0,
    },
  ],
  input_type: 'unknown',
  confidence: 'low',
  notes: 'LLM unavailable; passed through raw input',
});

export async function resolveLocation(rawDestination) {
  if (!rawDestination) return fallbackResolution(rawDestination);
  const client = getClient();
  if (!client) return fallbackResolution(rawDestination);

  const prompt = `
You are a travel location resolver.

Given a free-text destination that may be:
- a city
- a country
- a region
- an ambiguous region

Return airport IATA codes suitable for award-flight searches.

========================
RESPONSE FORMAT (STRICT)
========================

Respond ONLY with valid JSON in the following structure:

{
  "airports": [
    {
      "iata": "XXX",
      "city": "City Name or null",
      "country": "Country Name or null",
      "distanceKm": 0
    }
  ],

  "input_type": "city | country | region | ambiguous_region | unknown",
  "confidence": "high | medium | low",
  "notes": "short explanation"
}

- "airports" MUST always be present and top-level.
- Additional fields are OPTIONAL but allowed.
- Do NOT nest "airports" under any other object.

========================
AIRPORT COUNT RULES
========================

- If input is a CITY or COUNTRY:
  → return 1 to 3 airports

- If input is a REGION or AMBIGUOUS REGION:
  → return EXACTLY 5 airports

- NEVER return more than 5 airports.

========================
AIRPORT SELECTION RULES
========================

- Use UPPERCASE IATA codes only.
- Prefer major international hubs with strong long-haul and alliance connectivity.
- Optimize for likelihood of award availability, not geographic coverage.
- If input already looks like a valid IATA code, return it as-is.

========================
REGION HANDLING (GENERALIZED)
========================

- Regions are broad geographic groupings (e.g. continents, sub-continents, or commonly used travel regions).
- Ambiguous region labels may reasonably map to multiple interpretations.
- For ambiguous regions:
  - Choose ONE sensible default interpretation.
  - Set confidence = "medium"
  - Explain the assumption in "notes"
  - Do NOT ask clarification questions.

========================
DISTANCE RULES
========================

- distanceKm must be a NUMBER.
- Use an approximate great-circle distance from the location center.
- If unknown or not meaningful (e.g. regions), use 0.

========================
FAILURE SAFETY
========================

- Always return at least one airport unless the input is completely invalid.
- Never invent fake IATA codes.
- If uncertain, return fewer airports rather than more.

========================
INPUT
========================

Destination: "${rawDestination}"
`;

  try {
    const resp = await client.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: 'location_resolution',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              airports: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    iata: { type: 'string' },
                    city: { type: ['string', 'null'] },
                    country: { type: ['string', 'null'] },
                    distanceKm: { type: 'number' },
                  },
                  required: ['iata', 'city', 'country', 'distanceKm'],
                },
                minItems: 1,
                maxItems: 5,
              },
              input_type: {
                type: 'string',
                enum: ['city', 'country', 'region', 'ambiguous_region', 'unknown'],
              },
              confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
              },
              notes: { type: 'string' },
            },
            required: ['airports', 'input_type', 'confidence', 'notes'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    const content = resp.output_text || '';
    if (!content) return fallbackResolution(rawDestination);

    const parsed = JSON.parse(content);
    console.log(
      '[LocationResolver]',
      {
        rawDestination,
        airportCount: parsed.airports.length,
        airports: parsed.airports.map(a => a.iata)
      }
    );    
    if (!parsed?.airports || !Array.isArray(parsed.airports) || parsed.airports.length === 0) {
      return fallbackResolution(rawDestination);
    }

    return {
      airports: parsed.airports.slice(0, 5).map((a) => ({
        iata: (a.iata || '').toUpperCase(),
        city: a.city || null,
        country: a.country || null,
        distanceKm: typeof a.distanceKm === 'number' ? a.distanceKm : 0,
      })),
      input_type: parsed.input_type || 'unknown',
      confidence: parsed.confidence || 'low',
      notes: parsed.notes || '',
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('resolveLocation error:', err?.message || err);
    return fallbackResolution(rawDestination);
  }
}


