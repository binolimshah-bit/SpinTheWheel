require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize JSON database
const DB_FILE = 'spins.json';

// Create database file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}

// Helper functions for JSON database
function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    // If file is empty or corrupted, return empty array
    if (!data || data.trim() === '') {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
      return [];
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    // Reset file on error
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
    return [];
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Home page route – serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Helper function to send SMS via multiple providers
 * @param {string} name - Customer name
 * @param {string} phone - Customer phone number
 * @param {string} domain - Service domain (Chatbots, Websites, etc.)
 * @param {number} discount - Discount percentage
 * @param {string} couponCode - Coupon code
 */
async function sendCouponSMS(name, phone, domain, discount, couponCode) {
  const message = `Hi ${name}! You just won ${discount}% off on ${domain} with ZooTechX. Your coupon code is ${couponCode}. Show this at the ZooTechX desk to redeem.`;
  
  // Clean phone number
  let cleanPhone = phone.replace(/[+\s-]/g, '');
  if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
    cleanPhone = cleanPhone.substring(2);
  }
  if (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.substring(1);
  }

  console.log(`📱 Attempting to send SMS to: ${cleanPhone}`);
  console.log(`📝 Message: ${message}`);

  // Try Fast2SMS first (for Indian numbers)
  if (process.env.FAST2SMS_API_KEY) {
    try {
      console.log('📱 Trying Fast2SMS...');
      const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
        params: {
          authorization: process.env.FAST2SMS_API_KEY,
          route: 'q',
          message: message,
          language: 'english', 
          flash: 0,
          numbers: cleanPhone
        }
      });
      
      console.log('Fast2SMS Response:', JSON.stringify(response.data));
      
      if (response.data.return === true) {
        console.log('✅ SMS sent successfully via Fast2SMS!');
        return { success: true, provider: 'fast2sms' };
      } else {
        console.log('❌ Fast2SMS returned false:', response.data.message);
      }
    } catch (error) {
      console.error('❌ Fast2SMS error:', error.response?.data || error.message);
    }
  }

  // Try 2Factor.in (another free Indian SMS service)
  if (process.env.TWOFACTOR_API_KEY) {
    try {
      console.log('📱 Trying 2Factor.in...');
      const response = await axios.get(`https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/${cleanPhone}/${encodeURIComponent(message)}`);
      
      console.log('2Factor Response:', JSON.stringify(response.data));
      
      if (response.data.Status === 'Success') {
        console.log('✅ SMS sent successfully via 2Factor!');
        return { success: true, provider: '2factor' };
      }
    } catch (error) {
      console.error('❌ 2Factor error:', error.response?.data || error.message);
    }
  }

  // Try Twilio as backup
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE) {
    try {
      console.log('📱 Trying Twilio...');
      const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      // Add +91 for Indian numbers
      const twilioPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;
      
      const twilioMessage = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE,
        to: twilioPhone
      });

      console.log(`✅ SMS sent successfully via Twilio! SID: ${twilioMessage.sid}`);
      return { success: true, provider: 'twilio', sid: twilioMessage.sid };
    } catch (error) {
      console.error('❌ Twilio error:', error.message);
    }
  }

  // If all providers fail, log and continue
  console.warn('⚠️  All SMS providers failed. Message NOT sent.');
  console.log('📋 Coupon details saved to database. User can see it on screen.');
  return { success: false, mock: true };
}

/**
 * Helper function to send coupon via Email
 * @param {string} name - Customer name
 * @param {string} email - Customer email address
 * @param {string} domain - Service domain (Chatbots, Websites, etc.)
 * @param {number} discount - Discount percentage
 * @param {string} couponCode - Coupon code
 */
async function sendCouponEmail(name, email, domain, discount, couponCode) {
  console.log(`📧 Attempting to send email to: ${email}`);

  // Check if email credentials are configured
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('⚠️  Gmail credentials not configured. Email NOT sent.');
    console.log('📋 To enable email, add GMAIL_USER and GMAIL_APP_PASSWORD to .env');
    return { success: false, reason: 'Email not configured' };
  }

  try {
    // Create transporter with better configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Plain text version (important for spam filters)
    const textContent = `
Hi ${name}!

Congratulations! You just won ${discount}% OFF on ${domain} services from ZooTechX!

YOUR COUPON CODE: ${couponCode}

How to Redeem:
1. Visit the ZooTechX booth at the event
2. Show this email or mention your coupon code
3. Get your exclusive discount on ${domain}!

Thank you for participating in our Spin the Wheel promotion!

Best regards,
ZooTechX Team
www.zootechx.com
    `.trim();

    // Email HTML template - cleaner, more professional
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ZooTechX Coupon</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: #000000; padding: 30px; text-align: center;">
              <a href="https://www.zootechx.com" target="_blank" style="text-decoration: none;">
                <img src="https://i.imgur.com/placeholder.png" alt="ZooTechX" style="max-width: 250px; height: auto;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; display: none;">ZooTechX</h1>
              </a>
              <p style="color: #888; margin: 10px 0 0 0; font-size: 14px;">Transforming Ideas into Digital Reality</p>
            </td>
          </tr>
          
          <!-- Congratulations Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #00d4ff 0%, #7b2dff 100%); padding: 25px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px;">🎉 Congratulations, ${name}!</h2>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333; font-size: 18px; margin: 0 0 20px 0; text-align: center;">
                You just won <strong style="color: #00d4ff; font-size: 24px;">${discount}% OFF</strong> on <strong>${domain}</strong> services!
              </p>
              
              <!-- Coupon Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8f9fa; border: 2px dashed #00d4ff; border-radius: 12px; padding: 25px 40px;">
                      <tr>
                        <td align="center">
                          <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">Your Coupon Code</p>
                          <p style="color: #1a1a2e; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 3px;">${couponCode}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Instructions -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 20px;">
                <tr>
                  <td>
                    <h3 style="color: #1a1a2e; margin: 0 0 15px 0; font-size: 16px;">📋 How to Redeem</h3>
                    <p style="color: #555; margin: 8px 0; font-size: 14px;">1. Visit the ZooTechX booth at the event</p>
                    <p style="color: #555; margin: 8px 0; font-size: 14px;">2. Show this email or mention your coupon code</p>
                    <p style="color: #555; margin: 8px 0; font-size: 14px;">3. Get your exclusive discount on ${domain}!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #000000; padding: 25px; text-align: center;">
              <a href="https://www.zootechx.com" target="_blank" style="text-decoration: none;">
                <p style="color: #00d4ff; font-size: 18px; font-weight: bold; margin: 0 0 5px 0;">ZooTechX</p>
              </a>
              <p style="color: #888; font-size: 12px; margin: 0 0 10px 0;">Transforming Ideas into Digital Reality</p>
              <p style="color: #00d4ff; font-size: 12px; margin: 0 0 10px 0;">
                <a href="https://www.zootechx.com" target="_blank" style="color: #00d4ff; text-decoration: none;">www.zootechx.com</a>
              </p>
              <p style="color: #666; font-size: 11px; margin: 0;">© 2025 ZooTechX. All rights reserved.</p>
              <p style="color: #666; font-size: 11px; margin: 5px 0 0 0;">
                This email was sent because you participated in our Spin the Wheel promotion.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email with improved headers
    const mailOptions = {
      from: {
        name: 'ZooTechX',
        address: process.env.GMAIL_USER
      },
      to: email,
      subject: `Your ZooTechX Coupon Code - ${discount}% OFF on ${domain}`,
      text: textContent,  // Plain text version (helps avoid spam)
      html: htmlContent,
      headers: {
        'X-Priority': '3',  // Normal priority
        'X-Mailer': 'ZooTechX Promo System',
        'List-Unsubscribe': `<mailto:${process.env.GMAIL_USER}?subject=Unsubscribe>`
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Email sending error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * POST /api/spin
 * Process a wheel spin request
 */
app.post('/api/spin', async (req, res) => {
  try {
    const { name, email, phone, domain, discount, couponCode } = req.body;

    // Validate input
    if (!name || !email || !phone || !domain || !discount || !couponCode) {
      return res.status(400).json({
        allowed: false,
        message: 'Missing required fields'
      });
    }

    // Read database
    const spins = readDB();

    // Check if email has already spun
    const existingSpin = spins.find(spin => spin.email === email);

    if (existingSpin) {
      return res.json({
        allowed: false,
        message: 'You have already spun the wheel.'
      });
    }

    // Create new spin record
    const newSpin = {
      id: spins.length > 0 ? Math.max(...spins.map(s => s.id)) + 1 : 1,
      name,
      email,
      phone,
      domain,
      discount,
      couponCode,
      createdAt: new Date().toISOString()
    };

    // Add to database
    spins.push(newSpin);
    writeDB(spins);

    // Send Email (primary) and SMS (backup)
    try {
      await sendCouponEmail(name, email, domain, discount, couponCode);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    // Also try SMS as backup
    try {
      await sendCouponSMS(name, phone, domain, discount, couponCode);
    } catch (smsError) {
      console.error('SMS sending failed:', smsError);
    }

    res.json({
      allowed: true,
      success: true,
      message: 'Coupon sent successfully!'
    });

  } catch (error) {
    console.error('Error processing spin:', error);
    res.status(500).json({
      allowed: false,
      success: false,
      message: 'An error occurred. Please try again.'
    });
  }
});

/**
 * GET /api/spins
 * Get all spins (admin endpoint for testing)
 */
app.get('/api/spins', (req, res) => {
  try {
    const spins = readDB();
    // Sort by createdAt descending
    spins.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(spins);
  } catch (error) {
    console.error('Error fetching spins:', error);
    res.status(500).json({ error: 'Failed to fetch spins' });
  }
});

/**
 * GET /api/export
 * Export spins as CSV
 */
app.get('/api/export', (req, res) => {
  try {
    const spins = readDB();
    
    // Sort by createdAt descending
    spins.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Create CSV
    const csvHeader = 'ID,Name,Email,Phone,Domain,Discount,CouponCode,CreatedAt\n';
    const csvRows = spins.map(spin => 
      `${spin.id},"${spin.name}","${spin.email || ''}","${spin.phone}","${spin.domain}",${spin.discount},"${spin.couponCode}","${spin.createdAt}"`
    ).join('\n');
    
    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=spins_export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ZooTechX Spin the Wheel server running on http://localhost:${PORT}`);
  console.log(`📊 Database: spins.json`);
  console.log(`📧 Email: ${process.env.GMAIL_USER ? '✅ Configured' : '❌ Not configured (add GMAIL_USER & GMAIL_APP_PASSWORD to .env)'}`);
  console.log(`📱 SMS Providers (backup):`);
  console.log(`   - Fast2SMS: ${process.env.FAST2SMS_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   - Twilio: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Configured' : '❌ Not configured'}`);
});