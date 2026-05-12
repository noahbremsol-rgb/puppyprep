const express = require('express');
const { Anthropic } = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const Stripe = require('stripe');
const { Resend } = require('resend');

const app = express();
app.use(express.json());
app.use(cors());

const client = new Anthropic();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// Generate meal plan using Claude
async function generateMealPlan(quizData) {
  const prompt = `You are a professional dog nutritionist creating a personalized 1-week meal prep plan.

DOG INFORMATION:
- Name: ${quizData.name}
- Breed: ${quizData.breed}
- Age Group: ${quizData.age}
- Size: ${quizData.size}
- Weight: ${quizData.weight || 'Not specified'} lbs
- Activity Level: ${quizData.activity}
- Health Goal: ${quizData.goal}
- Allergies/Restrictions: ${quizData.allergies || 'None'}
- Preferred Protein: ${quizData.protein}
- Budget: ${quizData.budget}

Create a personalized 1-week meal prep plan. Format your response EXACTLY like this:

SUMMARY
[Write 3-4 sentences explaining why this plan is tailored for this dog based on breed, age, size, activity level, and goals]

DAILY CALORIC NEEDS
[Calculate approximate daily calories needed based on size and activity]

1-WEEK MEAL PREP PLAN FOR ${quizData.name.toUpperCase()}

MONDAY:
Protein: [amount and type]
Carbs: [amount and type]
Vegetables: [specific vegetables with amounts]
Supplements: [any supplements]

TUESDAY:
[same format]

WEDNESDAY:
[same format]

THURSDAY:
[same format]

FRIDAY:
[same format]

SATURDAY:
[same format]

SUNDAY (TREAT DAY):
[Include something special but still healthy]

WEEKLY SHOPPING LIST:
[Organized list with quantities needed for the week]

DAILY PORTIONS FOR ${quizData.name.toUpperCase()}:
Morning: [Specific breakdown with portions]
Evening: [Specific breakdown with portions]

PREP DAY INSTRUCTIONS:
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Step 4]
5. [Step 5]

STORAGE & SAFETY TIPS:
[3-4 tips specific to their situation]

IMPORTANT NOTES:
[Any special considerations for this dog's breed, age, or health goal]`;

  try {
    console.log('Calling Claude API...');
    console.log('API key present:', !!process.env.ANTHROPIC_API_KEY);
    console.log('API key preview:', process.env.ANTHROPIC_API_KEY?.substring(0, 10) || 'MISSING');

    const message = await Promise.race([
      client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Claude API timeout after 60 seconds')), 60000)
      )
    ]);

    console.log('Claude API response received');
    return message.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status);
    throw error;
  }
}

// Generate PDF from meal plan
function generatePDF(mealPlanText, quizData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      bufferPages: true,
      margin: 40
    });

    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(28).font('Helvetica-Bold').text(`${quizData.name}'s`, { align: 'center' });
    doc.fontSize(28).font('Helvetica-Bold').text('1-Week Meal Prep Plan', { align: 'center' });
    doc.fontSize(12).font('Helvetica').fillColor('#8C7A68').text(`${quizData.breed || 'Dog'} • ${quizData.size} • ${quizData.activity}`, { align: 'center' });
    doc.moveDown();

    // Content
    doc.fontSize(11).font('Helvetica').fillColor('#000').text(mealPlanText, {
      align: 'left',
      lineGap: 4,
      width: 475
    });

    doc.moveDown();
    doc.fontSize(9).fillColor('#A08E7A').text('Generated with ❤️ by Tail Prep', { align: 'center' });

    doc.end();
  });
}

// Main endpoint
app.post('/api/generate-plan', async (req, res) => {
  try {
    const quizData = req.body;

    // Validate required fields
    if (!quizData.name || !quizData.size || !quizData.activity || !quizData.goal || !quizData.protein) {
      return res.status(400).json({ error: 'Missing required quiz data' });
    }

    console.log('Generating meal plan for:', quizData.name);

    // Generate meal plan with Claude
    const mealPlan = await generateMealPlan(quizData);

    // Generate PDF
    const pdfBuffer = await generatePDF(mealPlan, quizData);

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quizData.name}-Meal-Plan.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create checkout session
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { dogName } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Tail Prep - 1-Week Dog Meal Plan',
              description: `Personalized meal plan for ${dogName || 'your dog'}`
            },
            unit_amount: 500, // $5.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://tailprep.netlify.app/?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://tailprep.netlify.app/',
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Checkout creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Stripe session email
app.get('/api/session-email', async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      email: session.customer_details?.email || '',
      paymentStatus: session.payment_status
    });
  } catch (error) {
    console.error('Error retrieving session:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Finalize purchase: Generate full plan, create PDF, send email
app.post('/api/finalize-purchase', async (req, res) => {
  try {
    const { sessionId, email, quizData } = req.body;

    if (!sessionId || !email || !quizData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify Stripe session payment
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not confirmed' });
    }

    console.log(`Finalizing purchase for ${quizData.name}, sending to ${email}`);

    // Generate full meal plan
    const mealPlan = await generateMealPlan(quizData);

    // Generate PDF
    const pdfBuffer = await generatePDF(mealPlan, quizData);

    // Send email with PDF
    const emailResponse = await resend.emails.send({
      from: 'Tail Prep <onboarding@resend.dev>', // Update this email
      to: email,
      subject: `${quizData.name}'s Personalized 1-Week Meal Plan`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>🐕 ${quizData.name}'s Meal Plan is Ready!</h1>
          <p>Hi there!</p>
          <p>Your personalized 1-week meal prep plan for <strong>${quizData.name}</strong> is attached as a PDF.</p>
          <p><strong>Plan Summary:</strong></p>
          <ul>
            <li>Breed: ${quizData.breed}</li>
            <li>Size: ${quizData.size}</li>
            <li>Activity Level: ${quizData.activity}</li>
            <li>Health Goal: ${quizData.goal}</li>
          </ul>
          <p>Open the PDF to see the complete 7-day meal schedule, shopping list, prep instructions, and more!</p>
          <p>Happy meal prepping! 🐾</p>
          <p>- Tail Prep Team</p>
        </div>
      `,
      attachments: [
        {
          filename: `${quizData.name}-Meal-Plan.pdf`,
          content: pdfBuffer.toString('base64')
        }
      ]
    });

    if (!emailResponse.data?.id) {
      console.error('Email send failed:', emailResponse);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    console.log('Email sent successfully:', emailResponse.data.id);

    // Return full plan for display on page
    res.json({
      success: true,
      mealPlan: mealPlan,
      message: `Meal plan emailed to ${email}!`
    });

  } catch (error) {
    console.error('Error in finalize-purchase:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
