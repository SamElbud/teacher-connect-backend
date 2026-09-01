const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Safaricom Credentials
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'YOUR_SANDBOX_CONSUMER_KEY';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'YOUR_SANDBOX_CONSUMER_SECRET';
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE || '174379';
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = 'https://teacher-connect-backend.vercel.app/api/callback';

// Set base URL (Use sandbox for testing, api.safaricom.co.ke for production)
const MPESA_BASE_URL = process.env.NODE_ENV === 'production' && process.env.USE_LIVE_MPESA === 'true'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// Middleware to generate OAuth Token
const generateToken = async (req, res, next) => {
  try {
    const authHeader = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      }
    );
    req.token = response.data.access_token;
    next();
  } catch (error) {
    console.error('M-Pesa Auth Error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate with M-Pesa.',
      error: error.response?.data || error.message,
    });
  }
};

// Health Check
app.get('/', (req, res) => {
  res.status(200).json({ message: 'TeacherConnect Backend is Live!' });
});

// STK Push Route
app.post('/api/stkpush', generateToken, async (req, res) => {
  let { phoneNumber, amount } = req.body;

  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: 'Phone number and amount are required' });
  }

  // Format Phone Number to 254XXXXXXXXX
  phoneNumber = phoneNumber.replace(/\D/g, '');
  if (phoneNumber.startsWith('0')) {
    phoneNumber = `254${phoneNumber.substring(1)}`;
  }

  const date = new Date();
  const timestamp =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0') +
    String(date.getHours()).padStart(2, '0') +
    String(date.getMinutes()).padStart(2, '0') +
    String(date.getSeconds()).padStart(2, '0');

  const password = Buffer.from(
    `${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`
  ).toString('base64');

  try {
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: BUSINESS_SHORT_CODE,
        PhoneNumber: phoneNumber,
        CallBackURL: CALLBACK_URL,
        AccountReference: 'TeacherConnect',
        TransactionDesc: 'Payment',
      },
      {
        headers: {
          Authorization: `Bearer ${req.token}`,
        },
      }
    );

    return res.status(200).json({
      success: true,
      ...response.data,
    });
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'STK Push failed',
      error: error.response?.data || error.message,
    });
  }
});

module.exports = app;
