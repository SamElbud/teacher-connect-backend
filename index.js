const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Root test route
app.get('/', (req, res) => {
  res.json({ message: 'TeacherConnect Backend API is running' });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend Connected: Flutter & Express communication working' });
});

// Health check route
app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Export app for Vercel serverless deployment
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
