require('dotenv').config();
const { createApp } = require('./app');

const app = createApp();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0'; 

app.listen(PORT, HOST, () => {
  console.log(`Donation Management backend listening on port ${PORT}`);
});