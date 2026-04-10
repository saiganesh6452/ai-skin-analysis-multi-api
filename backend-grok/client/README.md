# Frontend - AI Skin Analysis UI

React application with camera integration and beautiful UI.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm start
```

App opens at http://localhost:3000

## Build for Production

```bash
npm run build
```

Creates optimized production build in `build/` folder.

## Features

- Real-time camera feed with face guide overlay
- Multi-angle capture (front, left, right)
- Live quality indicators
- Beautiful gradient UI
- Comprehensive results display
- Print/download report functionality
- Fully responsive design

## File Structure

- `src/App.js` - Main React component
- `src/App.css` - Styling
- `src/index.js` - React entry point
- `public/index.html` - HTML template

## Customization

### Change Colors
Edit gradient colors in `src/App.css`:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Modify Camera Settings
Edit video constraints in `src/App.js` line 35:
```javascript
video: {
  width: { ideal: 1920 },
  height: { ideal: 1080 }
}
```
