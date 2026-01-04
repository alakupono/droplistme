export type DropDraft = {
  title: string
  description: string
  categoryId: string
  condition: 'NEW' | 'USED_EXCELLENT' | 'USED_VERY_GOOD' | 'USED_GOOD' | 'USED_ACCEPTABLE'
  price: string
  quantity: number
  specifics: Record<string, string>
  confidence: number
  notes: string[]
  extractedText?: string
  pricingSignals?: {
    tier?: 'A' | 'B' | 'C'
    uniqueness?: 'Standard' | 'Standout'
    color_saturation?: 'Vibrant' | 'Muted'
    surface_quality?: 'Polished' | 'Rough'
    shipping_cost_usd?: number
  }
}

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v || typeof v !== 'string' || v.trim().length === 0) {
    throw new Error(`${name} is not set`)
  }
  return v.trim()
}

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Analyze up to 8 images (data URLs) and produce a best-effort draft listing for rocks/minerals/crystals.
 * Uses OpenAI Responses API via fetch (no SDK dependency).
 */
export async function analyzeDropImages(images: string[]): Promise<DropDraft> {
  const apiKey = requiredEnv('OPENAI_API_KEY')
  const model = (process.env.OPENAI_MODEL && String(process.env.OPENAI_MODEL)) || 'gpt-4o-mini'

  // Default category for crystals/minerals. User can override later.
  // "Rocks, Fossils & Minerals" is commonly used; keep as a starting point.
  const defaultCategoryId = '8822'

  const system = [
    'You are an expert eBay listing assistant for collectible crystals/rocks/minerals.',
    'You will be given 1-8 photos of the item.',
    'Extract any readable text (labels, stickers, measurements) and infer the item details.',
    'Generate a complete draft listing for eBay US marketplace.',
    'Focus on smart SEO: maximize search coverage while staying human, accurate, and not spammy.',
    'TITLE RULES (hard): <= 80 characters; no ALL CAPS; no emojis; no repeated keywords; no misleading terms.',
    'TITLE STRATEGY: start with the mineral name, then key descriptors (form/cut, color, grade), then size/weight if visible, then locality if known.',
    'Avoid fluff words like "WOW", "RARE" unless clearly supported by the photos.',
    'DESCRIPTION RULES: output HTML string (no markdown). Lead with a 1-2 sentence summary, then a short bullet list of key facts, then a short shipping/handling note.',
    'DESCRIPTION MUST include: what it is, condition, what’s included, measurements if visible, and a gentle call to action.',
    'If any critical info is unknown (weight, exact mineral ID, treatments), add a note in notes[] and phrase the description to be honest (e.g., "approximate" / "see photos").',
    'Return STRICT JSON ONLY matching the schema, no markdown, no commentary.',
    'If you cannot infer a field, put a reasonable default and add a note explaining what the user must confirm.',
    `Prefer categoryId "${defaultCategoryId}" unless the photos strongly indicate a different rocks/minerals category.`,
  ].join('\n')

  const schemaHint = {
    title: 'string (SEO title, <= 80 chars)',
    description: 'string (HTML)',
    categoryId: 'string',
    condition: 'NEW|USED_EXCELLENT|USED_VERY_GOOD|USED_GOOD|USED_ACCEPTABLE',
    price: 'string decimal like "12.99" (best guess; if unknown use "9.99" and add note)',
    quantity: 'number (default 1)',
    specifics: 'object map of item specifics (e.g. Mineral, Color, Weight, Size)',
    confidence: 'number 0..1',
    notes: 'string[]',
    extractedText: 'string (optional)',
    pricingSignals: '{ tier:A|B|C, uniqueness:Standard|Standout, color_saturation:Vibrant|Muted, surface_quality:Polished|Rough, shipping_cost_usd:number|null } (optional; best-effort)',
  }

  const input: any[] = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: system }],
    },
    {
      role: 'user',
      content: [
        { type: 'input_text', text: `Return JSON with keys exactly like this schema: ${JSON.stringify(schemaHint)}` },
        ...images.slice(0, 8).map((dataUrl) => ({ type: 'input_image', image_url: dataUrl })),
      ],
    },
  ]

  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input,
      temperature: 0.3,
      max_output_tokens: 900,
      // Force JSON output (prevents markdown / prose responses)
      text: { format: { type: 'json_object' } },
    }),
  })

  const text = await resp.text()
  if (!resp.ok) {
    throw new Error(`OpenAI error (HTTP ${resp.status}): ${text}`)
  }

  const json = safeJsonParse(text)
  const outputText =
    json?.output_text ||
    json?.output?.flatMap((o: any) => o?.content || []).map((c: any) => c?.text).filter(Boolean).join('\n') ||
    null

  if (!outputText || typeof outputText !== 'string') {
    throw new Error('OpenAI response missing output_text')
  }

  const parsed = safeJsonParse(outputText)
  if (!parsed) {
    throw new Error(`OpenAI returned non-JSON output: ${outputText.slice(0, 4000)}`)
  }

  // Basic normalization
  const draft: DropDraft = {
    title: String(parsed.title || '').trim() || 'Crystal / Mineral Specimen',
    description: String(parsed.description || '').trim() || 'Mineral specimen. See photos for details.',
    categoryId: String(parsed.categoryId || defaultCategoryId).trim() || defaultCategoryId,
    condition: (parsed.condition as any) || 'USED_GOOD',
    price: String(parsed.price || '9.99').trim() || '9.99',
    quantity: Number.isFinite(parsed.quantity) ? Number(parsed.quantity) : 1,
    specifics: parsed.specifics && typeof parsed.specifics === 'object' ? parsed.specifics : {},
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    notes: Array.isArray(parsed.notes) ? parsed.notes.map((n: any) => String(n)) : [],
    extractedText: parsed.extractedText ? String(parsed.extractedText) : undefined,
    pricingSignals: parsed.pricingSignals && typeof parsed.pricingSignals === 'object' ? parsed.pricingSignals : undefined,
  }

  if (draft.quantity < 1) draft.quantity = 1
  return draft
}


