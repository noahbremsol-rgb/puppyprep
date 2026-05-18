/**
 * Parse Claude's meal plan response into structured data for PNG generation
 */

function parseMealPlan(mealPlanText, quizData) {
  try {
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const parsedMeals = {};

    // Split by day headers (### MONDAY, etc)
    const dayPattern = /###\s+(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)(\s*\(.*?\))?\s*\n([\s\S]*?)(?=###|##|$)/gi;
    let dayMatch;

    while ((dayMatch = dayPattern.exec(mealPlanText)) !== null) {
      const dayName = dayMatch[1].charAt(0) + dayMatch[1].slice(1).toLowerCase();
      const dayContent = dayMatch[3];

      // Extract ingredients section
      const ingredientsMatch = dayContent.match(/\*\*Ingredients?:\*\*([\s\S]*?)(?:\*\*|$)/i);
      const ingredientsList = ingredientsMatch
        ? ingredientsMatch[1]
            .split('\n')
            .filter(line => line.trim() && line.match(/^\d+\.|^-|^•/))
            .map(line => line.replace(/^\d+\.\s*|^-\s*|^•\s*/, '').trim())
        : [];

      // Extract preparation section
      const prepMatch = dayContent.match(/\*\*Preparation?:\*\*([\s\S]*?)(?:\*\*|$)/i);
      const prepList = prepMatch
        ? prepMatch[1]
            .split('\n')
            .filter(line => line.trim() && line.match(/^\d+\.|^-|^•/))
            .map(line => line.replace(/^\d+\.\s*|^-\s*|^•\s*/, '').trim())
        : [];

      // Extract calories if mentioned (e.g., "600 cal" or "600 calories")
      const calMatch = dayContent.match(/(\d{2,4})\s*cal(?:ories)?/i);
      const calories = calMatch ? calMatch[1] : '650';

      // Extract macros if mentioned (e.g., "P:45g C:65g F:15g")
      const macroMatch = dayContent.match(/P[:\s]*(\d+)g\s+C[:\s]*(\d+)g\s+F[:\s]*(\d+)g/i);
      const macros = macroMatch
        ? `P:${macroMatch[1]}g C:${macroMatch[2]}g F:${macroMatch[3]}g`
        : 'P:45g C:60g F:15g'; // Default estimate

      // Calculate prep time from description
      let prepTime = '20 min';
      if (dayContent.match(/\b(10|15|20|25|30|40|45|60)\s*min/i)) {
        const timeMatch = dayContent.match(/\b(\d+)\s*min/i);
        if (timeMatch) prepTime = `${timeMatch[1]} min`;
      }

      parsedMeals[dayName] = {
        ingredients: ingredientsList,
        steps: prepList,
        calories: calories,
        macros: macros,
        time: prepTime
      };
    }

    // Extract shopping list
    const shoppingMatch = mealPlanText.match(/##\s+WEEKLY\s+SHOPPING\s+LIST([\s\S]*?)(?=##|$)/i);
    const shoppingText = shoppingMatch ? shoppingMatch[1] : '';

    // Parse shopping items into categories
    const shoppingItems = shoppingText
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => line.replace(/^[-•*]\s*|^[\d+\.]\s*/, '').trim())
      .filter(line => line && line.length > 3);

    // Extract daily portions if available
    const portionsMatch = mealPlanText.match(/##\s+DAILY\s+PORTIONS[^#]*([\s\S]*?)(?=##|$)/i);
    const portions = portionsMatch ? portionsMatch[1].trim() : 'Morning: 600 cal • Evening: 700 cal';

    // Calculate daily calorie total
    const calTotal = Object.values(parsedMeals).reduce((sum, day) => {
      return sum + parseInt(day.calories);
    }, 0);

    return {
      dogName: quizData.name,
      breed: quizData.breed,
      size: quizData.size,
      age: quizData.age,
      weight: quizData.weight || 'unknown',
      goal: quizData.goal,
      activity: quizData.activity,
      cookingEffort: quizData.cookingEffort || 'Moderate',
      dailyCaloricNeeds: `~${Math.round(calTotal / 7 * 2)} calories/day`,
      meals: parsedMeals,
      shoppingList: shoppingItems,
      portions: portions,
      parsed: true,
      rawText: mealPlanText
    };
  } catch (error) {
    console.error('Error parsing meal plan:', error);
    return null;
  }
}

module.exports = { parseMealPlan };
