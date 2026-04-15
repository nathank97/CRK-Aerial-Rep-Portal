// Dealer Price = MSRP × (1 - marginPercent / 100)
export const calcDealerPrice = (msrp, marginPercent) => {
  if (msrp == null || marginPercent == null) return msrp
  return msrp * (1 - marginPercent / 100)
}

/**
 * Returns the correct price for a dealer based on their pricingTier setting.
 * If pricingTier is 'tier1'/'tier2'/'tier3', returns the item's fixed tier price.
 * Otherwise falls back to margin % calculation.
 */
export const getDealerPrice = (item, profile) => {
  if (!item) return 0
  const tier = profile?.pricingTier
  if (tier === 'tier1' && item.tier1 != null) return item.tier1
  if (tier === 'tier2' && item.tier2 != null) return item.tier2
  if (tier === 'tier3' && item.tier3 != null) return item.tier3
  return calcDealerPrice(item.msrp, profile?.marginPercent)
}

// Check if a price is below dealer cost (with tiny float tolerance)
export const isBelowDealerCost = (price, item, profile) => {
  const cost = getDealerPrice(item, profile)
  if (cost == null) return false
  return price < cost - 0.001
}
