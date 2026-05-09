# Staff Monitoring — Backend

NestJS REST API for the Staff Monitoring system. Handles authentication, user management, attendance tracking, file uploads, and role-based access control.

---

## Tech Stack

| Purpose     | Library                             |
| ----------- | ----------------------------------- |
| Framework   | NestJS (TypeScript)                 |
| Database    | MySQL 8                             |
| ORM         | TypeORM                             |
| Auth        | JWT + bcrypt                        |
| File Upload | Multer (local disk)                 |
| Validation  | class-validator + class-transformer |
| Scheduling  | @nestjs/schedule                    |

---

## Prerequisites

- Node.js 18+
- MySQL 8 running and accessible
- `.env` file configured (see below)

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev
```

API runs at `http://localhost:3000/api`

### Environment Variables

Create a `.env` file in the project root:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=yourpassword
DB_NAME=monitoring_app
JWT_SECRET=your_jwt_secret_here
```

> `synchronize: true` is enabled in development — TypeORM will auto-create and update tables on startup. Disable this in production.

---

## Project Structure

```
src/
├── auth/                  # JWT strategy, guards, login endpoint
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   ├── roles.decorator.ts
│   └── dto/
├── users/                 # User CRUD, password management
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── user.entity.ts
│   └── dto/
├── attendance/            # Clock in/out, breaks, approvals, history
│   ├── attendance.controller.ts
│   ├── attendance.service.ts
│   ├── attendance.entity.ts
│   └── dto/
├── upload/                # Multer file upload (temp → approved)
├── common/
│   └── enums/             # role, work-status, employment-status, approval-status
├── app.module.ts
├── main.ts
└── seed.ts
uploads/
├── temp/                  # Pending proof photos
└── approved/              # Approved proof photos
```

---

## API Endpoints

### Auth

| Method | Endpoint          | Access | Description                 |
| ------ | ----------------- | ------ | --------------------------- |
| POST   | `/api/auth/login` | Public | Login, returns JWT + user   |
| GET    | `/api/auth/me`    | All    | Get current user from token |

### Users

| Method | Endpoint                         | Access     | Description            |
| ------ | -------------------------------- | ---------- | ---------------------- |
| GET    | `/api/users`                     | HRD, Admin | List users (paginated) |
| POST   | `/api/users`                     | HRD, Admin | Create user            |
| PATCH  | `/api/users/:id`                 | HRD, Admin | Update user            |
| PATCH  | `/api/users/:id/change-password` | HRD, Admin | Change password        |
| DELETE | `/api/users/:id`                 | Admin only | Delete user            |

### Attendance

| Method | Endpoint                           | Access     | Description                    |
| ------ | ---------------------------------- | ---------- | ------------------------------ |
| POST   | `/api/attendance/clock-in`         | Staff, HRD | Clock in with photo            |
| PATCH  | `/api/attendance/clock-out`        | Staff, HRD | Clock out                      |
| PATCH  | `/api/attendance/start-break`      | Staff, HRD | Start break                    |
| PATCH  | `/api/attendance/end-break`        | Staff, HRD | End break                      |
| GET    | `/api/attendance/today/me`         | Staff, HRD | Today's own attendance         |
| GET    | `/api/attendance/team`             | All        | All users' current work status |
| GET    | `/api/attendance/pending`          | HRD, Admin | Pending clock-in approvals     |
| PATCH  | `/api/attendance/:id/approve`      | HRD        | Approve clock-in               |
| PATCH  | `/api/attendance/:id/deny`         | HRD        | Deny clock-in                  |
| GET    | `/api/attendance/approval-history` | HRD, Admin | Approval history (paginated)   |
| GET    | `/api/attendance/history`          | All        | Attendance history (paginated) |
| GET    | `/api/attendance/my-stats`         | Staff, HRD | Personal attendance stats      |

### Upload

| Method | Endpoint      | Access     | Description                                   |
| ------ | ------------- | ---------- | --------------------------------------------- |
| POST   | `/api/upload` | Staff, HRD | Upload proof photo → saves to `/uploads/temp` |

Static files served at `/uploads/temp/:filename` and `/uploads/approved/:filename`.

---

## Entities

### User

| Field            | Type   | Notes                                                          |
| ---------------- | ------ | -------------------------------------------------------------- |
| id               | uuid   | Primary key                                                    |
| name             | string |                                                                |
| email            | string | Unique                                                         |
| password         | string | bcrypt hashed                                                  |
| role             | enum   | `staff`, `hrd`, `admin`                                        |
| workStatus       | enum   | `working`, `on break`, `off duty`, `pending`, `photo revision` |
| employmentStatus | enum   | `employed`, `on leave`, `terminated`, `resigned`               |

### Attendance

| Field               | Type      | Notes                                  |
| ------------------- | --------- | -------------------------------------- |
| id                  | uuid      | Primary key                            |
| userId              | uuid      | FK → User                              |
| date                | date      | Working date                           |
| clockInTime         | timestamp |                                        |
| clockOutTime        | timestamp | Nullable                               |
| photoUrl            | string    | Path to proof photo                    |
| approvalStatus      | enum      | `pending`, `approved`, `denied`        |
| approvedBy          | uuid      | Nullable, FK → User (HRD)              |
| totalBreakMinutes   | int       | Accumulated break time                 |
| totalWorkingMinutes | int       | Total shift duration                   |
| isOnBreak           | boolean   |                                        |
| isInvalid           | boolean   | True if shift expired without approval |

---

## Clock-in Flow

```
Staff → clock-in → photo saved to /uploads/temp → status: pending
  → HRD approves → photo moved to /uploads/approved → status: working
  → HRD denies  → photo deleted from /uploads/temp → status: photo revision

HRD → clock-in → photo saved to /uploads/temp → auto approved → status: working
```

A scheduled job runs every minute. If a pending attendance record reaches 8 hours without approval, it is marked `isInvalid: true` and the shift is closed automatically.

---

## Seeding

```bash
npx ts-node -r tsconfig-paths/register src/seed.ts
```

Seeds: 1 admin, 3 HRD, 20 staff, and 30 days of attendance history. Re-running the seed is safe — existing users are updated (upsert by email), attendance is cleared and reseeded.

**Default credentials:**

| Role  | Email              | Password |
| ----- | ------------------ | -------- |
| Admin | admin@company.com  | admin123 |
| HRD   | hrd1@company.com   | hrd123   |
| Staff | staff1@company.com | staff123 |

---

## Running with Docker

If you want to run the full stack (frontend + backend + database) together, create a `docker-compose.yml` in your root folder with both repos cloned alongside each other:

```
root/
├── monitoring-app-react/     ← this repo
├── monitoring-app-nest/      ← backend repo
└── docker-compose.yml        ← create this
```

```yaml
services:
  frontend:
    build:
      context: ./monitoring-app-react
    container_name: monitoring_frontend
    ports:
      - '5173:5173'
    volumes:
      - ./monitoring-app-react:/app
      - /app/node_modules
    command: npm run dev -- --host
    environment:
      CHOKIDAR_USEPOLLING: true
      WATCHPACK_POLLING: true
    depends_on:
      - backend

  backend:
    build:
      context: ./monitoring-app-nest
    container_name: monitoring_backend
    ports:
      - '3000:3000'
    volumes:
      - ./monitoring-app-nest:/app
      - ./monitoring-app-nest/uploads:/app/uploads
      - /app/node_modules
    command: npm run start:dev
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USERNAME: root
      DB_PASSWORD: yourpassword
      DB_NAME: monitoring_app
      JWT_SECRET: your_jwt_secret_here
      CHOKIDAR_USEPOLLING: true
      WATCHPACK_POLLING: true
    depends_on:
      - mysql

  mysql:
    image: mysql:8.0
    container_name: monitoring_mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: yourpassword
      MYSQL_DATABASE: monitoring_app
    ports:
      - '3306:3306'
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

Then run:

```bash
docker-compose up -d --build
```

The `uploads/` folder is mounted as a volume so uploaded files persist across container restarts:

```yaml
volumes:
  - ./monitoring-app-nest/uploads:/app/uploads
```

---

## Credits

Built by **[Mochammad Naufal Ihza Syahzada]** with AI assistance from [Claude](https://claude.ai) and [ChatGPT](https://chatgpt.com).