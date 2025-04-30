# 🧑‍💼 Anulance - Freelance Marketplace Platform

Anulance is a freelance web application built with the **MEN stack (MongoDB, Express.js, Node.js)**. It allows clients to post jobs and freelancers to connect with them. It features real-time chat using **Socket.io**, session-based authentication, and plans for file upload support with **Multer**.

---

## 🚀 Features

- User signup/login system with hashed passwords
- Client and Freelancer dashboards
- Job posting & application system
- Real-time chat with Socket.io
- Session management stored in MongoDB
- Profile picture and file upload support (via Multer)
- Modular Pug templates for clean UI rendering

---

## 🛠️ Tech Stack

| Layer        | Tool                         |
|--------------|------------------------------|
| Frontend     | HTML + Pug templates          |
| Backend      | Node.js, Express.js           |
| Realtime     | Socket.io                     |
| Database     | MongoDB + Mongoose            |
| Sessions     | express-session + connect-mongo |
| File Uploads | Multer (for profile pictures, etc.) |
| Authentication | bcryptjs                    |

---

## 🔌 Installation

```bash
git clone https://github.com/yourusername/anulance.git
cd anulance
npm install
