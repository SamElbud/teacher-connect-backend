const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Step 1: Safaricom Credentials & Default Phone Number
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'YOUR_SANDBOX_CONSUMER_KEY';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'YOUR_SANDBOX_CONSUMER_SECRET';
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE || '174379'; // Sandbox Paybill/Till
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const DEFAULT_PHONE_NUMBER = '254712489816';

// Middleware to generate Daraja Access Token
const generateToken = async (req, res, next) => {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          authorization: `Basic ${auth}`,
        },
      }
    );
    req.token = response.data.access_token;
    next();
  } catch (error) {
    console.error('Error fetching M-Pesa token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with Safaricom' });
  }
};

// Step 2: STK Push Route
app.post('/api/stkpush', generateToken, async (req, res) => {
  let { phone, amount } = req.body;

  // Use your phone number if none is sent from Flutter
  phone = phone || DEFAULT_PHONE_NUMBER;

  if (!amount) {
    return res.status(400).json({ error: 'Amount is required' });
  }

  // Format phone number to 254XXXXXXXXX format
  phone = phone.replace(/\+/g, '');
  if (phone.startsWith('0')) {
    phone = `254${phone.substring(1)}`;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);

  const password = Buffer.from(
    `${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`
  ).toString('base64');

  const callbackUrl = 'https://teacher-connect-backend.vercel.app/api/callback';

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: BUSINESS_SHORT_CODE,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: 'TeacherConnect',
        TransactionDesc: 'Listing or Unlock Fee',
      },
      {
        headers: {
          Authorization: `Bearer ${req.token}`,
        },
      }
    );

    res.status(200).json({
      message: 'STK Push initiated successfully',
      data: response.data,
    });
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to initiate STK Push',
      details: error.response?.data || error.message,
    });
  }
});

// Step 3: Callback Route for M-Pesa Response
app.post('/api/callback', (req, res) => {
  const callbackData = req.body;
  console.log('M-Pesa Callback Data:', JSON.stringify(callbackData, null, 2));

  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Root & Health check routes
app.get('/', (req, res) => {
  res.json({ message: 'TeacherConnect Backend API is running' });
});

app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
    }
