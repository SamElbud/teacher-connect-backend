const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend Connected: Flutter backend connected successfully!' });
});

// Health check route
app.get('/api/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// Handle unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Express server running on port ${PORT}`);
});
