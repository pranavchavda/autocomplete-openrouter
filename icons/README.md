# Extension Icons

This directory contains the icons for the AI Text Autocomplete Chrome extension.

## Required Icon Sizes

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Generating Icons

### Method 1: Using the HTML Generator (Recommended)

1. Open `generate_icons.html` in your web browser
2. The icons will be generated automatically
3. Click the "Download" link under each icon to save them
4. Save each icon with its correct filename in this directory

### Method 2: Using Python (requires Pillow)

```bash
pip install Pillow
python3 generate_icons.py
```

### Method 3: Manual Creation

Create PNG icons with the following specifications:

- **Background**: Purple gradient (#667eea to #764ba2)
- **Text**: White "AI" text, centered, bold
- **Style**: Modern, clean design
- **Border Radius**: 22% of size for rounded corners

You can use any image editing tool like:
- Photoshop
- GIMP
- Figma
- Canva
- Sketch

### Method 4: Use the SVG

The `icon.svg` file can be converted to PNG using online tools like:
- https://cloudconvert.com/svg-to-png
- https://svgtopng.com/
- Or use ImageMagick: `convert -background none icon.svg icon128.png`

## Temporary Placeholder

If you need to test the extension immediately, you can use any placeholder PNG files temporarily. The extension will still function without custom icons.
