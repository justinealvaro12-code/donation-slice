const { z } = require('zod');

// Strict schema: only these fields are ever read from the request body.
// organization_id, status, id, created_by, etc. are NOT in this schema at
// all, so even if a client sends them, .parse() strips them silently —
// mass assignment defense (see THREAT_MODEL.md).
const createDonationSchema = z.object({
  donor_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional(), // optional — general donations aren't tied to a campaign
  pledge_id: z.string().uuid().optional(), // optional — links this donation as fulfillment of a pledge
  amount: z.number().positive(),
  payment_channel: z.enum(['cash', 'check', 'bank_transfer', 'card', 'online', 'other']),
  payment_reference: z.string().max(255).optional(),
  donation_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'donation_date must be YYYY-MM-DD')
    .refine((d) => {
      const [year, month, day] = d.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    }, 'Invalid date')
    .refine((d) => {
      const date = new Date(d);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // allow "today" through end of day
      return date <= today;
    }, 'Donation date cannot be in the future')
    .refine((d) => {
      const date = new Date(d);
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      return date >= fiveYearsAgo;
    }, 'Donation date cannot be more than 5 years in the past'),
});

const createDonorSchema = z.object({
  donor_type: z.enum(['individual', 'organization']),
  display_name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
});

module.exports = { createDonationSchema, createDonorSchema };