require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    sub: '24a22923-b728-4dd3-aefb-b09c7fc53645',
    organization_id: '376bfbb0-5bff-41e7-905d-d4bf495c31b1',
    role: 'administrator'
  },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log(token);
