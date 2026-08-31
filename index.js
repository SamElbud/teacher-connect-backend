const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Safaricom Credentials (Fallback to Sandbox defaults if env vars missing)
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'YOUR_SANDBOX_CONSUMER_KEY';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'YOUR_SANDBOX_CONSUMER_SECRET';
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE || '174379';
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = 'https://teacher-connect-backend.vercel.app/api/callback';

// Middleware to generate Daraja Token
const generateToken = async (req, res, next) => {
  try {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
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
    return res.status(200).json({
      success: false,
      message: 'Failed to authenticate with M-Pesa. Check your Consumer Key/Secret.',
      details: error.response?.data || error.message,
    });
  }
};

// Root / Health check route
app.get('/', (req, res) => {
  res.status(200).json({ message: 'TeacherConnect Backend is Live!' });
});
app.get('/api', (req, res) => {
  res.status(200).json({ message: 'TeacherConnect API is Live!' });
});

// STK Push Route (Handles both /stkpush and /api/stkpush)
const handleStkPush = async (req, res) => {
  try {
    const { phoneNumber, amount } = req.body;
    const phone = phoneNumber || '254712489816';

    const date = new Date();
    const timestamp =
      date.getFullYear() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);

    const password = Buffer.from(
      `${BUSINESS_SHORT_CODE}${PASSKEY}${timestamp}`
    ).toString('base64');

    const stkData = {
      BusinessShortCode: BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount || '100',
      PartyA: phone,
      PartyB: BUSINESS_SHORT_CODE,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: 'TeacherConnect',
      TransactionDesc: 'Fee Payment',
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkData,
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
    return res.status(200).json({
      success: false,
      message: error.response?.data?.errorMessage || 'M-Pesa STK push request failed.',
      details: error.response?.data || error.message,
    });
  }
};

app.post('/stkpush', generateToken, handleStkPush);
app.post('/api/stkpush', generateToken, handleStkPush);

// Callback Route
app.post('/api/callback', (req, res) => {
  console.log('M-Pesa Callback Data:', JSON.stringify(req.body));
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = app;
