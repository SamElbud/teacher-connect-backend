// Step 1: Safaricom Production Credentials
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'YOUR_LIVE_CONSUMER_KEY';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'YOUR_LIVE_CONSUMER_SECRET';
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE || 'YOUR_LIVE_PAYBILL_OR_TILL'; 
const PASSKEY = process.env.MPESA_PASSKEY || 'YOUR_LIVE_PASSKEY';
const DEFAULT_PHONE_NUMBER = '254712489816';

// Middleware to generate Daraja Access Token
const generateToken = async (req, res, next) => {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', // Changed to api.safaricom.co.ke
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

// STK Push Route
app.post('/api/stkpush', generateToken, async (req, res) => {
  let { phoneNumber, amount } = req.body;
  phone = phoneNumber || DEFAULT_PHONE_NUMBER;

  if (!amount) {
    return res.status(400).json({ error: 'Amount is required' });
  }

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
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', // Changed to api.safaricom.co.ke
      {
        BusinessShortCode: BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // Use 'CustomerBuyGoodsOnline' if using a Till number
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
