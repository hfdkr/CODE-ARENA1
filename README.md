# CodeArena v3

> A modern, interactive quiz and coding challenge platform with real-time scoring and user authentication.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green)
![License](https://img.shields.io/badge/license-ISC-blue)

## 🎯 Overview

CodeArena is a full-stack web application designed for testing coding knowledge through interactive quizzes. Users can authenticate, select from multiple categories, choose difficulty levels, and compete in timed quizzes with instant scoring and feedback.

## ✨ Key Features

- **User Authentication**: Secure signup/login with JWT tokens and bcrypt password hashing
- **Multiple Quiz Categories**: Organized content for different skill levels
- **Difficulty Levels**: Easy, Medium, and Hard difficulty options
- **Timed Challenges**: Configurable time per question with countdown timer
- **Real-time Scoring**: Instant feedback and score tracking
- **Session Management**: Persistent user sessions with activity tracking
- **Dark Theme UI**: Modern, responsive interface with custom styling
- **Local Storage**: Client-side state persistence for seamless experience
- **CORS Enabled**: Ready for cross-origin requests

## 🛠️ Tech Stack

### Backend
- **Framework**: Express.js 5.2.1
- **Runtime**: Node.js
- **Authentication**: JWT (jsonwebtoken 9.0.3)
- **Security**: bcryptjs 3.0.3 (password hashing)
- **CORS**: Express CORS middleware
- **Database**: JSON file-based storage
- **Utilities**: uuid 14.0.1

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Custom styling with dark theme
- **JavaScript (Vanilla)**: No frameworks - pure DOM manipulation
- **Local Storage**: Client-side data persistence
- **Fonts**: JetBrains Mono, DM Sans, Syne from Google Fonts
- **Icons**: Flaticon uicons library

## 📁 Project Structure

```
CODE-ARENA/
├── server.js              # Express server entry point
├── db.js                  # Database utility functions
├── package.json           # Dependencies and scripts
├── data/
│   └── db.json           # JSON database file
├── public/
│   ├── index.html        # Main HTML template
│   ├── js/
│   │   └── app.js        # Client-side application logic
│   └── css/
│       └── styles.css    # Application styles
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14.0.0 or higher)
- npm or yarn

### Installation

1. **Clone or download the repository**
   ```bash
   cd CODE-ARENA
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   The application will be available at `http://localhost:3000`

## 📖 Usage

### For Users

1. **Create an Account**: Click "Sign Up" and enter your email and password
2. **Login**: Use your credentials to access the quiz dashboard
3. **Select a Category**: Choose from available quiz categories
4. **Choose Difficulty**: Select Easy, Medium, or Hard
5. **Take the Quiz**: Answer questions within the time limit
6. **View Results**: See your score and performance summary

### API Endpoints

#### Authentication
- `POST /api/signup` - Register new user
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user
- `POST /api/refresh` - Refresh JWT token

#### Quiz Data
- `GET /api/categories` - Get all quiz categories
- `GET /api/quiz/:category/:difficulty` - Get quiz questions
- `POST /api/quiz/submit` - Submit quiz answers

#### User Management
- `GET /api/user/profile` - Get user profile
- `GET /api/user/stats` - Get user statistics
- `POST /api/user/settings` - Update user settings


## 🔐 Security Features

- **Password Hashing**: bcryptjs with 10 salt rounds
- **JWT Authentication**: Secure token-based authentication
- **CORS Protection**: Configured CORS middleware
- **HTML Sanitization**: Input sanitization to prevent XSS attacks
- **Session Tracking**: Server-side session management with activity timestamps

## ⚙️ Configuration

### Environment Variables

Create a `.env` file or set environment variables:

```env
PORT=3000
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

### Database

The application uses a JSON-based database stored at `data/db.json`. The database structure includes:

```json
{
  "users": [...],
  "sessions": {...},
  "categories": [...],
  "quizzes": [...]
}
```

## 📝 Development

### Running in Development Mode

```bash
npm start
```

The server will start on port 3000 (or the PORT environment variable).

### Project Architecture

**Backend Flow**:
1. Express receives HTTP requests
2. CORS middleware processes cross-origin requests
3. Static files served from `public/` directory
4. API routes handle authentication and data operations
5. JWT middleware verifies protected routes
6. Database operations use `db.js` utility functions

**Frontend Flow**:
1. `app.js` initializes the application state
2. DOM elements render based on authentication status
3. API requests sent with Bearer token (if authenticated)
4. Local storage persists user data and tokens
5. Timer intervals manage quiz countdowns
6. Event listeners handle user interactions

## 📊 Data Models

### User
```javascript
{
  id: string (UUID),
  email: string,
  passwordHash: string,
  createdAt: number (timestamp),
  stats: { totalQuizzes, averageScore, categories }
}
```

### Quiz Session
```javascript
{
  userId: string,
  category: string,
  difficulty: string,
  score: number,
  answers: array,
  timestamp: number,
  timeSpent: number
}
```

## 🐛 Troubleshooting

### Server won't start
- Ensure Node.js is installed: `node --version`
- Check if port 3000 is available
- Verify all dependencies are installed: `npm install`

### Authentication errors
- Clear browser cache and local storage
- Check JWT_SECRET matches between requests
- Verify token hasn't expired

### Quiz won't load
- Check browser console for errors
- Ensure server is running (`npm start`)
- Verify `data/db.json` exists and is valid JSON

### Database issues
- Check file permissions on `data/db.json`
- Validate JSON syntax in database file
- Ensure `data/` directory exists

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Submit a pull request

## 📄 License

This project is licensed under the ISC License - see the package.json file for details.

## 👨‍💻 Author

Created and maintained by the CodeArena development team.

## 📞 Support

For issues, questions, or suggestions:
- Check existing GitHub issues
- Review the troubleshooting section above
- Contact the development team

## 🎓 Learning Resources

- [Express.js Documentation](https://expressjs.com/)
- [JWT Authentication](https://jwt.io/)
- [bcryptjs Guide](https://github.com/dcodeIO/bcrypt.js)
- [MDN Web Docs](https://developer.mozilla.org/)

---
