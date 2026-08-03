require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    sub: 'demo-user-1',
    organization_id: 'demo-org-1',
    role: 'admin'
  },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log(token);