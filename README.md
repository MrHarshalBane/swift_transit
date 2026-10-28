# SwiftTransit Bus Reservation System (Web Edition)

**Next-Generation Intercity Transit & Fleet Management Platform**  
*Enterprise Transportation Architecture & Automated Booking System*

---

## 📖 Project Overview
This web application is a full-featured implementation of the **SwiftTransit Bus Reservation System**. It converts the core object-oriented architecture and business rules into an interactive web application built with **HTML5, Vanilla CSS3 (Strict Light Theme), and modern ES6+ JavaScript**.

---

## 🛠️ Technology Stack & Compliance
- **Core**: HTML5 Semantic Architecture, Vanilla CSS3, ES6+ JavaScript
- **Theme**: Pure **Light Mode** design (crisp whites, slate typography, royal blue accents, accessible contrast)
- **Security**: Cryptographic **SHA-256 password hashing** via Web Crypto API
- **Persistence**: LocalStorage mimicking persistent storage with automated first-run seeding

---

## 📐 Class Architecture Implemented
| Class | Purpose in Application |
|---|---|
| **`User`** | Holds passenger/admin profile with username, SHA-256 hashed password, full name, and role (`ADMIN` or `PASSENGER`). |
| **`Bus`** | Bus entity containing ID, name, route (source & destination), departure time, fare, seat capacity, and map of booked seats per travel date. |
| **`Booking`** | Reservation record containing Booking ID (`ST-BK-...`), passenger info, seat numbers, name/age roster, total fare, status (`CONFIRMED` / `CANCELLED`), and refund receipt. |
| **`DataStore`** | Simulates `busdata.ser` file persistence. Auto-seeds default admin (`admin` / `admin123`) and 4 sample buses on first launch. |
| **`BusReservationSystem`** | Business logic layer containing authentication, route search, booking rules, capacity enforcement, cancellation, and refund calculations. |
| **`MainUI`** | User interface controller managing interactive seat grid (with `[XX]` booked markers), passenger input generation, ticket boarding passes, and admin panel. |

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

## 🚀 How to Run the Website

### Option 1: Using Python HTTP Server (Recommended)
In the project directory, run:
```bash
python -m http.server 8080
```
Then open your browser and navigate to:
```
http://localhost:8080/index.html
```

### Option 2: Direct File Open
You can also directly double-click `index.html` to open it in Chrome, Edge, or Firefox.

---

## 🔑 Default Credentials for Evaluation
- **Administrator**:
  - Username: `admin`
  - Password: `admin123`
- **Sample Passenger**:
  - Username: `rahul`
  - Password: `pass123`
- *New passenger accounts can also be registered instantly through the Sign In / Register dialog.*
