# SwiftTransit Bus Reservation System

**Next-Generation Intercity Transit & Fleet Management Platform**  
*Enterprise Transportation Architecture, Automated Booking System & Java REST Backend*

---

## 📖 Project Overview
This repository contains the full-stack implementation of the **SwiftTransit Bus Reservation System**:
1. **Frontend Web Edition**: An interactive web application built with HTML5, Vanilla CSS3 (Strict Light Theme), and modern ES6+ JavaScript.
2. **Java Backend Engine**: A multi-threaded Java REST API & Object-Oriented Transit Service with native `busdata.ser` binary serialization and zero external runtime dependencies.

---

## 🛠️ Technology Stack & Compliance
- **Frontend**: HTML5 Semantic Architecture, Vanilla CSS3, ES6+ JavaScript
- **Backend**: Java 17+ / JDK 26 (`com.sun.net.httpserver.HttpServer`, `java.io.Serializable`)
- **Theme**: Pure **Light Mode** design (crisp whites, slate typography, royal blue accents, accessible contrast)
- **Security**: Cryptographic **SHA-256 password hashing**
- **Persistence**: 
  - Java Backend: Native binary serialization to `busdata.ser` with automated first-run bootstrap seeding.
  - Web Client: LocalStorage with automatic real-time sync when Java backend is connected.

---

## 📐 Architecture & Class Hierarchy
| Component / Class | Purpose in Application |
|---|---|
| **`User`** (`com.swifttransit.model.User`) | Passenger/admin profile with username, SHA-256 hashed password, full name, and role (`ADMIN` or `PASSENGER`). |
| **`Bus`** (`com.swifttransit.model.Bus`) | Bus entity containing ID, name, route (source & destination), departure time, fare, seat capacity (28 seats), and map of booked seats per travel date. |
| **`Booking`** (`com.swifttransit.model.Booking`) | Reservation record containing Booking ID (`ST-BK-...`), passenger info, seat numbers, name/age roster, total fare, status (`CONFIRMED` / `CANCELLED`), and refund receipt. |
| **`DataStore`** (`com.swifttransit.storage.DataStore`) | Manages `busdata.ser` object persistence. Auto-seeds default admin (`admin` / `admin123`) and 4 sample buses on first launch. |
| **`BusReservationService`** | Core business logic layer containing authentication, route search, booking rules, capacity enforcement, cancellation, and 90% refund calculations. |
| **`SwiftTransitServer`** | Multi-threaded Java HTTP server on `:8080` handling REST API endpoints with CORS and serving frontend assets. |
| **`MainUI` / `ApiClient`** | User interface controller managing interactive seat grid, live booking passes, and automatic fallback between Java REST API and in-browser mode. |

---

## 📋 Business Rules Enforcement (Section 3.5 & 3.6)
1. **Username & Password Security**:
   - Usernames must be 3–15 characters (letters, digits, underscores) and unique.
   - Passwords must be at least 6 characters and are stored strictly as **SHA-256 hashes**.
2. **Date Validation**:
   - Travel date follows `dd-MM-yyyy` format and rejects past dates.
3. **Seat Allocation & Limits**:
   - Seats are booked per travel date; duplicate seat bookings on the same date are rejected.
   - Maximum **6 seats** can be booked in a single reservation.
   - Total fare calculated dynamically: $\text{Total Fare} = \text{Fare per seat} \times \text{Number of seats}$.
4. **Cancellation & 90% Refund**:
   - When a ticket is cancelled, booked seats are instantly released back to available inventory.
   - **90% of the fare is refunded** (a 10% cancellation charge is retained).
   - Passengers can only cancel their own reservations.
5. **Bus Management Integrity**:
   - Administrators cannot delete any bus that has active (`CONFIRMED`) passenger bookings.
6. **First Run Initialization**:
   - Auto-creates Administrator (`admin` / `admin123`) and 4 initial bus routes across Maharashtra/Goa/Gujarat.

---

## 🚀 How to Run

### 1. Running the Java Backend & Web Server (Recommended)

#### On Windows:
Run the startup script:
```cmd
cd backend
run-backend.bat
```

#### On Linux / macOS:
```bash
cd backend
chmod +x run-backend.sh
./run-backend.sh
```

#### Or using Maven:
```bash
cd backend
mvn clean compile exec:java
```

Once running, open your browser:
```
http://localhost:8080
```
The status bar in the web app will display `Java Backend: Active (:8080)` and all bookings, routes, and accounts will persist directly to `busdata.ser`!

---

### 2. Running Frontend Directly (Standalone / GitHub Pages Mode)
You can also run the web edition independently or host it on GitHub Pages. It will seamlessly fall back to client-side storage:
```bash
python -m http.server 8080
```
Or open `index.html` directly in any web browser.

---

## 🔑 Default Credentials for Evaluation
- **Administrator**:
  - Username: `admin`
  - Password: `admin123`
- **Sample Passenger**:
  - Username: `rahul`
  - Password: `pass123`
- *New passenger accounts can also be registered instantly through the Sign In / Register dialog.*
