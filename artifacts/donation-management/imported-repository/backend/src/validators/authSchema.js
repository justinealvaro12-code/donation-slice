const { z } = require('zod');

// Strict schema: only email/password are ever read from the login
// request body — same mass-assignment defense as donationSchema.js
// (nothing else, e.g. role or organization_id, can be smuggled in).
const loginSchema = z.object({
  email: z.string().min(1, 'email is required').email('Invalid email'),
  password: z.string().min(1, 'password is required'),
});

module.exports = { loginSchema };
