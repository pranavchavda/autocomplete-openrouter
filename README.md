# AI Text Autocomplete Chrome Extension

A powerful Chrome extension that provides AI-powered text autocompletion using OpenRouter's API. Get intelligent, context-aware text suggestions as you type across all text inputs on the web.

## Features

- **Real-time Autocompletion**: Get AI-powered suggestions as you type
- **Smart Context Detection**: Sends relevant context to generate accurate completions
- **Inline Suggestions**: Greyed-out inline suggestions similar to Grammarly or GitHub Copilot
- **Tab to Accept**: Press Tab to accept the current suggestion
- **Model Selection**: Choose from a wide variety of AI models from OpenRouter
- **Privacy-Focused**: Skips password fields and sensitive inputs automatically
- **Performance Optimized**: Includes caching, debouncing, and rate limiting

## Installation

### Step 1: Generate Icons

Before loading the extension, generate the required icon files:

1. Open `icons/generate_icons.html` in your web browser
2. Download each generated icon (icon16.png, icon48.png, icon128.png)
3. Save them in the `icons/` directory

Alternatively, see `icons/README.md` for other icon generation methods.

### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the extension directory
5. The extension icon should appear in your toolbar

### Step 3: Configure API Key

1. Click the extension icon in the toolbar
2. Enter your OpenRouter API key (get one at [openrouter.ai/keys](https://openrouter.ai/keys))
3. Select your preferred AI model from the dropdown
4. Click "Save Settings"

## Usage

1. Start typing in any text field on any website
2. After a brief pause (300ms), an AI-generated completion will appear in grey text
3. Press **Tab** to accept the completion
4. Press **Escape** to dismiss the completion
5. Continue typing to dismiss and get a new suggestion

## Supported Input Types

- Standard text inputs (`<input type="text">`)
- Textareas (`<textarea>`)
- Content-editable elements (Gmail, Google Docs, etc.)

## Excluded Fields

For your security, the extension automatically skips:
- Password fields
- Email fields
- Credit card fields
- Any field marked with `autocomplete="off"`

## Configuration

### API Key

Get your OpenRouter API key from [openrouter.ai/keys](https://openrouter.ai/keys). OpenRouter provides access to multiple AI models through a single API.

### Model Selection

Choose from various models with different characteristics:

- **Fast & Affordable**: Google Gemini Flash 1.5 (recommended for autocomplete)
- **High Quality**: Claude 3 Haiku, GPT-3.5 Turbo
- **Specialized**: Browse the full model list in the extension settings

## Performance Optimization

The extension includes several optimizations:

- **Debouncing**: 300ms delay before triggering completion
- **Rate Limiting**: Maximum 5 requests per second
- **Caching**: Recent completions are cached for 5 minutes
- **Request Cancellation**: Previous requests are cancelled when new input is detected
- **Context Limiting**: Only sends the last 100 characters as context

## File Structure

```
chrome-autocomplete/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for API calls
├── content.js            # Content script for text monitoring
├── popup.html            # Settings popup interface
├── popup.js              # Settings popup logic
├── styles.css            # Overlay styling
├── icons/                # Extension icons
│   ├── generate_icons.html   # Icon generator tool
│   ├── generate_icons.py     # Python icon generator
│   ├── icon.svg             # SVG source
│   └── README.md            # Icon generation instructions
└── README.md             # This file
```

## Development

### Requirements

- Chrome 88+ (Manifest V3 support)
- OpenRouter API key

### Testing

1. Load the extension in developer mode
2. Open the browser console (F12)
3. Look for messages from the extension:
   - Content script: "AI Autocomplete content script loaded"
   - Background: "AI Autocomplete Extension installed"
4. Test in various input fields across different websites

### Debugging

- **No completions appearing**: Check the browser console for errors
- **API errors**: Verify your API key in the extension settings
- **Slow performance**: Try a faster model (e.g., Gemini Flash)
- **Completions not accepting**: Ensure Tab key isn't being captured by the website

## Privacy & Security

- API keys are stored securely in Chrome's sync storage
- Sensitive fields (passwords, credit cards) are automatically excluded
- No data is collected or sent anywhere except to OpenRouter's API
- All communication uses HTTPS

## Troubleshooting

### Extension not loading

1. Ensure all files are present in the directory
2. Generate the icon files (see Installation Step 1)
3. Check Chrome's extension error messages

### Completions not showing

1. Verify API key is configured correctly
2. Check that you have an active internet connection
3. Open DevTools Console and look for error messages
4. Try a different model in the settings

### Tab key not accepting

Some websites override the Tab key. Try:
1. Clicking with the mouse
2. Using a different website to test
3. Checking the browser console for errors

## Known Limitations

- Google Docs has partial support due to its custom editor
- Some rich text editors may not display completions correctly
- Very fast typing may not trigger completions
- Some websites with aggressive CSP policies may block the extension

## Contributing

This is an open-source project. Contributions are welcome!

## License

MIT License - feel free to use and modify as needed.

## Credits

Built with:
- [OpenRouter](https://openrouter.ai) - Multi-model AI API
- Chrome Extension Manifest V3
- Modern JavaScript (ES6+)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review OpenRouter's documentation
3. Check Chrome extension development docs

---

**Note**: This extension sends your text input to OpenRouter's API for completion. Review OpenRouter's privacy policy and terms of service before use.
