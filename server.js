const express = require('express');
const { Anthropic } = require('@anthropic-ai/sdk');
const PDFDocument = require('pdfkit');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const client = new Anthropic();

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

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  return message.content[0].text;
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
    doc.fontSize(9).fillColor('#A08E7A').text('Generated with ❤️ by Puppy Plans', { align: 'center' });

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
