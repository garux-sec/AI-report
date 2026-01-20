# Pentest AI Report System

A modern Penetration Testing Report generation system with AI integration and a beautiful UI.

## Features
-   **Authentication**: Secure Login and Registration.
-   **Dashboard**: Manage reports and view system stats.
-   **Report Generation**: Create PDF reports with vulnerabilities, automatically formatted using `pdfkit`.
-   **AI Integration**: Integrated with OpenAI and Ollama to assist in vulnerability analysis.
-   **Modern UI**: Glassmorphism design with responsive layout.

## Prerequisites
-   Node.js (v14+)
-   MongoDB (running on port 55000 as per configuration, or update `.env`)

## Installation
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Create a `.env` file (optional, defaults are set in code):
    ```env
    PORT=9000
    MONGO_URI=mongodb://localhost:55000/RAG_CYBER
    JWT_SECRET=your_jwt_secret
    OPENAI_API_KEY=your_openai_key
    ```
3.  Ensure you have the required fonts and images in `public/`:
    -   `THSarabunNew.ttf` (in root or public) - *Note: Code expects it in project root.*
    -   `public/bg.png`
    -   `public/width_800.png`

## Running the App
```bash
npm start
```
Access the application at `http://localhost:9000`.

## Directory Structure
-   `src/`: Backend source code.
    -   `models/`: Database schemas.
    -   `controllers/`: Logic for Auth, Reports, AI.
    -   `routes/`: API and View routes.
    -   `services/`: Helper services (PDF, AI).
-   `public/`: Frontend assets (HTML, CSS, JS).

## Usage
1.  Register a new account (or login).
2.  Use the Dashboard to generate new reports.
3.  Use the AI features to enhance vulnerability descriptions.
