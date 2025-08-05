# Interactive Athlete Frame Review Interface

A React TypeScript application for analyzing athlete performance through video analysis and joint tracking.

## Features

- Video playback with automatic pausing at key moments
- Real-time joint detection using TensorFlow.js
- Interactive joint markers with tooltips
- Frame capture and export functionality
- Responsive design for mobile devices
- Performance metrics display
- Athlete information panel

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

## Technical Details

- Built with React and TypeScript
- Uses TensorFlow.js and BlazePose for pose detection
- Responsive design using CSS Grid and Flexbox
- Modern UI with SEE branding guidelines

## Design Decisions

- Used TensorFlow.js for real-time pose detection instead of hardcoded coordinates
- Implemented a modular component structure for better maintainability
- Used CSS variables for consistent theming
- Mobile-first responsive design approach
- Optimized performance by using requestAnimationFrame for pose detection

## License

MIT