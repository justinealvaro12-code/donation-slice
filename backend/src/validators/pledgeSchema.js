const { z } = require('zod');

const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

// Mass-assignment defense (same pattern as campaignSchema.js): only these
// fields are ever read from the request body. amount_fulfilled and status
// are NOT here — status can't be set at all (generated column), and
// amount_fulfilled only ever changes via recordFulfillment()'s atomic
// increment, never through create/update.
const createPledgeSchema = z.object({
  donor_id: uuidSchema,
  campaign_id: uuidSchema.optional(),
  amount_pledged: z.number().positive(),
  pledge_date: dateSchema,
  due_date: dateSchema.optional(),
}).refine((data) => !data.due_date || data.due_date >= data.pledge_date, {
  message: 'due_date cannot be before pledge_date',
  path: ['due_date'],
});

const updatePledgeSchema = z.object({
  donor_id: uuidSchema.optional(),
  campaign_id: uuidSchema.optional(),
  amount_pledged: z.number().positive().optional(),
  pledge_date: dateSchema.optional(),
  due_date: dateSchema.optional(),
});

module.exports = { createPledgeSchema, updatePledgeSchema };
