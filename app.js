/**
 * SWIFTTRANSIT MOBILITY NETWORKS
 * Bus Reservation System - Client Application & Business Engine
 *
 * Implements Class Hierarchy & Architecture from Section 3.4 & 3.5:
 *  - User (Account, SHA-256 hashed password, Role: ADMIN or PASSENGER)
 *  - Bus (ID, Name, Route, Departure Time, Fare, Seats, Booked Seats per Date)
 *  - Booking (Booking ID, Passenger, Bus, Date, Seats, Fare, Status CONFIRMED/CANCELLED)
 *  - DataStore (Simulates busdata.ser with LocalStorage persistence & auto-seed)
 *  - BusReservationSystem (Core business rules, validations, refund calculations)
 *  - Main / UI (Interactive seat map, ticket generator, passenger forms, admin console)
 */

// ============================================================================
// 1. CRYPTO UTILITY: SHA-256 PASSWORD HASHING (Rule 3.5: SHA-256 hashes)
// ============================================================================
async function sha256(str) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Fallback simple 256-bit representation if SubtleCrypto is restricted
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'sha256_fallback_' + Math.abs(hash).toString(16);
  }
}

// ============================================================================
// 2. DATE UTILITIES (Rule 3.5: dd-MM-yyyy format, cannot be in past)
// ============================================================================
const DateUtils = {
  // Convert standard YYYY-MM-DD (from input[type=date]) to dd-MM-yyyy
  toDisplayDate(isoString) {
    if (!isoString) return '';
    const parts = isoString.split('-');
    if (parts.length !== 3) return isoString;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  },

  // Convert dd-MM-yyyy back to YYYY-MM-DD
  toIsoDate(displayString) {
    if (!displayString) return '';
    const parts = displayString.split('-');
    if (parts.length !== 3) return displayString;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  },

  // Check if dd-MM-yyyy date is in the past
  isPastDate(displayString) {
    const iso = this.toIsoDate(displayString);
    const target = new Date(iso + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return target < today;
  },

  // Format today as YYYY-MM-DD
  todayIso() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  // Format today as dd-MM-yyyy
  todayDisplay() {
    return this.toDisplayDate(this.todayIso());
  }
};

// ============================================================================
// 3. MODELS (Section 3.4 Class Design)
// ============================================================================

class User {
  constructor(username, passwordHash, fullName, role = 'PASSENGER') {
    this.username = username;
    this.passwordHash = passwordHash;
    this.fullName = fullName;
    this.role = role; // 'ADMIN' or 'PASSENGER'
  }
}

class Bus {
  constructor(id, name, source, destination, departureTime, fare, totalSeats = 28, bookedSeatsByDate = {}) {
    this.id = id;
    this.name = name;
    this.source = source;
    this.destination = destination;
    this.departureTime = departureTime;
    this.fare = Number(fare);
    this.totalSeats = Number(totalSeats);
    // Map of travelDate (dd-MM-yyyy) -> Array of seat numbers [1, 2, 5, ...]
    this.bookedSeatsByDate = bookedSeatsByDate;
  }

  // Get booked seats for a specific travel date
  getBookedSeats(travelDate) {
    return this.bookedSeatsByDate[travelDate] || [];
  }

  // Count available seats for a specific travel date
  getAvailableSeatCount(travelDate) {
    const booked = this.getBookedSeats(travelDate);
    return Math.max(0, this.totalSeats - booked.length);
  }

  // Mark seats as booked for a specific date
  markSeatsBooked(travelDate, seatNumbers) {
    if (!this.bookedSeatsByDate[travelDate]) {
      this.bookedSeatsByDate[travelDate] = [];
    }
    const current = new Set(this.bookedSeatsByDate[travelDate]);
    seatNumbers.forEach(s => current.add(s));
    this.bookedSeatsByDate[travelDate] = Array.from(current).sort((a, b) => a - b);
  }

  // Release seats upon cancellation
  releaseSeats(travelDate, seatNumbers) {
    if (!this.bookedSeatsByDate[travelDate]) return;
    const toRemove = new Set(seatNumbers);
    this.bookedSeatsByDate[travelDate] = this.bookedSeatsByDate[travelDate].filter(s => !toRemove.has(s));
  }
}

class Booking {
  constructor(bookingId, passengerUsername, passengerFullName, busId, busName, source, destination, travelDate, departureTime, seats, passengers, farePerSeat, status = 'CONFIRMED', refundAmount = 0, createdAt = new Date().toISOString()) {
    this.bookingId = bookingId;
    this.passengerUsername = passengerUsername;
    this.passengerFullName = passengerFullName;
    this.busId = busId;
    this.busName = busName;
    this.source = source;
    this.destination = destination;
    this.travelDate = travelDate; // dd-MM-yyyy
    this.departureTime = departureTime;
    this.seats = seats; // e.g. [1, 2]
    this.passengers = passengers; // [{ seatNumber: 1, name: 'Rahul', age: 24 }]
    this.farePerSeat = farePerSeat;
    this.totalFare = farePerSeat * seats.length; // Rule 3.5: Total fare = fare per seat * number of seats
    this.status = status; // 'CONFIRMED' or 'CANCELLED'
    this.refundAmount = refundAmount; // 90% when cancelled
    this.createdAt = createdAt;
  }
}

// ============================================================================
// 4. DATASTORE (Simulates busdata.ser with LocalStorage persistence)
// ============================================================================
class DataStore {
  constructor() {
    this.STORAGE_KEY = 'swifttransit_busdata_v1';
    this.users = [];
    this.buses = [];
    this.bookings = [];
    this.init();
  }

  init() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.users = parsed.users.map(u => new User(u.username, u.passwordHash, u.fullName, u.role));
        this.buses = parsed.buses.map(b => new Bus(b.id, b.name, b.source, b.destination, b.departureTime, b.fare, b.totalSeats, b.bookedSeatsByDate));
        this.bookings = parsed.bookings.map(bk => new Booking(
          bk.bookingId, bk.passengerUsername, bk.passengerFullName, bk.busId, bk.busName,
          bk.source, bk.destination, bk.travelDate, bk.departureTime, bk.seats,
          bk.passengers, bk.farePerSeat, bk.status, bk.refundAmount, bk.createdAt
        ));
        return;
      } catch (e) {
        console.warn('Failed to parse existing bus data, re-seeding...', e);
      }
    }
    this.seedDefaultData();
  }

  // Rule 3.5: On the first run, default administrator (admin / admin123) and 4 sample buses created
  seedDefaultData() {
    // SHA-256 for admin123 is 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
    // SHA-256 for pass123 is b06b8da468e228581775704bb8427f71cb32298e8bf9ad4914c810d7a969b914
    this.users = [
      new User('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'System Administrator', 'ADMIN'),
      new User('rahul', 'b06b8da468e228581775704bb8427f71cb32298e8bf9ad4914c810d7a969b914', 'Rahul Sharma', 'PASSENGER')
    ];

    const todayDisplay = DateUtils.todayDisplay();

    this.buses = [
      new Bus('BUS-101', 'Shivneri Volvo Super AC', 'Mumbai', 'Pune', '06:00 AM', 450, 28, {
        [todayDisplay]: [1, 2, 7, 8] // Pre-booked seats for realism
      }),
      new Bus('BUS-102', 'Maharaja Sleeper Coach (2+1)', 'Mumbai', 'Goa', '08:30 PM', 1200, 24, {
        [todayDisplay]: [3, 4]
      }),
      new Bus('BUS-103', 'Deccan Express Semi-Luxury', 'Pune', 'Nashik', '07:15 AM', 350, 28, {}),
      new Bus('BUS-104', 'Gujarat Express AC Multi-Axle', 'Mumbai', 'Ahmedabad', '10:00 PM', 850, 28, {})
    ];

    // Initial demo confirmed booking for Rahul
    this.bookings = [
      new Booking(
        'ST-BK-1001',
        'rahul',
        'Rahul Sharma',
        'BUS-101',
        'Shivneri Volvo Super AC',
        'Mumbai',
        'Pune',
        todayDisplay,
        '06:00 AM',
        [1, 2],
        [
          { seatNumber: 1, name: 'Rahul Sharma', age: 24 },
          { seatNumber: 2, name: 'Priya Sharma', age: 22 }
        ],
        450,
        'CONFIRMED',
        0
      )
    ];

    this.save();
  }

  save() {
    const payload = {
      users: this.users,
      buses: this.buses,
      bookings: this.bookings
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
  }
}

// ============================================================================
// 5. BUS RESERVATION SYSTEM (Business Logic & Validation Rules 3.5 & 3.6)
// ============================================================================
class BusReservationSystem {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.currentUser = null;
    this.loadSession();
  }

  loadSession() {
    const sessionUser = sessionStorage.getItem('swifttransit_session_user');
    if (sessionUser) {
      try {
        const u = JSON.parse(sessionUser);
        this.currentUser = this.dataStore.users.find(item => item.username === u.username) || null;
      } catch (e) {
        this.currentUser = null;
      }
    }
  }

  saveSession(user) {
    this.currentUser = user;
    if (user) {
      sessionStorage.setItem('swifttransit_session_user', JSON.stringify({ username: user.username, role: user.role }));
    } else {
      sessionStorage.removeItem('swifttransit_session_user');
    }
  }

  // Rule 3.5: Usernames must be 3-15 letters, digits or underscores and must be unique;
  // passwords must have at least 6 characters and are stored as SHA-256 hashes.
  async registerUser(username, password, fullName) {
    username = username.trim();
    fullName = fullName.trim();

    const usernameRegex = /^[a-zA-Z0-9_]{3,15}$/;
    if (!usernameRegex.test(username)) {
      throw new Error('Username must be 3–15 characters (letters, digits, or underscores only).');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must have at least 6 characters.');
    }

    if (!fullName) {
      throw new Error('Full name is required.');
    }

    const exists = this.dataStore.users.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      throw new Error(`Username "${username}" is already taken. Please choose another.`);
    }

    const passwordHash = await sha256(password);
    const newUser = new User(username, passwordHash, fullName, 'PASSENGER');
    this.dataStore.users.push(newUser);
    this.dataStore.save();

    this.saveSession(newUser);
    return newUser;
  }

  // Authentication
  async loginUser(username, password) {
    username = username.trim();
    if (!username || !password) {
      throw new Error('Please enter both username and password.');
    }

    const user = this.dataStore.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      throw new Error('User not found. Please check your username or register.');
    }

    const hash = await sha256(password);
    if (user.passwordHash !== hash) {
      throw new Error('Invalid credentials. Password did not match.');
    }

    this.saveSession(user);
    return user;
  }

  logout() {
    this.saveSession(null);
  }

  // Searching buses: Rule 3.6 & 3.5 (Travel date cannot be in past, dd-MM-yyyy format)
  searchBuses(source, destination, travelDate) {
    if (!travelDate) {
      throw new Error('Please select a travel date.');
    }

    if (DateUtils.isPastDate(travelDate)) {
      throw new Error('Travel date cannot be in the past (Rule 3.5). Please select today or a future date.');
    }

    return this.dataStore.buses.filter(bus => {
      const matchSource = !source || bus.source.toLowerCase() === source.toLowerCase();
      const matchDest = !destination || bus.destination.toLowerCase() === destination.toLowerCase();
      return matchSource && matchDest;
    });
  }

  // Rule 3.5:
  // - Seats booked per travel date; a seat that is already booked cannot be booked again
  // - At most 6 seats can be booked in one booking
  // - Total fare = fare per seat * number of seats
  bookSeats(busId, travelDate, selectedSeats, passengerList) {
    if (!this.currentUser) {
      throw new Error('You must be logged in to book seats.');
    }

    if (!travelDate || DateUtils.isPastDate(travelDate)) {
      throw new Error('Invalid travel date. Cannot book tickets for past dates.');
    }

    const bus = this.dataStore.buses.find(b => b.id === busId);
    if (!bus) {
      throw new Error('Bus route not found.');
    }

    if (!selectedSeats || selectedSeats.length === 0) {
      throw new Error('Please select at least 1 seat.');
    }

    if (selectedSeats.length > 6) {
      throw new Error('Maximum 6 seats can be booked in one booking (Rule 3.5).');
    }

    const currentlyBooked = new Set(bus.getBookedSeats(travelDate));
    for (const seat of selectedSeats) {
      if (currentlyBooked.has(seat)) {
        throw new Error(`Seat #${seat} has already been booked by another passenger for this date.`);
      }
    }

    if (!passengerList || passengerList.length !== selectedSeats.length) {
      throw new Error('Please provide passenger details (name & age) for every selected seat.');
    }

    for (const p of passengerList) {
      if (!p.name || !p.name.trim()) {
        throw new Error(`Please provide a valid name for seat #${p.seatNumber}.`);
      }
      if (!p.age || p.age < 1 || p.age > 120) {
        throw new Error(`Please enter a valid age (1-120) for seat #${p.seatNumber}.`);
      }
    }

    // Generate Booking ID: ST-BK-YYYYMMDD-RANDOM
    const dateCode = travelDate.replace(/-/g, '');
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const bookingId = `ST-BK-${dateCode}-${randCode}`;

    const newBooking = new Booking(
      bookingId,
      this.currentUser.username,
      this.currentUser.fullName,
      bus.id,
      bus.name,
      bus.source,
      bus.destination,
      travelDate,
      bus.departureTime,
      [...selectedSeats].sort((a, b) => a - b),
      passengerList,
      bus.fare,
      'CONFIRMED',
      0
    );

    // Mark seats in Bus
    bus.markSeatsBooked(travelDate, selectedSeats);

    // Save Booking
    this.dataStore.bookings.unshift(newBooking);
    this.dataStore.save();

    return newBooking;
  }

  // Rule 3.5:
  // - On cancellation the seats are released and 90% of the fare is refunded (a 10% cancellation charge is kept).
  // - A passenger can cancel only his or her own bookings.
  cancelBooking(bookingId) {
    if (!this.currentUser) {
      throw new Error('You must be logged in to cancel a booking.');
    }

    const booking = this.dataStore.bookings.find(b => b.bookingId === bookingId);
    if (!booking) {
      throw new Error('Booking not found.');
    }

    // Passenger can cancel only their own; Admin can manage all
    if (this.currentUser.role !== 'ADMIN' && booking.passengerUsername !== this.currentUser.username) {
      throw new Error('Permission denied. Passengers can cancel only their own bookings.');
    }

    if (booking.status === 'CANCELLED') {
      throw new Error('This booking has already been cancelled.');
    }

    const bus = this.dataStore.buses.find(b => b.id === booking.busId);
    if (bus) {
      bus.releaseSeats(booking.travelDate, booking.seats);
    }

    // Calculate 90% refund and 10% charge
    const refundAmount = Math.round(booking.totalFare * 0.9);
    booking.status = 'CANCELLED';
    booking.refundAmount = refundAmount;

    this.dataStore.save();

    return {
      bookingId: booking.bookingId,
      totalFare: booking.totalFare,
      refundAmount: refundAmount,
      cancellationCharge: booking.totalFare - refundAmount
    };
  }

  // Rule 3.5: Administrator Module:
  // - adding a new bus
  // - removing a bus that has NO active bookings
  addBus(busData) {
    if (!this.currentUser || this.currentUser.role !== 'ADMIN') {
      throw new Error('Only administrators can add buses.');
    }

    const id = busData.id.trim().toUpperCase();
    if (this.dataStore.buses.some(b => b.id === id)) {
      throw new Error(`A bus with ID "${id}" already exists.`);
    }

    const newBus = new Bus(
      id,
      busData.name.trim(),
      busData.source.trim(),
      busData.destination.trim(),
      busData.departureTime.trim(),
      Number(busData.fare),
      Number(busData.totalSeats) || 28,
      {}
    );

    this.dataStore.buses.push(newBus);
    this.dataStore.save();
    return newBus;
  }

  // Rule 3.5: A bus that has active bookings cannot be removed by the administrator.
  removeBus(busId) {
    if (!this.currentUser || this.currentUser.role !== 'ADMIN') {
      throw new Error('Only administrators can remove buses.');
    }

    const hasActiveBookings = this.dataStore.bookings.some(
      b => b.busId === busId && b.status === 'CONFIRMED'
    );

    if (hasActiveBookings) {
      throw new Error(
        `Cannot remove bus ${busId}: Under Business Rule 3.5, a bus that has active passenger bookings cannot be removed.`
      );
    }

    const index = this.dataStore.buses.findIndex(b => b.id === busId);
    if (index === -1) {
      throw new Error(`Bus ${busId} not found.`);
    }

    this.dataStore.buses.splice(index, 1);
    this.dataStore.save();
    return true;
  }

  // Get active user bookings
  getCurrentUserBookings() {
    if (!this.currentUser) return [];
    if (this.currentUser.role === 'ADMIN') {
      return this.dataStore.bookings;
    }
    return this.dataStore.bookings.filter(b => b.passengerUsername === this.currentUser.username);
  }

  // Reset to default sample state
  resetSystemData() {
    this.dataStore.seedDefaultData();
    this.saveSession(this.dataStore.users[0]); // Keep admin logged in
  }
}

// ============================================================================
// 6. MAIN CONTROLLER & USER INTERFACE (Section 3.4 & 3.6 Console / GUI)
// ============================================================================
class MainUI {
  constructor() {
    this.dataStore = new DataStore();
    this.system = new BusReservationSystem(this.dataStore);

    // Transient UI State
    this.currentSearch = {
      source: 'Mumbai',
      destination: 'Pune',
      dateDisplay: DateUtils.todayDisplay()
    };
    this.selectedBusForBooking = null;
    this.selectedSeats = new Set();
    this.pendingCancelBookingId = null;

    this.initDOMElements();
    this.bindEvents();
    this.initDefaultValues();
    this.render();
  }

  initDOMElements() {
    // Navigation
    this.navAuth = document.getElementById('navAuth');
    this.navHomeBtn = document.getElementById('navHomeBtn');
    this.navBusesBtn = document.getElementById('navBusesBtn');
    this.navMyBookingsBtn = document.getElementById('navMyBookingsBtn');
    this.navAdminBtn = document.getElementById('navAdminBtn');
    this.bookingCounter = document.getElementById('bookingCounter');
    this.brandLogoBtn = document.getElementById('brandLogoBtn');

    // Sections
    this.heroSection = document.getElementById('heroSection');
    this.busResultsSection = document.getElementById('busResultsSection');
    this.myBookingsSection = document.getElementById('myBookingsSection');
    this.adminSection = document.getElementById('adminSection');

    // Search Controls
    this.busSearchForm = document.getElementById('busSearchForm');
    this.searchSource = document.getElementById('searchSource');
    this.searchDestination = document.getElementById('searchDestination');
    this.searchDate = document.getElementById('searchDate');
    this.formattedDatePreview = document.getElementById('formattedDatePreview');
    this.swapRouteBtn = document.getElementById('swapRouteBtn');
    this.showAllBusesBtn = document.getElementById('showAllBusesBtn');
    this.busCardsGrid = document.getElementById('busCardsGrid');
    this.noBusesFound = document.getElementById('noBusesFound');
    this.clearSearchFiltersBtn = document.getElementById('clearSearchFiltersBtn');
    this.resultsTitle = document.getElementById('resultsTitle');
    this.resultsSubtitle = document.getElementById('resultsSubtitle');

    // Bookings View
    this.myBookingsList = document.getElementById('myBookingsList');
    this.noBookingsState = document.getElementById('noBookingsState');
    this.bookFirstTicketBtn = document.getElementById('bookFirstTicketBtn');
    this.refreshBookingsBtn = document.getElementById('refreshBookingsBtn');

    // Admin Elements
    this.kpiTotalBuses = document.getElementById('kpiTotalBuses');
    this.kpiActiveBookings = document.getElementById('kpiActiveBookings');
    this.kpiTotalUsers = document.getElementById('kpiTotalUsers');
    this.kpiTotalRevenue = document.getElementById('kpiTotalRevenue');
    this.adminBusTableBody = document.getElementById('adminBusTableBody');
    this.adminBookingsTableBody = document.getElementById('adminBookingsTableBody');
    this.tabFleetBtn = document.getElementById('tabFleetBtn');
    this.tabAllBookingsBtn = document.getElementById('tabAllBookingsBtn');
    this.tabSystemInfoBtn = document.getElementById('tabSystemInfoBtn');
    this.paneFleet = document.getElementById('paneFleet');
    this.paneAllBookings = document.getElementById('paneAllBookings');
    this.paneSystemInfo = document.getElementById('paneSystemInfo');
    this.openAddBusModalBtn = document.getElementById('openAddBusModalBtn');
    this.resetSystemDataBtn = document.getElementById('resetSystemDataBtn');

    // Modals
    this.authModal = document.getElementById('authModal');
    this.openLoginBtn = document.getElementById('openLoginBtn');
    this.closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    this.tabLoginBtn = document.getElementById('tabLoginBtn');
    this.tabRegisterBtn = document.getElementById('tabRegisterBtn');
    this.loginForm = document.getElementById('loginForm');
    this.registerForm = document.getElementById('registerForm');
    this.fillAdminDemoBtn = document.getElementById('fillAdminDemoBtn');
    this.fillPassengerDemoBtn = document.getElementById('fillPassengerDemoBtn');

    // Booking / Seat Selection Modal
    this.bookingModal = document.getElementById('bookingModal');
    this.closeBookingModalBtn = document.getElementById('closeBookingModalBtn');
    this.bookingModalTitle = document.getElementById('bookingModalTitle');
    this.bookingModalSubtitle = document.getElementById('bookingModalSubtitle');
    this.modalBusIdBadge = document.getElementById('modalBusIdBadge');
    this.busSeatsWrapper = document.getElementById('busSeatsWrapper');
    this.passengerInputsContainer = document.getElementById('passengerInputsContainer');
    this.emptyPassengerHint = document.getElementById('emptyPassengerHint');
    this.selectedSeatsCount = document.getElementById('selectedSeatsCount');
    this.farePerSeatDisplay = document.getElementById('farePerSeatDisplay');
    this.fareSeatCountDisplay = document.getElementById('fareSeatCountDisplay');
    this.fareSeatsListDisplay = document.getElementById('fareSeatsListDisplay');
    this.fareTotalDisplay = document.getElementById('fareTotalDisplay');
    this.confirmBookingBtn = document.getElementById('confirmBookingBtn');
    this.confirmBookingForm = document.getElementById('confirmBookingForm');

    // Ticket Modal
    this.ticketModal = document.getElementById('ticketModal');
    this.closeTicketModalBtn = document.getElementById('closeTicketModalBtn');
    this.closeTicketBottomBtn = document.getElementById('closeTicketBottomBtn');
    this.printTicketBtn = document.getElementById('printTicketBtn');

    // Add Bus Modal
    this.addBusModal = document.getElementById('addBusModal');
    this.closeAddBusModalBtn = document.getElementById('closeAddBusModalBtn');
    this.addBusForm = document.getElementById('addBusForm');

    // Cancel Modal
    this.cancelConfirmModal = document.getElementById('cancelConfirmModal');
    this.closeCancelModalBtn = document.getElementById('closeCancelModalBtn');
    this.abortCancelBtn = document.getElementById('abortCancelBtn');
    this.executeCancelBtn = document.getElementById('executeCancelBtn');
    this.cancelModalBookingId = document.getElementById('cancelModalBookingId');
    this.cancelOriginalFare = document.getElementById('cancelOriginalFare');
    this.cancelFeeDisplay = document.getElementById('cancelFeeDisplay');
    this.cancelRefundDisplay = document.getElementById('cancelRefundDisplay');

    // Toasts
    this.toastContainer = document.getElementById('toastContainer');
  }

  initDefaultValues() {
    // Set search date default to today in ISO and preview dd-MM-yyyy
    const todayIso = DateUtils.todayIso();
    this.searchDate.value = todayIso;
    this.searchDate.min = todayIso; // Prevent picking past dates in HTML5 datepicker
    this.updateDateDisplayPreview();
  }

  updateDateDisplayPreview() {
    const val = this.searchDate.value;
    if (val) {
      const display = DateUtils.toDisplayDate(val);
      this.formattedDatePreview.textContent = display;
      this.currentSearch.dateDisplay = display;
    } else {
      this.formattedDatePreview.textContent = 'dd-MM-yyyy';
    }
  }

  bindEvents() {
    // Brand click returns to search
    this.brandLogoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.showSection('home');
    });

    // Nav Links
    this.navHomeBtn.addEventListener('click', () => this.showSection('home'));
    this.navBusesBtn.addEventListener('click', () => {
      this.showSection('home');
      this.renderBuses(this.dataStore.buses, true);
    });
    this.navMyBookingsBtn.addEventListener('click', () => this.showSection('myBookings'));
    this.navAdminBtn.addEventListener('click', () => this.showSection('admin'));

    // Search events
    this.searchDate.addEventListener('change', () => this.updateDateDisplayPreview());

    this.swapRouteBtn.addEventListener('click', () => {
      const temp = this.searchSource.value;
      this.searchSource.value = this.searchDestination.value;
      this.searchDestination.value = temp;
    });

    // Quick chips
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.searchSource.value = btn.dataset.from;
        this.searchDestination.value = btn.dataset.to;
        this.triggerSearch();
      });
    });

    this.busSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.triggerSearch();
    });

    this.showAllBusesBtn.addEventListener('click', () => {
      this.renderBuses(this.dataStore.buses, true);
    });

    this.clearSearchFiltersBtn.addEventListener('click', () => {
      this.renderBuses(this.dataStore.buses, true);
    });

    // Auth Modal open/close & tabs
    this.openLoginBtn.addEventListener('click', () => this.openAuthModal('login'));
    this.closeAuthModalBtn.addEventListener('click', () => this.closeAuthModal());
    this.tabLoginBtn.addEventListener('click', () => this.switchAuthTab('login'));
    this.tabRegisterBtn.addEventListener('click', () => this.switchAuthTab('register'));

    // Demo Fill buttons
    this.fillAdminDemoBtn.addEventListener('click', () => {
      document.getElementById('loginUsername').value = 'admin';
      document.getElementById('loginPassword').value = 'admin123';
      this.showToast('Filled admin credentials (admin / admin123)', 'info');
    });

    this.fillPassengerDemoBtn.addEventListener('click', () => {
      document.getElementById('loginUsername').value = 'rahul';
      document.getElementById('loginPassword').value = 'pass123';
      this.showToast('Filled passenger credentials (rahul / pass123)', 'info');
    });

    // Login Form Submit
    this.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('loginUsername').value;
      const p = document.getElementById('loginPassword').value;
      try {
        const user = await this.system.loginUser(u, p);
        this.closeAuthModal();
        this.showToast(`Welcome back, ${user.fullName}! Logged in as ${user.role}.`, 'success');
        this.render();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    // Register Form Submit
    this.registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fn = document.getElementById('regFullName').value;
      const u = document.getElementById('regUsername').value;
      const p = document.getElementById('regPassword').value;
      const cp = document.getElementById('regConfirmPassword').value;

      if (p !== cp) {
        this.showToast('Passwords do not match. Please re-enter.', 'error');
        return;
      }

      try {
        const user = await this.system.registerUser(u, p, fn);
        this.closeAuthModal();
        this.showToast(`Registration successful! Welcome, ${user.fullName}.`, 'success');
        this.render();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    // Booking Modal events
    this.closeBookingModalBtn.addEventListener('click', () => this.closeBookingModal());
    this.confirmBookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleConfirmBooking();
    });

    // Ticket Modal events
    this.closeTicketModalBtn.addEventListener('click', () => this.ticketModal.classList.add('hidden'));
    this.closeTicketBottomBtn.addEventListener('click', () => this.ticketModal.classList.add('hidden'));
    this.printTicketBtn.addEventListener('click', () => window.print());

    // Bookings View events
    this.bookFirstTicketBtn.addEventListener('click', () => this.showSection('home'));
    this.refreshBookingsBtn.addEventListener('click', () => {
      this.renderMyBookings();
      this.showToast('Bookings refreshed.', 'info');
    });

    // Admin Dashboard tabs
    this.tabFleetBtn.addEventListener('click', () => this.switchAdminTab('fleet'));
    this.tabAllBookingsBtn.addEventListener('click', () => this.switchAdminTab('bookings'));
    this.tabSystemInfoBtn.addEventListener('click', () => this.switchAdminTab('info'));

    // Admin Add Bus
    this.openAddBusModalBtn.addEventListener('click', () => this.addBusModal.classList.remove('hidden'));
    this.closeAddBusModalBtn.addEventListener('click', () => this.addBusModal.classList.add('hidden'));
    this.addBusForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddBusSubmit();
    });

    // Admin Reset Data
    this.resetSystemDataBtn.addEventListener('click', () => {
      if (confirm('Reset system data to initial 4 sample buses and default administrator? All current custom bookings will be re-initialized.')) {
        this.system.resetSystemData();
        this.showToast('System data reset to default successfully.', 'success');
        this.render();
      }
    });

    // Cancellation Modal events
    this.closeCancelModalBtn.addEventListener('click', () => this.cancelConfirmModal.classList.add('hidden'));
    this.abortCancelBtn.addEventListener('click', () => this.cancelConfirmModal.classList.add('hidden'));
    this.executeCancelBtn.addEventListener('click', () => this.handleExecuteCancel());
  }

  // View Routing
  showSection(sectionKey) {
    this.heroSection.classList.add('hidden');
    this.busResultsSection.classList.add('hidden');
    this.myBookingsSection.classList.add('hidden');
    this.adminSection.classList.add('hidden');

    this.navHomeBtn.classList.remove('active');
    this.navBusesBtn.classList.remove('active');
    this.navMyBookingsBtn.classList.remove('active');
    this.navAdminBtn.classList.remove('active');

    if (sectionKey === 'home') {
      this.heroSection.classList.remove('hidden');
      this.busResultsSection.classList.remove('hidden');
      this.navHomeBtn.classList.add('active');
      this.triggerSearch();
    } else if (sectionKey === 'myBookings') {
      this.myBookingsSection.classList.remove('hidden');
      this.navMyBookingsBtn.classList.add('active');
      this.renderMyBookings();
    } else if (sectionKey === 'admin') {
      this.adminSection.classList.remove('hidden');
      this.navAdminBtn.classList.add('active');
      this.renderAdminDashboard();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Toast System
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Search Logic
  triggerSearch() {
    const source = this.searchSource.value;
    const dest = this.searchDestination.value;
    const dateVal = this.searchDate.value;
    const dateDisplay = DateUtils.toDisplayDate(dateVal);

    this.currentSearch = { source, destination: dest, dateDisplay };

    try {
      const results = this.system.searchBuses(source, dest, dateDisplay);
      this.renderBuses(results, false);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // Render Buses
  renderBuses(buses, isAll = false) {
    this.busCardsGrid.innerHTML = '';
    const date = this.currentSearch.dateDisplay;

    if (isAll) {
      this.resultsTitle.textContent = 'All Fleet Routes';
      this.resultsSubtitle.textContent = `Showing all scheduled buses in the network for travel date: ${date}`;
    } else {
      this.resultsTitle.textContent = `${this.currentSearch.source} → ${this.currentSearch.destination}`;
      this.resultsSubtitle.textContent = `Available buses for ${date}`;
    }

    if (!buses || buses.length === 0) {
      this.busCardsGrid.classList.add('hidden');
      this.noBusesFound.classList.remove('hidden');
      return;
    }

    this.busCardsGrid.classList.remove('hidden');
    this.noBusesFound.classList.add('hidden');

    buses.forEach(bus => {
      const availSeats = bus.getAvailableSeatCount(date);
      const isSoldOut = availSeats === 0;

      const card = document.createElement('div');
      card.className = 'bus-card';
      card.innerHTML = `
        <div class="bus-card-top">
          <span class="bus-id-tag">${bus.id}</span>
          <span class="bus-type-badge">${bus.name.includes('Sleeper') ? 'Sleeper Coach' : 'Air-Conditioned Express'}</span>
        </div>
        <h3 class="bus-title">${bus.name}</h3>
        <div class="route-pill-display">
          <span>${bus.source}</span>
          <span class="route-arrow-icon">&rarr;</span>
          <span>${bus.destination}</span>
        </div>
        <div class="bus-meta-specs">
          <div class="spec-item">
            <span class="spec-label">Departure</span>
            <span class="spec-val">${bus.departureTime}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Capacity</span>
            <span class="spec-val">${bus.totalSeats} Seats</span>
          </div>
        </div>
        <div class="bus-card-bottom">
          <div class="bus-fare-box">
            <span class="fare-lead">Fare per seat</span>
            <span class="fare-amount">₹${bus.fare}</span>
          </div>
          <div class="bus-actions">
            <div class="seat-availability-indicator ${availSeats > 5 ? 'seat-avail-green' : 'seat-avail-red'}">
              <span>●</span> ${availSeats} seats left
            </div>
          </div>
        </div>
        <div style="margin-top: 14px;">
          <button class="btn btn-primary btn-block select-bus-btn" data-bus-id="${bus.id}" ${isSoldOut ? 'disabled' : ''}>
            ${isSoldOut ? 'Sold Out' : 'Select Seats & Book'}
          </button>
        </div>
      `;

      card.querySelector('.select-bus-btn').addEventListener('click', () => {
        this.openBookingModal(bus.id);
      });

      this.busCardsGrid.appendChild(card);
    });
  }

  // ==========================================================================
  // SEAT SELECTION & BOOKING WORKFLOW (Rules 3.5 & 3.6)
  // ==========================================================================
  openBookingModal(busId) {
    if (!this.system.currentUser) {
      this.showToast('Please sign in as a Passenger to book seats.', 'warning');
      this.openAuthModal('login');
      return;
    }

    const bus = this.dataStore.buses.find(b => b.id === busId);
    if (!bus) return;

    this.selectedBusForBooking = bus;
    this.selectedSeats.clear();

    const date = this.currentSearch.dateDisplay;
    this.modalBusIdBadge.textContent = bus.id;
    this.bookingModalTitle.textContent = `${bus.name} (${bus.source} → ${bus.destination})`;
    this.bookingModalSubtitle.textContent = `Travel Date: ${date} • Departure: ${bus.departureTime} • Fare: ₹${bus.fare}/seat`;

    this.renderSeatMap(bus, date);
    this.updateBookingSummary();
    this.bookingModal.classList.remove('hidden');
  }

  closeBookingModal() {
    this.bookingModal.classList.add('hidden');
    this.selectedBusForBooking = null;
    this.selectedSeats.clear();
  }

  // Rule 3.6: The passenger selects a bus and sees the seat layout with booked seats marked [XX]
  renderSeatMap(bus, travelDate) {
    this.busSeatsWrapper.innerHTML = '';
    const bookedSeats = new Set(bus.getBookedSeats(travelDate));
    const total = bus.totalSeats;
    const rows = Math.ceil(total / 4);

    for (let r = 0; r < rows; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row';

      const s1 = r * 4 + 1;
      const s2 = r * 4 + 2;
      const s3 = r * 4 + 3;
      const s4 = r * 4 + 4;

      // Left Pair (A & B)
      const leftPair = document.createElement('div');
      leftPair.className = 'seat-row-pair';
      if (s1 <= total) leftPair.appendChild(this.createSeatButton(s1, bookedSeats));
      if (s2 <= total) leftPair.appendChild(this.createSeatButton(s2, bookedSeats));

      // Aisle
      const aisle = document.createElement('div');
      aisle.className = 'aisle-gap';
      aisle.textContent = `R${r + 1}`;

      // Right Pair (C & D)
      const rightPair = document.createElement('div');
      rightPair.className = 'seat-row-pair';
      if (s3 <= total) rightPair.appendChild(this.createSeatButton(s3, bookedSeats));
      if (s4 <= total) rightPair.appendChild(this.createSeatButton(s4, bookedSeats));

      rowEl.appendChild(leftPair);
      rowEl.appendChild(aisle);
      rowEl.appendChild(rightPair);

      this.busSeatsWrapper.appendChild(rowEl);
    }
  }

  createSeatButton(seatNum, bookedSeatsSet) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seat-btn';
    btn.dataset.seat = seatNum;

    const isBooked = bookedSeatsSet.has(seatNum);

    if (isBooked) {
      // Marked [XX] as specified in Report 3.6
      btn.classList.add('booked');
      btn.disabled = true;
      btn.innerHTML = `<span style="font-size:0.6rem; color:#991b1b;">#${seatNum}</span><span style="font-weight:900;">XX</span>`;
      btn.title = `Seat ${seatNum} is already booked for this travel date.`;
    } else {
      btn.textContent = seatNum;
      btn.title = `Seat ${seatNum} is Available (Click to select)`;
      btn.addEventListener('click', () => this.toggleSeatSelection(seatNum, btn));
    }

    return btn;
  }

  // Rule 3.5: At most 6 seats can be booked in one booking
  toggleSeatSelection(seatNum, btn) {
    if (this.selectedSeats.has(seatNum)) {
      this.selectedSeats.delete(seatNum);
      btn.classList.remove('selected');
    } else {
      if (this.selectedSeats.size >= 6) {
        this.showToast('Rule 3.5 Violation: At most 6 seats can be booked in one booking.', 'warning');
        return;
      }
      this.selectedSeats.add(seatNum);
      btn.classList.add('selected');
    }

    this.updateBookingSummary();
  }

  // Dynamically render passenger detail fields (name & age) per seat (Report 3.6 step 5)
  updateBookingSummary() {
    const seatsArray = Array.from(this.selectedSeats).sort((a, b) => a - b);
    const count = seatsArray.length;
    const bus = this.selectedBusForBooking;
    const fare = bus ? bus.fare : 0;
    const total = fare * count;

    this.selectedSeatsCount.textContent = `${count} / 6 Seats Selected`;
    this.farePerSeatDisplay.textContent = `₹${fare}`;
    this.fareSeatCountDisplay.textContent = count;
    this.fareSeatsListDisplay.textContent = count > 0 ? seatsArray.join(', ') : 'None';
    this.fareTotalDisplay.textContent = `₹${total}`;

    // Enable/disable confirm button
    this.confirmBookingBtn.disabled = count === 0;

    // Render passenger inputs
    this.renderPassengerInputs(seatsArray);
  }

  renderPassengerInputs(seatsArray) {
    // Preserve existing inputs if any
    const existingValues = {};
    document.querySelectorAll('.passenger-entry-card').forEach(card => {
      const seat = Number(card.dataset.seat);
      const name = card.querySelector('.passenger-name-input').value;
      const age = card.querySelector('.passenger-age-input').value;
      existingValues[seat] = { name, age };
    });

    this.passengerInputsContainer.innerHTML = '';

    if (seatsArray.length === 0) {
      this.emptyPassengerHint.classList.remove('hidden');
      this.passengerInputsContainer.appendChild(this.emptyPassengerHint);
      return;
    }

    this.emptyPassengerHint.classList.add('hidden');

    seatsArray.forEach((seat, idx) => {
      const defaultName = existingValues[seat]?.name || (idx === 0 && this.system.currentUser ? this.system.currentUser.fullName : '');
      const defaultAge = existingValues[seat]?.age || (idx === 0 ? '25' : '');

      const card = document.createElement('div');
      card.className = 'passenger-entry-card';
      card.dataset.seat = seat;
      card.innerHTML = `
        <div class="passenger-card-top">
          <span class="seat-tag">Seat #${seat}</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">Passenger ${idx + 1}</span>
        </div>
        <div class="passenger-fields-row">
          <input type="text" class="form-control passenger-name-input" placeholder="Full Name" value="${defaultName}" required>
          <input type="number" class="form-control passenger-age-input" placeholder="Age" min="1" max="120" value="${defaultAge}" required>
        </div>
      `;
      this.passengerInputsContainer.appendChild(card);
    });
  }

  // Booking Execution
  handleConfirmBooking() {
    if (!this.selectedBusForBooking) return;
    const bus = this.selectedBusForBooking;
    const travelDate = this.currentSearch.dateDisplay;
    const seatsArray = Array.from(this.selectedSeats).sort((a, b) => a - b);

    // Collect passenger name and age inputs
    const passengerList = [];
    const entryCards = document.querySelectorAll('.passenger-entry-card');
    for (const card of entryCards) {
      const seat = Number(card.dataset.seat);
      const name = card.querySelector('.passenger-name-input').value.trim();
      const age = Number(card.querySelector('.passenger-age-input').value);
      passengerList.push({ seatNumber: seat, name, age });
    }

    try {
      const booking = this.system.bookSeats(bus.id, travelDate, seatsArray, passengerList);
      this.closeBookingModal();
      this.showToast(`Booking Confirmed! Booking ID: ${booking.bookingId}`, 'success');
      this.render();
      this.openTicketModal(booking);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================================================
  // TICKET PRINTING & BOARDING PASS MODAL (Report 3.4 & 3.6)
  // ==========================================================================
  openTicketModal(booking) {
    document.getElementById('ticketBookingId').textContent = booking.bookingId;
    document.getElementById('ticketDate').textContent = booking.travelDate;
    document.getElementById('ticketTime').textContent = booking.departureTime;
    document.getElementById('ticketOrigin').textContent = booking.source;
    document.getElementById('ticketDestination').textContent = booking.destination;
    document.getElementById('ticketBusName').textContent = `${booking.busName} (${booking.busId})`;
    document.getElementById('ticketBookedBy').textContent = `${booking.passengerFullName} (@${booking.passengerUsername})`;
    document.getElementById('ticketSeatNumbers').textContent = booking.seats.join(', ');
    document.getElementById('ticketFarePaid').textContent = `₹${booking.totalFare}`;

    const pill = document.getElementById('ticketStatusPill');
    pill.textContent = booking.status;
    pill.style.background = booking.status === 'CONFIRMED' ? '#10b981' : '#dc2626';

    // Passenger Roster Table
    const tbody = document.getElementById('ticketPassengerTableBody');
    tbody.innerHTML = '';
    booking.passengers.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono"><strong>#${p.seatNumber}</strong></td>
        <td>${p.name}</td>
        <td>${p.age} yrs</td>
        <td class="font-mono">₹${booking.farePerSeat}</td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('ticketBarcodeText').textContent = `${booking.bookingId}`;
    this.ticketModal.classList.remove('hidden');
  }

  // ==========================================================================
  // MY BOOKINGS (Passenger Personal Dashboard & Cancellation 3.5 & 3.6)
  // ==========================================================================
  renderMyBookings() {
    const bookings = this.system.getCurrentUserBookings();
    this.bookingCounter.textContent = bookings.filter(b => b.status === 'CONFIRMED').length;

    this.myBookingsList.innerHTML = '';
    if (!bookings || bookings.length === 0) {
      this.myBookingsList.classList.add('hidden');
      this.noBookingsState.classList.remove('hidden');
      return;
    }

    this.myBookingsList.classList.remove('hidden');
    this.noBookingsState.classList.add('hidden');

    bookings.forEach(b => {
      const card = document.createElement('div');
      card.className = `booking-item-card ${b.status.toLowerCase()}`;
      card.innerHTML = `
        <div class="booking-main-info">
          <div class="booking-id-block">
            <span class="booking-ref-label">Reference</span>
            <span class="booking-ref-num">${b.bookingId}</span>
            <span class="status-badge ${b.status.toLowerCase()}" style="margin-top:6px;">${b.status}</span>
          </div>
          <div class="booking-route-block">
            <h4>${b.source} &rarr; ${b.destination}</h4>
            <div class="booking-route-sub">${b.busName} &bull; ${b.travelDate} at ${b.departureTime}</div>
          </div>
          <div>
            <span class="booking-ref-label">Seats Booked</span>
            <div class="booking-seats-pill">Seats: ${b.seats.join(', ')}</div>
          </div>
          <div>
            <span class="booking-ref-label">Total Fare</span>
            <div style="font-weight:800; color:var(--text-main);">₹${b.totalFare}</div>
            ${b.status === 'CANCELLED' ? `<span style="font-size:0.75rem; color:var(--accent-green); font-weight:700;">Refunded 90%: ₹${b.refundAmount}</span>` : ''}
          </div>
        </div>
        <div class="booking-actions-block">
          <button class="btn btn-outline btn-sm view-ticket-btn" data-id="${b.bookingId}">
            View / Print Ticket
          </button>
          ${b.status === 'CONFIRMED' ? `
            <button class="btn btn-danger btn-sm cancel-booking-btn" data-id="${b.bookingId}">
              Cancel &amp; Refund
            </button>
          ` : `
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">Seats Released</span>
          `}
        </div>
      `;

      card.querySelector('.view-ticket-btn').addEventListener('click', () => {
        this.openTicketModal(b);
      });

      const cancelBtn = card.querySelector('.cancel-booking-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.openCancelModal(b);
        });
      }

      this.myBookingsList.appendChild(card);
    });
  }

  // Rule 3.5: Cancellation modal with 90% refund and 10% fee breakdown
  openCancelModal(booking) {
    this.pendingCancelBookingId = booking.bookingId;
    this.cancelModalBookingId.textContent = `#${booking.bookingId}`;
    this.cancelOriginalFare.textContent = `₹${booking.totalFare}`;

    const fee = Math.round(booking.totalFare * 0.1);
    const refund = booking.totalFare - fee;

    this.cancelFeeDisplay.textContent = `-₹${fee}`;
    this.cancelRefundDisplay.textContent = `₹${refund}`;

    this.cancelConfirmModal.classList.remove('hidden');
  }

  handleExecuteCancel() {
    if (!this.pendingCancelBookingId) return;
    try {
      const res = this.system.cancelBooking(this.pendingCancelBookingId);
      this.cancelConfirmModal.classList.add('hidden');
      this.showToast(
        `Ticket Cancelled Successfully. 90% Refund: ₹${res.refundAmount} credited (10% Fee: ₹${res.cancellationCharge}). Seats released.`,
        'success'
      );
      this.render();
      if (!this.myBookingsSection.classList.contains('hidden')) {
        this.renderMyBookings();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================================================
  // ADMINISTRATOR DASHBOARD (Rules 3.5 & 3.6)
  // ==========================================================================
  renderAdminDashboard() {
    if (!this.system.currentUser || this.system.currentUser.role !== 'ADMIN') {
      this.showToast('Access restricted to administrators.', 'error');
      this.showSection('home');
      return;
    }

    // KPI Counters
    const buses = this.dataStore.buses;
    const bookings = this.dataStore.bookings;
    const users = this.dataStore.users;

    const confirmed = bookings.filter(b => b.status === 'CONFIRMED');
    const revenue = confirmed.reduce((acc, b) => acc + b.totalFare, 0);

    this.kpiTotalBuses.textContent = buses.length;
    this.kpiActiveBookings.textContent = confirmed.length;
    this.kpiTotalUsers.textContent = users.length;
    this.kpiTotalRevenue.textContent = `₹${revenue.toLocaleString('en-IN')}`;

    this.renderAdminBusTable();
    this.renderAdminBookingsTable();
  }

  renderAdminBusTable() {
    this.adminBusTableBody.innerHTML = '';
    const buses = this.dataStore.buses;

    buses.forEach(b => {
      // Check active bookings count for this bus
      const activeBookings = this.dataStore.bookings.filter(
        bk => bk.busId === b.id && bk.status === 'CONFIRMED'
      ).length;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono"><strong>${b.id}</strong></td>
        <td><strong>${b.name}</strong></td>
        <td>${b.source} &rarr; ${b.destination}</td>
        <td>${b.departureTime}</td>
        <td>₹${b.fare}</td>
        <td>${b.totalSeats} seats</td>
        <td>
          <span class="badge ${activeBookings > 0 ? 'badge-pill' : ''}" style="font-weight:700;">
            ${activeBookings} active
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline btn-delete-bus" data-id="${b.id}" title="${activeBookings > 0 ? 'Cannot delete: Bus has active passenger bookings (Rule 3.5)' : 'Remove bus'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Remove
          </button>
        </td>
      `;

      tr.querySelector('.btn-delete-bus').addEventListener('click', () => {
        this.handleDeleteBus(b.id);
      });

      this.adminBusTableBody.appendChild(tr);
    });
  }

  // Rule 3.5: A bus that has active bookings cannot be removed by the administrator.
  handleDeleteBus(busId) {
    try {
      if (confirm(`Are you sure you want to delete bus ${busId}?`)) {
        this.system.removeBus(busId);
        this.showToast(`Bus ${busId} has been removed from fleet.`, 'success');
        this.renderAdminDashboard();
      }
    } catch (err) {
      // Alert with rule explanation as requested in 3.5
      this.showToast(err.message, 'error');
    }
  }

  handleAddBusSubmit() {
    const id = document.getElementById('newBusId').value;
    const name = document.getElementById('newBusName').value;
    const source = document.getElementById('newBusSource').value;
    const destination = document.getElementById('newBusDest').value;
    const departureTime = document.getElementById('newBusTime').value;
    const fare = document.getElementById('newBusFare').value;
    const totalSeats = document.getElementById('newBusSeats').value;

    try {
      const bus = this.system.addBus({ id, name, source, destination, departureTime, fare, totalSeats });
      this.addBusModal.classList.add('hidden');
      this.addBusForm.reset();
      this.showToast(`New bus ${bus.id} added successfully to fleet!`, 'success');
      this.render();
      this.renderAdminDashboard();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderAdminBookingsTable() {
    this.adminBookingsTableBody.innerHTML = '';
    const bookings = this.dataStore.bookings;

    bookings.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono"><strong>${b.bookingId}</strong></td>
        <td>
          <strong>${b.passengerFullName}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">@${b.passengerUsername}</div>
        </td>
        <td>${b.busName} (${b.busId})</td>
        <td>${b.travelDate}</td>
        <td><span class="font-mono">${b.seats.join(', ')}</span> (${b.seats.length})</td>
        <td><strong>₹${b.totalFare}</strong></td>
        <td><span class="status-badge ${b.status.toLowerCase()}">${b.status}</span></td>
        <td>
          <button class="btn btn-xs btn-outline view-admin-ticket" data-id="${b.bookingId}">
            Inspect Ticket
          </button>
        </td>
      `;

      tr.querySelector('.view-admin-ticket').addEventListener('click', () => {
        this.openTicketModal(b);
      });

      this.adminBookingsTableBody.appendChild(tr);
    });
  }

  switchAdminTab(tabKey) {
    this.tabFleetBtn.classList.remove('active');
    this.tabAllBookingsBtn.classList.remove('active');
    this.tabSystemInfoBtn.classList.remove('active');
    this.paneFleet.classList.add('hidden');
    this.paneAllBookings.classList.add('hidden');
    this.paneSystemInfo.classList.add('hidden');

    if (tabKey === 'fleet') {
      this.tabFleetBtn.classList.add('active');
      this.paneFleet.classList.remove('hidden');
    } else if (tabKey === 'bookings') {
      this.tabAllBookingsBtn.classList.add('active');
      this.paneAllBookings.classList.remove('hidden');
    } else if (tabKey === 'info') {
      this.tabSystemInfoBtn.classList.add('active');
      this.paneSystemInfo.classList.remove('hidden');
    }
  }

  // ==========================================================================
  // AUTH MODAL & STATE
  // ==========================================================================
  openAuthModal(mode = 'login') {
    this.switchAuthTab(mode);
    this.authModal.classList.remove('hidden');
  }

  closeAuthModal() {
    this.authModal.classList.add('hidden');
    this.loginForm.reset();
    this.registerForm.reset();
  }

  switchAuthTab(mode) {
    if (mode === 'login') {
      this.tabLoginBtn.classList.add('active');
      this.tabRegisterBtn.classList.remove('active');
      this.loginForm.classList.remove('hidden');
      this.registerForm.classList.add('hidden');
      document.getElementById('demoAccountsBox').classList.remove('hidden');
      document.getElementById('authModalTitle').textContent = 'Sign In to BusReserve';
    } else {
      this.tabLoginBtn.classList.remove('active');
      this.tabRegisterBtn.classList.add('active');
      this.loginForm.classList.add('hidden');
      this.registerForm.classList.remove('hidden');
      document.getElementById('demoAccountsBox').classList.add('hidden');
      document.getElementById('authModalTitle').textContent = 'Register New Passenger';
    }
  }

  // Main UI Render (Auth state, navigation, counters)
  render() {
    const user = this.system.currentUser;

    if (user) {
      // User is authenticated
      const roleClass = user.role === 'ADMIN' ? 'role-admin' : 'role-passenger';
      this.navAuth.innerHTML = `
        <div class="user-profile-pill">
          <div class="user-info-text">
            <span class="user-name-label">${user.fullName}</span>
            <span class="user-role-label ${roleClass}">${user.role}</span>
          </div>
          <button class="btn btn-xs btn-outline" id="logoutBtn" title="Sign Out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Logout
          </button>
        </div>
      `;

      document.getElementById('logoutBtn').addEventListener('click', () => {
        this.system.logout();
        this.showToast('You have been logged out.', 'info');
        this.showSection('home');
        this.render();
      });

      this.navMyBookingsBtn.classList.remove('hidden');

      if (user.role === 'ADMIN') {
        this.navAdminBtn.classList.remove('hidden');
      } else {
        this.navAdminBtn.classList.add('hidden');
      }

      const userBookings = this.system.getCurrentUserBookings();
      this.bookingCounter.textContent = userBookings.filter(b => b.status === 'CONFIRMED').length;
    } else {
      // Guest
      this.navAuth.innerHTML = `
        <button class="btn btn-outline" id="openLoginBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
          Sign In / Register
        </button>
      `;
      document.getElementById('openLoginBtn').addEventListener('click', () => this.openAuthModal('login'));

      this.navMyBookingsBtn.classList.add('hidden');
      this.navAdminBtn.classList.add('hidden');
    }

    // Refresh buses based on current search
    this.triggerSearch();
  }
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MainUI();
});
