require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    sub: 'demo-user-1',
    organization_id: '376bfbb0-5bff-41e7-905d-d4bf495c31b1',
    role: 'administrator'
  },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log(token);