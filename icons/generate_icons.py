#!/usr/bin/env python3
"""
Generate PNG icons for the Chrome extension
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create an icon with the specified size"""
    # Create image with gradient-like background
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)

    # Draw gradient effect (simple approximation)
    for y in range(size):
        # Interpolate between start and end colors
        ratio = y / size
        r = int(102 + (118 - 102) * ratio)
        g = int(126 + (75 - 126) * ratio)
        b = int(234 + (162 - 234) * ratio)
        color = (r, g, b)
        draw.line([(0, y), (size, y)], fill=color)

    # Draw rounded rectangle (approximate by drawing a rectangle with the gradient)
    # For simplicity, we'll keep the square shape

    # Draw "AI" text
    try:
        # Try to use a nice font
        font_size = int(size * 0.45)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()

    # Calculate text position (centered)
    text = "AI"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - int(size * 0.05)

    # Draw text with white color
    draw.text((x, y), text, fill='white', font=font)

    # Draw cursor indicator
    cursor_x = int(size * 0.70)
    cursor_y = int(size * 0.39)
    cursor_width = max(int(size * 0.03), 2)
    cursor_height = int(size * 0.25)

    draw.rectangle(
        [(cursor_x, cursor_y), (cursor_x + cursor_width, cursor_y + cursor_height)],
        fill=(255, 255, 255, 200)
    )

    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename}")

def main():
    """Generate all required icon sizes"""
    script_dir = os.path.dirname(os.path.abspath(__file__))

    sizes = [
        (16, 'icon16.png'),
        (48, 'icon48.png'),
        (128, 'icon128.png')
    ]

    for size, filename in sizes:
        filepath = os.path.join(script_dir, filename)
        create_icon(size, filepath)

    print("All icons generated successfully!")

if __name__ == '__main__':
    main()
