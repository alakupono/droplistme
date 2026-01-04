export type Tier = 'A' | 'B' | 'C'
export type Uniqueness = 'Standard' | 'Standout'
export type Saturation = 'Vibrant' | 'Muted'
export type Surface = 'Polished' | 'Rough'

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step
}

export function baseRangeForTier(tier: Tier): { min: number; max: number } {
  if (tier === 'A') return { min: 35, max: 75 }
  if (tier === 'B') return { min: 18, max: 40 }
  return { min: 8, max: 20 }
}

/**
 * Copied + simplified from ../azc pricing logic.
 * Produces a price range; caller can select midpoint as recommended.
 */
export function computePrice(params: {
  tier: Tier
  uniqueness: Uniqueness
  color_saturation: Saturation
  surface_quality: Surface
  shipping_cost_usd: number | null
}) {
  const base = baseRangeForTier(params.tier)
  const modifiers: string[] = []

  let factorMin = 1
  let factorMax = 1

  if (params.uniqueness === 'Standout') {
    factorMin *= 1.15
    factorMax *= 1.2
    modifiers.push('uniqueness:Standout:+15-20%')
  }

  if (params.color_saturation === 'Muted') {
    factorMin *= 0.85
    factorMax *= 0.9
    modifiers.push('color_saturation:Muted:-10-15%')
  }

  if (params.surface_quality === 'Rough') {
    factorMin *= 0.85
    factorMax *= 0.9
    modifiers.push('surface_quality:Rough:-10-15%')
  }

  const safety = 5
  const shipping = params.shipping_cost_usd ?? 0
  const min = roundTo(base.min * factorMin + shipping + safety, 1)
  const max = roundTo(base.max * factorMax + shipping + safety, 1)

  return {
    base_range_usd: base,
    modifiers_applied: modifiers,
    shipping_included: true as const,
    price_range_usd: { min, max: Math.max(min, max) },
    safety_margin_usd: safety,
  }
}


