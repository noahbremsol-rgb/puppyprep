#!/usr/bin/env python3
"""
Generate vibrant meal plan PNG images for a dog.
Called from Node.js with dog profile and meal data as JSON.

Usage:
  python generate_meal_images.py <output_dir> <dog_profile_json> <meals_json>
"""

import sys
import json
from PIL import Image, ImageDraw, ImageFont

# VIBRANT COLORS
DARK_BG = "#1A1A2E"
VIBRANT_GREEN = "#00D084"
VIBRANT_PINK = "#FF006E"
VIBRANT_ORANGE = "#FF9E1B"
VIBRANT_PURPLE = "#9D4EDD"
VIBRANT_TEAL = "#00F5FF"
WHITE_TEXT = "#FFFFFF"
DARK_TEXT = "#1A1A2E"
LIGHT_GRAY = "#B0B0B0"

WIDTH = 1080
HEIGHT = 1920

def get_fonts():
    """Load fonts with fallback to defaults"""
    try:
        fonts = {
            'big': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 88),
            'title': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 56),
            'section': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36),
            'subsection': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28),
            'item': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24),
            'small': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22),
            'tiny': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20),
        }
    except:
        default = ImageFont.load_default()
        fonts = {k: default for k in ['big', 'title', 'section', 'subsection', 'item', 'small', 'tiny']}
    return fonts

def generate_shopping_list(output_dir, dog_profile, shopping_items, ingredient_prices):
    """Generate shopping list page"""
    fonts = get_fonts()
    img = Image.new('RGB', (WIDTH, HEIGHT), DARK_BG)
    draw = ImageDraw.Draw(img)

    y = 40

    # Header
    draw.text((WIDTH//2, y), "🐕", anchor="mm", font=fonts['big'])
    y += 100
    draw.text((WIDTH//2, y), f"{dog_profile['name']}'s Meal Plan", anchor="mm", font=fonts['title'], fill=WHITE_TEXT)
    y += 65
    subtitle = f"{dog_profile['breed']} • {dog_profile['size']} • {dog_profile['goal']}"
    draw.text((WIDTH//2, y), subtitle, anchor="mm", font=fonts['small'], fill=VIBRANT_TEAL)
    y += 70

    # Dog facts
    draw.rectangle([(20, y), (WIDTH-20, y+100)], fill=VIBRANT_GREEN)
    facts_line1 = f"Age: {dog_profile['age']}  •  Weight: {dog_profile['weight']} lbs  •  Activity: {dog_profile['activity']}"
    facts_line2 = f"Goal: {dog_profile['goal']}  •  Effort: {dog_profile['cookingEffort']}"
    draw.text((40, y+20), facts_line1, font=fonts['item'], fill=DARK_TEXT)
    draw.text((40, y+60), facts_line2, font=fonts['item'], fill=DARK_TEXT)
    y += 130

    # Shopping list header
    draw.rectangle([(20, y), (WIDTH-20, y+65)], fill=VIBRANT_PINK)
    draw.text((WIDTH//2, y+32), "📋 WEEKLY SHOPPING LIST", anchor="mm", font=fonts['section'], fill=WHITE_TEXT)
    y += 95

    # Organize items by category (PROTEINS, VEGGIES, GRAINS)
    categories = {
        'PROTEINS': [],
        'VEGETABLES': [],
        'GRAINS & SUPPLEMENTS': []
    }

    # Simple categorization based on keywords
    for item in shopping_items:
        if any(word in item.lower() for word in ['chicken', 'turkey', 'salmon', 'beef', 'meat', 'fish']):
            categories['PROTEINS'].append(item)
        elif any(word in item.lower() for word in ['potato', 'broccoli', 'carrot', 'bean', 'berry', 'vegetable']):
            categories['VEGETABLES'].append(item)
        else:
            categories['GRAINS & SUPPLEMENTS'].append(item)

    colors = [VIBRANT_ORANGE, VIBRANT_GREEN, VIBRANT_PURPLE]
    color_idx = 0

    for category, items in categories.items():
        if not items:
            continue

        draw.text((40, y), f"🍗 {category}" if "PROTEIN" in category else f"🥕 {category}" if "VEGET" in category else f"🌾 {category}",
                  font=fonts['subsection'], fill=colors[color_idx])
        y += 45

        for item in items:
            # Get price if available
            price = ingredient_prices.get(item, "$0.00")
            draw.text((70, y), f"• {item}", font=fonts['item'], fill=WHITE_TEXT)
            draw.text((WIDTH-100, y), price, font=fonts['item'], fill=VIBRANT_TEAL, anchor="mm")
            y += 38

        y += 20
        color_idx += 1

    # Total
    y += 10
    draw.rectangle([(40, y), (WIDTH-40, y+60)], fill=VIBRANT_TEAL)
    total_price = sum(float(p.replace('$', '')) for p in ingredient_prices.values())
    draw.text((WIDTH//2, y+30), f"Weekly Total: ~${total_price:.2f}", anchor="mm", font=fonts['section'], fill=DARK_TEXT)
    y += 90

    # Why these ingredients
    draw.rectangle([(20, y), (WIDTH-20, y+65)], fill=VIBRANT_ORANGE)
    draw.text((WIDTH//2, y+32), "💡 WHY THESE INGREDIENTS", anchor="mm", font=fonts['section'], fill=DARK_TEXT)
    y += 95

    why_items = [
        ("Lean proteins = muscle, minimal fat", "Chicken & turkey are low-fat, salmon adds omega-3s"),
        ("Veggies keep him full, low calories", "Sweet potato aids digestion, broccoli supports joints"),
    ]

    for title, desc in why_items:
        draw.text((40, y), title, font=fonts['item'], fill=VIBRANT_TEAL)
        y += 32
        draw.text((60, y), desc, font=fonts['tiny'], fill=LIGHT_GRAY)
        y += 35

    y += 15

    # What to expect
    draw.rectangle([(20, y), (WIDTH-20, y+65)], fill=VIBRANT_PURPLE)
    draw.text((WIDTH//2, y+32), "🎯 WHAT TO EXPECT", anchor="mm", font=fonts['section'], fill=WHITE_TEXT)
    y += 95

    expectations = [
        "Week 2-4: More energy, shinier coat, better digestion",
        "Week 4-8: Visible weight loss (0.5-1 lb/week), muscle tone",
        "Week 8+: Sustained lean weight, better mobility",
    ]

    for expectation in expectations:
        draw.text((40, y), "✓ " + expectation, font=fonts['item'], fill=WHITE_TEXT)
        y += 40

    # Footer
    draw.text((WIDTH//2, HEIGHT-50), "Tail Prep • tailprep.com", anchor="mm", font=fonts['small'], fill=VIBRANT_TEAL)

    img.save(f"{output_dir}/01-Shopping-List.png")
    print(f"✅ Generated: 01-Shopping-List.png")

def generate_daily_meal(output_dir, dog_profile, day_name, meal_data, day_num):
    """Generate one daily meal page"""
    fonts = get_fonts()
    img = Image.new('RGB', (WIDTH, HEIGHT), DARK_BG)
    draw = ImageDraw.Draw(img)

    y = 50

    # Header
    sunrise = "🌅" if day_num <= 3 else "☀️" if day_num <= 5 else "🌆"
    draw.text((WIDTH//2, y), f"{sunrise} {day_name}", anchor="mm", font=fonts['title'], fill=VIBRANT_GREEN)
    y += 70
    draw.text((WIDTH//2, y), f"{dog_profile['name']}'s Personalized Meal Plan", anchor="mm", font=fonts['small'], fill=VIBRANT_TEAL)
    y += 70

    # MORNING MEAL
    draw.rectangle([(20, y), (WIDTH-20, y+75)], fill=VIBRANT_GREEN)
    draw.text((WIDTH//2, y+37), "🌅 MORNING MEAL", anchor="mm", font=fonts['section'], fill=DARK_TEXT)
    y += 95

    # Calories & macros
    draw.rectangle([(30, y), (WIDTH-30, y+100)], fill=VIBRANT_PINK)
    draw.text((70, y+20), f"{meal_data['morning']['calories']} CAL", anchor="lm", font=fonts['section'], fill=WHITE_TEXT)
    draw.text((70, y+60), meal_data['morning']['macros'], anchor="lm", font=fonts['item'], fill=WHITE_TEXT)
    y += 120

    # Ingredients
    draw.rectangle([(20, y), (WIDTH-20, y+65)], fill=VIBRANT_ORANGE)
    draw.text((WIDTH//2, y+32), "📍 INGREDIENTS", anchor="mm", font=fonts['section'], fill=DARK_TEXT)
    y += 85

    for ingredient in meal_data['morning']['ingredients']:
        draw.text((70, y), f"• {ingredient}", font=fonts['item'], fill=WHITE_TEXT)
        y += 38

    y += 15

    # Steps
    draw.rectangle([(20, y), (WIDTH-20, y+65)], fill=VIBRANT_PURPLE)
    draw.text((WIDTH//2, y+32), "👨‍🍳 HOW TO PREPARE", anchor="mm", font=fonts['section'], fill=WHITE_TEXT)
    y += 85

    for i, step in enumerate(meal_data['morning']['steps'], 1):
        draw.text((70, y), f"{i}. {step}", font=fonts['item'], fill=WHITE_TEXT)
        y += 38

    # Time
    draw.rectangle([(30, y+10), (WIDTH-30, y+60)], fill=VIBRANT_TEAL)
    draw.text((WIDTH//2, y+35), f"⏱️  {meal_data['morning']['time']}", anchor="mm", font=fonts['section'], fill=DARK_TEXT)
    y += 90

    # EVENING MEAL
    draw.rectangle([(20, y), (WIDTH-20, y+75)], fill=VIBRANT_ORANGE)
    draw.text((WIDTH//2, y+37), "🌙 EVENING MEAL", anchor="mm", font=fonts['section'], fill=DARK_TEXT)
    y += 95

    # Calories & macros
    draw.rectangle([(30, y), (WIDTH-30, y+100)], fill=VIBRANT_TEAL)
    draw.text((70, y+20), f"{meal_data['evening']['calories']} CAL", anchor="lm", font=fonts['section'], fill=DARK_TEXT)
    draw.text((70, y+60), meal_data['evening']['macros'], anchor="lm", font=fonts['item'], fill=DARK_TEXT)
    y += 120

    # Ingredients
    draw.rectangle([(20, y), (WIDTH-20, y+65)], fill=VIBRANT_GREEN)
    draw.text((WIDTH//2, y+32), "📍 INGREDIENTS", anchor="mm", font=fonts['section'], fill=DARK_TEXT)
    y += 85

    for ingredient in meal_data['evening']['ingredients']:
        draw.text((70, y), f"• {ingredient}", font=fonts['item'], fill=WHITE_TEXT)
        y += 38

    y += 15

    # Steps
    draw.rectangle([(20, y), (WIDTH-20, y+65)], fill=VIBRANT_PINK)
    draw.text((WIDTH//2, y+32), "👨‍🍳 HOW TO PREPARE", anchor="mm", font=fonts['section'], fill=WHITE_TEXT)
    y += 85

    for i, step in enumerate(meal_data['evening']['steps'], 1):
        draw.text((70, y), f"{i}. {step}", font=fonts['item'], fill=WHITE_TEXT)
        y += 38

    # Time
    draw.rectangle([(30, y+10), (WIDTH-30, y+60)], fill=VIBRANT_PURPLE)
    draw.text((WIDTH//2, y+35), f"⏱️  {meal_data['evening']['time']}", anchor="mm", font=fonts['section'], fill=WHITE_TEXT)

    # Footer
    draw.text((WIDTH//2, HEIGHT-50), "Tail Prep • tailprep.com", anchor="mm", font=fonts['small'], fill=VIBRANT_TEAL)

    img.save(f"{output_dir}/{day_num:02d}-{day_name}.png")
    print(f"✅ Generated: {day_num:02d}-{day_name}.png")

def main():
    if len(sys.argv) < 4:
        print("Usage: python generate_meal_images.py <output_dir> <dog_profile_json> <meals_json> [shopping_prices_json]")
        sys.exit(1)

    output_dir = sys.argv[1]
    dog_profile = json.loads(sys.argv[2])
    meals = json.loads(sys.argv[3])
    ingredient_prices = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
    shopping_items = meals.get('shoppingList', [])

    # Generate shopping list
    generate_shopping_list(output_dir, dog_profile, shopping_items, ingredient_prices)

    # Generate daily meals
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    for i, day in enumerate(days, 2):
        if day in meals:
            generate_daily_meal(output_dir, dog_profile, day, meals[day], i)

    print(f"\n✨ All meal plan images generated!")

if __name__ == '__main__':
    main()
