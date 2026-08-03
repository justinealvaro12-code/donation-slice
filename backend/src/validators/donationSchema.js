const { z } = require('zod');

// Strict schema: only these fields are ever read from the request body.
// organization_id, status, id, created_by, etc. are NOT in this schema at
// all, so even if a client sends them, .parse() strips them silently —
// mass assignment defense (see THREAT_MODEL.md).
const createDonationSchema = z.object({
  donor_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_channel: z.enum(['cash', 'check', 'bank_transfer', 'card', 'online', 'other']),
  payment_reference: z.string().max(255).optional(),
  donation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'donation_date must be YYYY-MM-DD'),
});

const createDonorSchema = z.object({
  donor_type: z.enum(['individual', 'organization']),
  display_name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
});

module.exports = { createDonationSchema, createDonorSchema };
