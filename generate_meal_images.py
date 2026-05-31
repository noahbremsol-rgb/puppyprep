#!/usr/bin/env python3
"""
Generate professional meal plan PNG images for Tail Prep.
Clean, readable design matching the quiz aesthetic.
"""

import sys
import json
from PIL import Image, ImageDraw, ImageFont

# WARM, PROFESSIONAL COLOR PALETTE (matches quiz)
CREAM_BG = "#F5E6D3"
DARK_TEXT = "#5A4A42"
ACCENT_TEAL = "#4DA6A6"
ACCENT_WARM = "#C99A6E"
WHITE_BG = "#FFFFFF"
LIGHT_GRAY = "#E8D4C0"
SECTION_BG = "#F9F7F5"

WIDTH = 1080
HEIGHT = 1920

def get_fonts():
    """Load fonts with fallback"""
    try:
        fonts = {
            'hero': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72),
            'title': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48),
            'section': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40),
            'subsection': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32),
            'body': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28),
            'small': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24),
        }
    except:
        default = ImageFont.load_default()
        fonts = {k: default for k in fonts.keys()}
    return fonts

def generate_shopping_list(output_dir, dog_profile, shopping_items, ingredient_prices):
    """Generate a beautiful shopping list page"""
    fonts = get_fonts()
    img = Image.new('RGB', (WIDTH, HEIGHT), CREAM_BG)
    draw = ImageDraw.Draw(img)

    y = 60

    # Header
    draw.text((WIDTH//2, y), "🐕", anchor="mm", font=fonts['hero'])
    y += 100

    draw.text((WIDTH//2, y), f"{dog_profile['name']}'s Weekly Meal Plan", anchor="mm", font=fonts['title'], fill=DARK_TEXT)
    y += 70

    # Dog info
    info = f"{dog_profile['breed']} • {dog_profile['size']} • {dog_profile['age']}"
    draw.text((WIDTH//2, y), info, anchor="mm", font=fonts['small'], fill=ACCENT_TEAL)
    y += 60

    # Divider
    draw.rectangle([(60, y), (WIDTH-60, y+3)], fill=LIGHT_GRAY)
    y += 50

    # SHOPPING LIST TITLE
    draw.text((60, y), "📋 WEEKLY SHOPPING LIST", font=fonts['section'], fill=DARK_TEXT)
    y += 60

    # Organize & display items
    categories = {
        'PROTEINS': [],
        'VEGETABLES & CARBS': [],
        'SUPPLEMENTS': []
    }

    for item in shopping_items:
        item_lower = item.lower()
        if any(word in item_lower for word in ['chicken', 'turkey', 'salmon', 'beef', 'meat', 'fish', 'egg']):
            categories['PROTEINS'].append(item)
        elif any(word in item_lower for word in ['potato', 'broccoli', 'carrot', 'bean', 'squash', 'rice', 'grain', 'sweet']):
            categories['VEGETABLES & CARBS'].append(item)
        else:
            categories['SUPPLEMENTS'].append(item)

    # Display categories
    for category_name, items in categories.items():
        if not items:
            continue

        # Category header
        icon = "🥩" if "PROTEIN" in category_name else "🥕" if "VEGET" in category_name else "💊"
        draw.text((60, y), f"{icon} {category_name}", font=fonts['subsection'], fill=ACCENT_WARM)
        y += 50

        # Items
        for item in items:
            draw.text((90, y), f"• {item}", font=fonts['body'], fill=DARK_TEXT)
            y += 45

        y += 30

    # Footer
    y += 20
    draw.rectangle([(60, y), (WIDTH-60, y+2)], fill=LIGHT_GRAY)
    y += 40
    draw.text((WIDTH//2, y), "Tail Prep • Personalized Dog Nutrition", anchor="mm", font=fonts['small'], fill=ACCENT_TEAL)

    # Save
    img.save(f"{output_dir}/01-Shopping-List.png")
    print("✓ Shopping list generated")

def generate_daily_meal(output_dir, dog_profile, day_name, meal_data, day_num):
    """Generate a single day's meal image"""
    fonts = get_fonts()
    img = Image.new('RGB', (WIDTH, HEIGHT), CREAM_BG)
    draw = ImageDraw.Draw(img)

    y = 60

    # Day header
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_emoji = "🌅" if day_num <= 3 else "☀️" if day_num <= 5 else "🌙"

    draw.text((WIDTH//2, y), f"{day_emoji} {day_name}", anchor="mm", font=fonts['title'], fill=ACCENT_TEAL)
    y += 70

    draw.text((WIDTH//2, y), f"{dog_profile['name']}'s Meal", anchor="mm", font=fonts['small'], fill=ACCENT_WARM)
    y += 60

    # Divider
    draw.rectangle([(60, y), (WIDTH-60, y+3)], fill=LIGHT_GRAY)
    y += 50

    # CALORIES & MACROS
    draw.text((60, y), "⚡ NUTRITION", font=fonts['section'], fill=DARK_TEXT)
    y += 50

    cal_text = f"{meal_data['calories']} Calories"
    draw.text((90, y), cal_text, font=fonts['body'], fill=ACCENT_WARM)
    y += 45

    macro_text = f"Macros: {meal_data['macros']}"
    draw.text((90, y), macro_text, font=fonts['body'], fill=DARK_TEXT)
    y += 50

    # INGREDIENTS
    draw.text((60, y), "📍 INGREDIENTS", font=fonts['section'], fill=DARK_TEXT)
    y += 50

    for ingredient in meal_data['ingredients']:
        # Wrap long ingredients
        if len(ingredient) > 50:
            parts = ingredient.split()
            line1, line2 = "", ""
            for part in parts:
                if len(line1 + part) < 45:
                    line1 += part + " "
                else:
                    line2 += part + " "
            draw.text((90, y), f"• {line1}", font=fonts['body'], fill=DARK_TEXT)
            y += 40
            if line2:
                draw.text((90, y), f"  {line2}", font=fonts['body'], fill=DARK_TEXT)
                y += 40
        else:
            draw.text((90, y), f"• {ingredient}", font=fonts['body'], fill=DARK_TEXT)
            y += 40

    y += 20

    # PREPARATION STEPS
    draw.text((60, y), "👨‍🍳 HOW TO PREPARE", font=fonts['section'], fill=DARK_TEXT)
    y += 50

    for i, step in enumerate(meal_data['steps'], 1):
        if step.strip() == "--":
            continue

        # Wrap long steps
        words = step.split()
        lines = []
        current_line = ""
        for word in words:
            if len(current_line + word) < 60:
                current_line += word + " "
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word + " "
        if current_line:
            lines.append(current_line)

        # Draw step number and first line
        draw.text((90, y), f"{i}. {lines[0]}", font=fonts['body'], fill=DARK_TEXT)
        y += 40

        # Draw continuation lines
        for line in lines[1:]:
            draw.text((110, y), line, font=fonts['body'], fill=DARK_TEXT)
            y += 40

    y += 20

    # PREP TIME
    draw.text((60, y), f"⏱️  Prep Time: {meal_data['time']}", font=fonts['subsection'], fill=ACCENT_TEAL)
    y += 50

    # Footer
    draw.rectangle([(60, y+20), (WIDTH-60, y+22)], fill=LIGHT_GRAY)
    y += 60
    draw.text((WIDTH//2, y), "Tail Prep • Personalized Dog Nutrition", anchor="mm", font=fonts['small'], fill=ACCENT_TEAL)

    # Save with proper numbering
    img.save(f"{output_dir}/{day_num:02d}-{day_name}.png")
    print(f"✓ {day_name} meal generated")

def main():
    if len(sys.argv) < 4:
        print("Usage: python generate_meal_images.py <output_dir> <dog_profile_json> <meals_json>")
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

    print(f"\n✨ All {len(days)+1} images generated successfully!")

if __name__ == '__main__':
    main()
