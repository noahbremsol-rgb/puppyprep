#!/usr/bin/env python3
"""
Generate clean, readable meal plan PNG images for Tail Prep.
No emojis. Full-page layout. Professional design.
"""

import sys
import json
from PIL import Image, ImageDraw, ImageFont

# COLOR PALETTE
CREAM_BG = "#F5E6D3"
DARK_TEXT = "#5A4A42"
ACCENT_TEAL = "#4DA6A6"
ACCENT_WARM = "#C99A6E"
WHITE_BG = "#FFFFFF"
LIGHT_GRAY = "#E8D4C0"

WIDTH = 1080
HEIGHT = 1920

def get_fonts():
    """Load fonts with fallback"""
    try:
        fonts = {
            'hero': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64),
            'title': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 44),
            'section': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36),
            'subsection': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30),
            'body': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26),
            'small': ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22),
        }
    except:
        default = ImageFont.load_default()
        fonts = {k: default for k in fonts.keys()}
    return fonts

def generate_shopping_list(output_dir, dog_profile, shopping_items, meals, ingredient_prices):
    """Generate shopping list page with actual items"""
    fonts = get_fonts()
    img = Image.new('RGB', (WIDTH, HEIGHT), CREAM_BG)
    draw = ImageDraw.Draw(img)

    y = 60

    # Header
    draw.text((WIDTH//2, y), dog_profile['name'], anchor="mm", font=fonts['hero'], fill=DARK_TEXT)
    y += 90

    draw.text((WIDTH//2, y), "Weekly Meal Plan", anchor="mm", font=fonts['title'], fill=DARK_TEXT)
    y += 60

    # Dog info
    info = f"{dog_profile['breed']} - {dog_profile['size']} - {dog_profile['age']}"
    draw.text((WIDTH//2, y), info, anchor="mm", font=fonts['small'], fill=ACCENT_TEAL)
    y += 50

    # Divider
    draw.rectangle([(60, y), (WIDTH-60, y+2)], fill=LIGHT_GRAY)
    y += 40

    # SHOPPING LIST TITLE
    draw.text((60, y), "WEEKLY SHOPPING LIST", font=fonts['section'], fill=DARK_TEXT)
    y += 55

    # If shopping_items is empty, extract from meals
    if not shopping_items and isinstance(meals, dict):
        all_ingredients = set()
        for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
            if day in meals and 'ingredients' in meals[day]:
                for ingredient in meals[day]['ingredients']:
                    all_ingredients.add(ingredient.strip())
        shopping_items = sorted(list(all_ingredients))

    # Organize items by category
    categories = {
        'PROTEINS': [],
        'VEGETABLES & CARBS': [],
        'SUPPLEMENTS': []
    }

    for item in shopping_items:
        item_lower = item.lower()
        if any(word in item_lower for word in ['chicken', 'turkey', 'salmon', 'beef', 'meat', 'fish', 'egg', 'pork', 'lamb']):
            categories['PROTEINS'].append(item)
        elif any(word in item_lower for word in ['potato', 'broccoli', 'carrot', 'bean', 'squash', 'rice', 'grain', 'sweet', 'pea', 'green bean', 'spinach', 'pumpkin']):
            categories['VEGETABLES & CARBS'].append(item)
        else:
            categories['SUPPLEMENTS'].append(item)

    # Display categories with items
    for cat_name, items in categories.items():
        if not items:
            continue

        # Category header
        draw.text((60, y), cat_name, font=fonts['subsection'], fill=ACCENT_WARM)
        y += 45

        # Items
        for item in items:
            draw.text((90, y), f"- {item}", font=fonts['body'], fill=DARK_TEXT)
            y += 40

        y += 20

    # Footer with spacing
    y += 40
    draw.rectangle([(60, y), (WIDTH-60, y+2)], fill=LIGHT_GRAY)
    y += 40
    draw.text((WIDTH//2, y), "Tail Prep - Personalized Dog Nutrition", anchor="mm", font=fonts['small'], fill=ACCENT_TEAL)

    # Save
    img.save(f"{output_dir}/01-Shopping-List.png")
    print("✓ Shopping list generated")

def generate_daily_meal(output_dir, dog_profile, day_name, meal_data, day_num):
    """Generate single day meal image"""
    fonts = get_fonts()
    img = Image.new('RGB', (WIDTH, HEIGHT), CREAM_BG)
    draw = ImageDraw.Draw(img)

    y = 60

    # Day header
    draw.text((WIDTH//2, y), day_name, anchor="mm", font=fonts['title'], fill=ACCENT_TEAL)
    y += 60

    draw.text((WIDTH//2, y), dog_profile['name'] + "'s Meal", anchor="mm", font=fonts['small'], fill=ACCENT_WARM)
    y += 50

    # Divider
    draw.rectangle([(60, y), (WIDTH-60, y+2)], fill=LIGHT_GRAY)
    y += 40

    # NUTRITION
    draw.text((60, y), "NUTRITION", font=fonts['section'], fill=DARK_TEXT)
    y += 50

    draw.text((90, y), meal_data['calories'] + " Calories", font=fonts['body'], fill=ACCENT_WARM)
    y += 40

    draw.text((90, y), "Macros: " + meal_data['macros'], font=fonts['body'], fill=DARK_TEXT)
    y += 50

    # INGREDIENTS
    draw.text((60, y), "INGREDIENTS", font=fonts['section'], fill=DARK_TEXT)
    y += 50

    for ingredient in meal_data['ingredients']:
        # Fix fractions and wrap long text
        ingredient = ingredient.replace('⅓', '1/3').replace('½', '1/2').replace('¾', '3/4')

        if len(ingredient) > 55:
            words = ingredient.split()
            line1, line2 = "", ""
            for word in words:
                if len(line1 + word) < 50:
                    line1 += word + " "
                else:
                    line2 += word + " "
            draw.text((90, y), "- " + line1, font=fonts['body'], fill=DARK_TEXT)
            y += 38
            if line2:
                draw.text((110, y), line2, font=fonts['body'], fill=DARK_TEXT)
                y += 38
        else:
            draw.text((90, y), "- " + ingredient, font=fonts['body'], fill=DARK_TEXT)
            y += 38

    y += 20

    # PREPARATION
    draw.text((60, y), "PREPARATION", font=fonts['section'], fill=DARK_TEXT)
    y += 50

    for i, step in enumerate(meal_data['steps'], 1):
        if step.strip() == "--":
            continue

        # Fix fractions
        step = step.replace('⅓', '1/3').replace('½', '1/2').replace('¾', '3/4')

        # Wrap text
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

        # Draw step
        draw.text((90, y), str(i) + ". " + lines[0], font=fonts['body'], fill=DARK_TEXT)
        y += 38

        for line in lines[1:]:
            draw.text((110, y), line, font=fonts['body'], fill=DARK_TEXT)
            y += 38

    y += 20

    # PREP TIME
    draw.text((60, y), "Prep Time: " + meal_data['time'], font=fonts['subsection'], fill=ACCENT_TEAL)
    y += 50

    # Footer
    draw.rectangle([(60, y+20), (WIDTH-60, y+22)], fill=LIGHT_GRAY)
    y += 60
    draw.text((WIDTH//2, y), "Tail Prep - Personalized Dog Nutrition", anchor="mm", font=fonts['small'], fill=ACCENT_TEAL)

    # Save
    img.save(f"{output_dir}/{day_num:02d}-{day_name}.png")
    print(f"✓ {day_name} generated")

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
    generate_shopping_list(output_dir, dog_profile, shopping_items, meals, ingredient_prices)

    # Generate daily meals
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    for i, day in enumerate(days, 2):
        if day in meals:
            generate_daily_meal(output_dir, dog_profile, day, meals[day], i)

    print(f"\nAll {len(days)+1} images generated!")

if __name__ == '__main__':
    main()
