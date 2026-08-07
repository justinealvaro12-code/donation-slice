const { z } = require('zod');

// Mass-assignment defense per THREAT_MODEL.md: only these fields are ever
// read from the request body. organization_id, id, created_by, raised_amount
// etc. are NOT in this schema, so .parse() strips them silently.
const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  goal_amount: z.number().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be YYYY-MM-DD'),
  status: z.enum(['draft', 'active', 'closed']).optional(),
}).refine((data) => data.end_date >= data.start_date, {
  message: 'end_date cannot be before start_date',
  path: ['end_date'],
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  goal_amount: z.number().positive().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
});

module.exports = { createCampaignSchema, updateCampaignSchema };
