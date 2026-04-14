const CONFIG = {
  // Lead pipeline
  New: 'bg-[#4A90B8]/15 text-[#4A90B8]',
  Contacted: 'bg-[#E6A817]/15 text-[#E6A817]',
  Pending: 'bg-[#E6A817]/15 text-[#E6A817]',
  'Demo Scheduled': 'bg-[#8B6914]/15 text-[#8B6914]',
  'Proposal Sent': 'bg-[#8B6914]/15 text-[#8B6914]',
  Won: 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
  Lost: 'bg-[#D95F5F]/15 text-[#D95F5F]',
  // Orders
  Processing: 'bg-[#4A90B8]/15 text-[#4A90B8]',
  Fulfilled: 'bg-[#8B6914]/15 text-[#8B6914]',
  Shipped: 'bg-[#E6A817]/15 text-[#E6A817]',
  Delivered: 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
  Cancelled: 'bg-[#D95F5F]/15 text-[#D95F5F]',
  // Invoices
  Unpaid: 'bg-[#E6A817]/15 text-[#E6A817]',
  Partial: 'bg-[#8B6914]/15 text-[#8B6914]',
  Paid: 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
  Overdue: 'bg-[#D95F5F]/15 text-[#D95F5F]',
  // Quotes
  Draft: 'bg-[#9A9A9A]/15 text-[#9A9A9A]',
  Sent: 'bg-[#4A90B8]/15 text-[#4A90B8]',
  Accepted: 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
  Declined: 'bg-[#D95F5F]/15 text-[#D95F5F]',
  Expired: 'bg-[#9A9A9A]/15 text-[#9A9A9A]',
  // Service tickets
  Open: 'bg-[#4A90B8]/15 text-[#4A90B8]',
  'In Progress': 'bg-[#E6A817]/15 text-[#E6A817]',
  'Awaiting Parts': 'bg-[#E6A817]/15 text-[#E6A817]',
  Resolved: 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
  Closed: 'bg-[#9A9A9A]/15 text-[#9A9A9A]',
  // Rep statuses
  Prospect: 'bg-[#4A90B8]/15 text-[#4A90B8]',
  'In Onboarding': 'bg-[#E6A817]/15 text-[#E6A817]',
  'Active Rep': 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
  'Inactive Rep': 'bg-[#9A9A9A]/15 text-[#9A9A9A]',
  Terminated: 'bg-[#D95F5F]/15 text-[#D95F5F]',
}

export default function StatusBadge({ status, size = 'sm' }) {
  const cls = CONFIG[status] ?? 'bg-[#9A9A9A]/15 text-[#9A9A9A]'
  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${cls} ${
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
    }`}>
      {status}
    </span>
  )
}
