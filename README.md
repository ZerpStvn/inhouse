# Secure Exam Browser

A full-stack exam security system that prevents cheating during online exams. It includes an admin panel for managing exam sessions and a locked-down Electron client for students.

## Features

### Admin Panel
- Create and manage exam sessions
- Set allowed URLs that students can access
- Generate unique access codes for each session
- Set optional start/end times for exams
- Monitor active students and view violations
- Terminate student sessions remotely

### Student Client (Electron App)
- Enter access code to join exam
- Agreement modal with terms before starting
- **Lockdown Features:**
  - Fullscreen kiosk mode (no escape)
  - Block keyboard shortcuts (Alt+Tab, Alt+F4, Ctrl+W, etc.)
  - Block new windows/tabs
  - Disable right-click context menu
  - Disable DevTools
  - URL filtering (only allowed URLs accessible)
  - Process monitoring (detects and blocks blacklisted apps)
  - Screen recording detection (OBS, Camtasia, etc.)
  - Virtual machine detection
  - Task manager disabled (Windows)
  - Violation reporting to server

## Tech Stack

- **Backend:** Node.js, Express, Prisma, SQLite
- **Admin Panel:** React, TypeScript, Tailwind CSS, Vite
- **Student Client:** Electron, React, TypeScript, Tailwind CSS

## Project Structure

```
inhouse/
├── server/          # Backend API
├── admin/           # Admin web panel
├── client/          # Student Electron app
└── package.json     # Root workspace
```

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### 1. Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

### 2. Setup Database

```bash
# Navigate to server directory
cd server

# Generate Prisma client and create database
npm run db:generate
npm run db:push
```

### 3. Start the Backend Server

```bash
# From server directory
npm run dev

# Server runs on http://localhost:3001
```

### 4. Start the Admin Panel

```bash
# Open new terminal, from admin directory
cd admin
npm run dev

# Admin panel runs on http://localhost:5173
```

### 5. Start the Student Client (Development)

```bash
# Open new terminal, from client directory
cd client
npm run dev

# Client runs on http://localhost:5174 (renderer)
# Electron main process watches for changes
```

### 6. Build Student Client for Distribution

```bash
cd client

# Build for Windows
npm run dist:win

# Built installer will be in client/release/
```

## Usage

### Admin Workflow

1. Open admin panel at `http://localhost:5173`
2. Register a new admin account (first time only)
3. Login with your credentials
4. Click "Create New Session"
5. Enter exam name and allowed URLs
6. Copy the generated access code (e.g., `ABC-123`)
7. Share the code with students

### Student Workflow

1. Launch the Secure Exam Browser application
2. Enter the 6-character access code
3. Enter your name and student ID
4. Read and accept the exam agreement
5. Complete the exam in the locked browser
6. Click "Submit Exam" when finished

### Admin Exit

During an exam, admins can exit the locked browser by:
1. Clicking "Admin Exit" in the top-right corner
2. Entering the admin password (default: `admin123`)

To change the admin password, set the `ADMIN_EXIT_PASSWORD` environment variable.

## Security Features

| Feature | Description |
|---------|-------------|
| Kiosk Mode | Fullscreen, no title bar, always on top |
| Shortcut Blocking | Alt+Tab, Alt+F4, Ctrl+W, PrintScreen, etc. |
| URL Filtering | Only allowed exam URLs accessible |
| Process Monitoring | Detects OBS, TeamViewer, Discord, VS Code, etc. |
| VM Detection | Detects VMware, VirtualBox, QEMU |
| Task Manager | Disabled during exam (Windows) |
| Violation Logging | All security events logged to server |

## API Endpoints

### Admin Routes (`/api/admin`)
- `POST /register` - Create admin account
- `POST /login` - Admin login
- `GET /sessions` - List exam sessions
- `POST /sessions` - Create exam session
- `PUT /sessions/:id` - Update session
- `DELETE /sessions/:id` - Delete session

### Student Routes (`/api/student`)
- `POST /validate-code` - Validate access code
- `POST /start-attempt` - Start exam attempt
- `POST /report-violation` - Report security violation
- `POST /end-attempt` - End exam attempt

## Environment Variables

### Server
- `PORT` - Server port (default: 3001)
- `JWT_SECRET` - JWT signing secret

### Client
- `ADMIN_EXIT_PASSWORD` - Password for admin exit (default: admin123)

## Development

### Running Tests
```bash
# Coming soon
```

### Building for Production

```bash
# Build server
cd server && npm run build

# Build admin
cd admin && npm run build

# Build client (Windows installer)
cd client && npm run dist:win
```

## License

MIT
