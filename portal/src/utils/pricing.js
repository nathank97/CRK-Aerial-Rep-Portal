// Dealer/Rep Price = MSRP × (1 - marginPercent / 100)
export const calcDealerPrice = (msrp, marginPercent) => {
  if (msrp == null || marginPercent == null) return msrp
  return msrp * (1 - marginPercent / 100)
}

/**
 * Returns the correct price for a dealer/rep.
 *
 * Priority order:
 *   1. Fixed tier price (tier1/tier2/tier3) if the rep uses that pricing method
 *   2. Per-type margin from profile.marginByType[item.type]  ← new
 *   3. Flat profile.marginPercent as the fallback
 */
export const getDealerPrice = (item, profile) => {
  if (!item) return 0
  const tier = profile?.pricingTier
  if (tier === 'tier1' && item.tier1 != null) return item.tier1
  if (tier === 'tier2' && item.tier2 != null) return item.tier2
  if (tier === 'tier3' && item.tier3 != null) return item.tier3

  const typeMargin = item.type != null ? profile?.marginByType?.[item.type] : undefined
  const margin = typeMargin != null ? typeMargin : profile?.marginPercent
  return calcDealerPrice(item.msrp, margin)
}

// Check if a price is below dealer cost (with tiny float tolerance)
export const isBelowDealerCost = (price, item, profile) => {
  const cost = getDealerPrice(item, profile)
  if (cost == null) return false
  return price < cost - 0.001
}
