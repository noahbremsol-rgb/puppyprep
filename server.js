const express = require('express');
const { Anthropic } = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const Stripe = require('stripe');
const { Resend } = require('resend');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { parseMealPlan } = require('./mealParser');

const app = express();
app.use(express.json());
app.use(cors());

const client = new Anthropic();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const IMAGES_OUTPUT_DIR = path.join(__dirname, 'generated_images');

// Ensure output directory exists
if (!fs.existsSync(IMAGES_OUTPUT_DIR)) {
  fs.mkdirSync(IMAGES_OUTPUT_DIR, { recursive: true });
}

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
- Cooking Effort Level: ${quizData.cookingEffort || 'Moderate'}

Create a personalized 1-week meal prep plan tailored to their cooking effort level:
- Quick & Easy: Simple recipes under 15 minutes, minimal prep, few ingredients
- Moderate: Balanced recipes 15-30 minutes, some prep involved
- Involved: More complex recipes 30+ minutes, multiple steps, richer meals

Format your response EXACTLY like this (be concise and professional):

## SUMMARY
Write 2-3 sentences explaining why this plan works for ${quizData.name} (${quizData.gender || 'gender not specified'}, ${quizData.weight || 'weight not specified'} lbs) based on their profile.

## DAILY CALORIC NEEDS
Approximate daily calories for this dog.

## WEEKLY SHOPPING LIST
Concise list of 6-8 main ingredients needed for the week with approximate quantities. Focus on quality over variety.

## 1-WEEK MEAL PREP PLAN FOR ${quizData.name.toUpperCase()}

### MONDAY
**Ingredients:**
1. [Amount] [Protein]
2. [Amount] [Carb/Vegetable]
3. [Amount] [Carb/Vegetable]

**Preparation:**
1. [Brief step]
2. [Brief step]

### TUESDAY
[same format]

### WEDNESDAY
[same format]

### THURSDAY
[same format]

### FRIDAY
[same format]

### SATURDAY
[same format]

### SUNDAY (TREAT DAY)
Include something special but balanced.

## DAILY PORTIONS FOR ${quizData.name.toUpperCase()}
Morning: [Amount] • Evening: [Amount]

## STORAGE & MEAL PREP TIPS
- [Storage tip]
- [Prep tip]
- [Serving tip]

## HELPFUL NOTES
Any breed-specific or age-specific considerations that matter.`;

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

// Generate PNG images from meal plan
async function generatePNGImages(mealPlanText, quizData) {
  return new Promise((resolve, reject) => {
    try {
      // Parse the meal plan into structured data
      const parsedMeals = parseMealPlan(mealPlanText, quizData);
      if (!parsedMeals || !parsedMeals.parsed) {
        return reject(new Error('Failed to parse meal plan'));
      }

      // Create a unique folder for this user's images
      const userImageDir = path.join(IMAGES_OUTPUT_DIR, `${quizData.name}-${Date.now()}`);
      if (!fs.existsSync(userImageDir)) {
        fs.mkdirSync(userImageDir, { recursive: true });
      }

      // Prepare data for Python script
      const dogProfile = {
        name: parsedMeals.dogName,
        breed: parsedMeals.breed,
        size: parsedMeals.size,
        age: parsedMeals.age,
        weight: parsedMeals.weight,
        goal: parsedMeals.goal,
        activity: parsedMeals.activity,
        cookingEffort: parsedMeals.cookingEffort
      };

      // Estimate ingredient prices (can be enhanced later)
      const ingredientPrices = {};
      parsedMeals.shoppingList.forEach(item => {
        if (!ingredientPrices[item]) {
          if (item.toLowerCase().includes('chicken') || item.toLowerCase().includes('turkey')) {
            ingredientPrices[item] = '$8.99';
          } else if (item.toLowerCase().includes('salmon')) {
            ingredientPrices[item] = '$13.99';
          } else if (item.toLowerCase().includes('potato') || item.toLowerCase().includes('berry')) {
            ingredientPrices[item] = '$4.99';
          } else {
            ingredientPrices[item] = '$3.99';
          }
        }
      });

      // Call Python script
      const pythonScript = path.join(__dirname, 'generate_meal_images.py');
      const args = [
        pythonScript,
        userImageDir,
        JSON.stringify(dogProfile),
        JSON.stringify(parsedMeals.meals),
        JSON.stringify(ingredientPrices)
      ];

      console.log('Calling Python PNG generator...');
      execFile('python3', args, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Python execution error:', error);
          console.error('stderr:', stderr);
          return reject(error);
        }

        console.log('Python output:', stdout);

        // Read generated image files
        fs.readdir(userImageDir, (err, files) => {
          if (err) return reject(err);

          const imageFiles = files.filter(f => f.endsWith('.png')).sort();
          const images = {};

          imageFiles.forEach(file => {
            const filePath = path.join(userImageDir, file);
            try {
              const imageBuffer = fs.readFileSync(filePath);
              images[file] = imageBuffer.toString('base64');
            } catch (e) {
              console.error(`Error reading ${file}:`, e);
            }
          });

          resolve({
            images,
            imageDir: userImageDir,
            imageFiles: imageFiles,
            parsed: parsedMeals
          });
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Generate PDF from meal plan
function generatePDF(mealPlanText, quizData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      bufferPages: true,
      margin: 30,
      size: 'A4'
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Helper function to draw a section header with color background
    const drawSectionHeader = (text) => {
      doc.rect(30, doc.y, 540, 30).fillAndStroke('#635BFF', '#635BFF');
      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text(text, 40, doc.y + 6, { width: 520 });
      doc.moveDown(1.5);
    };

    // Title section
    doc.fontSize(32).font('Helvetica-Bold').fillColor('#5a4a42').text(`${quizData.name}'s`, { align: 'center' });
    doc.fontSize(28).font('Helvetica-Bold').text('1-Week Meal Prep Plan', { align: 'center' });
    doc.fontSize(11).fillColor('#8C7A68').text(`${quizData.breed || 'Dog'} • ${quizData.size} • ${quizData.activity}`, { align: 'center' });
    doc.moveDown(2);

    // Parse and format the meal plan
    const lines = mealPlanText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line.trim()) continue;

      // Section headers (## SUMMARY, ## WEEKLY SHOPPING LIST, etc)
      if (line.match(/^##\s+/)) {
        const sectionTitle = line.replace(/^#+\s+/, '').trim();
        drawSectionHeader(sectionTitle);
        continue;
      }

      // Day headers (MONDAY, TUESDAY, etc)
      if (line.match(/^###\s+(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/)) {
        const dayName = line.replace(/^#+\s+/, '').trim();
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#d4a574').text(dayName);
        doc.moveDown(0.3);
        continue;
      }

      // Clean markdown from line
      let cleanLine = line.replace(/^\#+\s+/, '').replace(/\*\*/g, '').trim();

      // Sub-headers (Ingredients:, Preparation:, etc)
      if (cleanLine.match(/^(Ingredients|Preparation|Storage|Tips|Notes|Morning|Evening):/i)) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#635BFF').text(cleanLine);
        doc.moveDown(0.2);
        continue;
      }

      // List items
      if (cleanLine.match(/^[\d+\.\-•]/)) {
        doc.fontSize(10).font('Helvetica').fillColor('#5a4a42').text(cleanLine, { indent: 20 });
        doc.moveDown(0.2);
        continue;
      }

      // Regular text
      if (cleanLine) {
        doc.fontSize(10).font('Helvetica').fillColor('#5a4a42').text(cleanLine, { width: 480 });
        doc.moveDown(0.3);
      }
    }

    // Footer
    doc.moveDown(2);
    doc.moveTo(30, doc.y).lineTo(570, doc.y).stroke('#e0d5ca');
    doc.moveDown(1);
    doc.fontSize(9).fillColor('#8C7A68').text('Generated with ❤️ by Tail Prep • tailprep.com', { align: 'center' });

    doc.end();
  });
}

// Main endpoint - Generate meal plan (for preview)
app.post('/api/generate-plan', async (req, res) => {
  try {
    const { quizData, mealPlanText } = req.body;

    // Validate required fields
    if (!quizData || !quizData.name || !quizData.size || !quizData.activity || !quizData.goal || !quizData.protein) {
      return res.status(400).json({ error: 'Missing required quiz data' });
    }

    console.log('Generating meal plan for:', quizData.name);

    // If mealPlanText is provided, skip Claude generation (for fast downloads)
    let mealPlan = mealPlanText;
    if (!mealPlan) {
      mealPlan = await generateMealPlan(quizData);
    }

    // Start PNG generation in background (don't wait)
    generatePNGImages(mealPlan, quizData).catch(err => {
      console.error('Background PNG generation error:', err);
    });

    // Send meal plan text for preview
    res.json({
      success: true,
      mealPlan: mealPlan,
      quizData: quizData
    });

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
      success_url: 'https://tailprep.com/?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://tailprep.com/',
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

// Finalize purchase: Generate PNG images, send email with images
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

    // Generate PNG images
    const pngResult = await generatePNGImages(mealPlan, quizData);

    // Send email with images as attachments
    const attachments = Object.entries(pngResult.images).map(([filename, base64]) => ({
      filename: filename,
      content: Buffer.from(base64, 'base64')
    }));

    const emailResponse = await resend.emails.send({
      from: 'Tail Prep <onboarding@resend.dev>',
      to: email,
      subject: `🐕 ${quizData.name}'s Personalized 1-Week Meal Plan is Ready!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>🐕 ${quizData.name}'s Meal Plan is Ready!</h1>
          <p>Hi there!</p>
          <p>Your personalized 1-week meal prep plan for <strong>${quizData.name}</strong> is ready! Your plan includes:</p>
          <ul>
            <li>📋 Complete shopping list with prices</li>
            <li>🍽️ 7 days of customized meals (morning + evening)</li>
            <li>👨‍🍳 Step-by-step cooking instructions</li>
            <li>📊 Calorie counts and macros</li>
            <li>💡 Nutritional information & what to expect</li>
          </ul>
          <p><strong>Dog Profile:</strong></p>
          <ul>
            <li>Breed: ${quizData.breed}</li>
            <li>Size: ${quizData.size}</li>
            <li>Activity Level: ${quizData.activity}</li>
            <li>Goal: ${quizData.goal}</li>
          </ul>
          <p>Your meal plan images are attached below. Save them to your phone, share with your vet, or keep them handy in the kitchen!</p>
          <p>Happy meal prepping! 🐾</p>
          <p>- Tail Prep Team</p>
        </div>
      `,
      attachments: attachments
    });

    if (!emailResponse.data?.id) {
      console.error('Email send failed:', emailResponse);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    console.log('Email sent successfully:', emailResponse.data.id);

    // Return images for carousel display
    res.json({
      success: true,
      images: pngResult.images,
      imageFiles: pngResult.imageFiles,
      parsed: pngResult.parsed,
      message: `Meal plan sent to ${email}!`
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
