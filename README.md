# Sync-Mate-Extension 🎬

[![Project Status](https://img.shields.io/badge/Status-Development-yellow)]()
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6-%23F7DF1E?logo=javascript)](https://www.javascript.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-%233178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-%2361DAFB?logo=react)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-%2338B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](https://opensource.org/licenses/MIT)

A browser extension that enables synchronized video playback across platforms like YouTube, Rezka, and your own website.
Designed for seamless group viewing experiences.

> ⚠️ Project is currently under development.

---

## ✨ Core Features

* **Cross-Platform Sync**: Synchronize video playback across YouTube, Rezka, and your website.
* **Real-Time Control**: Pause, play, seek, and adjust volume for all viewers simultaneously.
* **User-Friendly Interface**: Minimalistic design for effortless control.
* **FastAPI Backend**: Handles synchronization logic and user sessions.

---

## 🧰 Tech Stack

* **Frontend**: TypeScript, Vite, WebExtension APIs
* **Backend**: FastAPI, WebSockets
* **Testing**: Vitest
* **CI/CD**: GitHub Actions

---

## 🚀 Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Zebaro24/Sync-Mate-Extension.git
   cd Sync-Mate-Extension
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build the extension**:

   ```bash
   npm run build
   ```

4. **Load the extension into your browser**:

    * For Chrome: Navigate to `chrome://extensions/`, enable "Developer mode", and click "Load unpacked". Select the
      folder extracted from the archive in `.output`.
    * For Firefox: Navigate to `about:debugging`, click "This Firefox", then "Load Temporary Add-on". Select the folder
      extracted from the archive in `.output`.

---

## ⚙️ Usage

1. Install the extension in your browser.
2. Navigate to a supported video platform (YouTube, Rezka, or your website).
3. Click the extension icon to start synchronized playback.
4. Share the session link with friends to join the synchronized viewing experience.

---

## 🧪 Development

1. **Start the development server**:

   ```bash
   npm run dev
   ```

2. This will launch a local server and open the extension in your default browser for testing.

---

## 📄 License

This project is licensed under the MIT License.

---

## 📬 Contact

- **Developer**: Denys Shcherbatyi
- **Email**: zebaro.work@gmail.com
