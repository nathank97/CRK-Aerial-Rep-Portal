// Dealer Price = MSRP × (1 - marginPercent / 100)
export const calcDealerPrice = (msrp, marginPercent) => {
  if (msrp == null || marginPercent == null) return msrp
  return msrp * (1 - marginPercent / 100)
}

// Check if a price is below dealer cost (with tiny float tolerance)
export const isBelowDealerCost = (price, msrp, marginPercent) => {
  const cost = calcDealerPrice(msrp, marginPercent)
  return price < cost - 0.001
}
