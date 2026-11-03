# SwiftTransit Java Backend

**Enterprise Java REST API & Object-Oriented Transit Engine**  
*Built with Modern Java (JDK 17+) & Zero External Dependencies (`com.sun.net.httpserver`)*

---

## 🏛️ Architecture Overview

The SwiftTransit Java backend implements the complete object-oriented business logic and persistence layer according to Section 3.4 & 3.5 specifications:

- **`User`** (`com.swifttransit.model.User`): User profile handling authentication, role enforcement (`ADMIN` / `PASSENGER`), and SHA-256 hashed password verification.
- **`Bus`** (`com.swifttransit.model.Bus`): Route entity containing identifier, name, origin, destination, departure time, per-seat fare, seat capacity (28 seats), and synchronized thread-safe booked seat maps by travel date (`dd-MM-yyyy`).
- **`Booking`** (`com.swifttransit.model.Booking`): Reservation ledger managing ticket IDs (`ST-BK-YYYYMMDD-XXXX`), passenger roster, seat reservations, fare calculation, confirmed/cancelled lifecycle, and 90% refund receipts.
- **`DataStore`** (`com.swifttransit.storage.DataStore`): Native Java binary serialization engine saving directly to `busdata.ser` with automated first-run bootstrap seeding (Admin `admin` / `admin123` and 4 regional routes).
- **`BusReservationService`** (`com.swifttransit.service.BusReservationService`): Business rule enforcement:
  - 3–15 char unique usernames, min 6 char passwords with SHA-256 hashing.
  - Date validation (strictly rejects past dates).
  - Max 6 seats per booking transaction.
  - 90% cancellation refund policy (10% platform cancellation charge retained).
  - Bus removal safeguard (cannot delete buses with active confirmed bookings).
- **`SwiftTransitServer`** (`com.swifttransit.server.SwiftTransitServer`): Multi-threaded HTTP server providing JSON REST endpoints and serving frontend assets with full CORS support.

---

## 🚀 Quick Start

### Option 1: Direct Startup (No Maven Required)

#### Windows
Double click `run-backend.bat` or run:
```cmd
.\run-backend.bat
```

#### Linux / macOS
```bash
chmod +x run-backend.sh
./run-backend.sh
```

### Option 2: Using Maven
```bash
mvn clean compile exec:java
```

The server will be reachable at:
- Web Application: **http://localhost:8080**
- Health Probe: **http://localhost:8080/api/health**

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Healthcheck and server engine diagnostics |
| `POST` | `/api/auth/register` | Register a new passenger account |
| `POST` | `/api/auth/login` | Authenticate existing user |
| `GET` | `/api/buses?source=&destination=&date=` | Search routes or list all buses |
| `POST` | `/api/buses` | Add new bus route (Administrator) |
| `DELETE` | `/api/buses?id=BUS-XXX` | Remove bus route (rejected if active bookings exist) |
| `GET` | `/api/bookings?username=...` | Retrieve reservations for a user or all bookings |
| `POST` | `/api/bookings` | Book up to 6 seats with passenger roster |
| `POST` | `/api/bookings/cancel` | Cancel booking with 90% refund |
