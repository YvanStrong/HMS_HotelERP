# HMS_HotelERP

Hotel Management System / Hotel ERP built with a **Spring Boot backend** and a **Next.js frontend**.

---

## 📌 About the Project

HMS_HotelERP is a full-stack hotel management system designed to help hotels manage operations such as:

- Staff authentication
- Room management
- Hotel workspace dashboard
- Administration modules

The system is structured into:

- 🔧 Backend (Spring Boot API)
- 💻 Frontend (Next.js UI)

---

## 🚀 Features

- JWT Authentication (Secure login system)
- Role-based access control
- Room & hotel management modules
- REST API with Swagger documentation
- PostgreSQL database integration
- Modern UI with Next.js + Tailwind CSS

---

## 🛠️ Technologies Used

### Backend
- Java 17
- Spring Boot
- Spring Security
- Spring Data JPA
- PostgreSQL
- Flyway
- Swagger (OpenAPI)

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- React Query

---

## How to run Backend
-cd backend

-mvn clean install

-mvn spring-boot:run

## How to run FrontEnd
-cd frontend

-npm install

-npm run dev

## Deploying to a server

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for a beginner-friendly guide: one-domain setup with Nginx, split app/API URLs, JAR vs WAR, and `NEXT_PUBLIC_API_URL`.

## 📂 Project Structure

```bash
HMS_HotelERP/
├── backend/
├── frontend/
├── docs/
├── postman/
└── README.md

