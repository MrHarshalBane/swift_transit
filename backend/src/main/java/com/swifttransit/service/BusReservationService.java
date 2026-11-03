package com.swifttransit.service;

import com.swifttransit.model.*;
import com.swifttransit.storage.DataStore;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Core business rules, validation, seat management and cancellation calculations.
 */
public class BusReservationService {
    private final DataStore dataStore;
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_]{3,15}$");

    public BusReservationService(DataStore dataStore) {
        this.dataStore = dataStore;
    }

    public DataStore getDataStore() {
        return dataStore;
    }

    // SHA-256 helper
    public static String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : encodedhash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 algorithm unavailable", e);
        }
    }

    // Date validator
    public static boolean isPastDate(String dateStr) {
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        sdf.setLenient(false);
        try {
            Date date = sdf.parse(dateStr);
            Calendar calToday = Calendar.getInstance();
            calToday.set(Calendar.HOUR_OF_DAY, 0);
            calToday.set(Calendar.MINUTE, 0);
            calToday.set(Calendar.SECOND, 0);
            calToday.set(Calendar.MILLISECOND, 0);
            return date.before(calToday.getTime());
        } catch (ParseException e) {
            return true;
        }
    }

    public synchronized User registerUser(String username, String passwordHash, String fullName, String role) {
        if (username == null || !USERNAME_PATTERN.matcher(username.trim()).matches()) {
            throw new IllegalArgumentException("Username must be 3–15 characters (letters, digits, or underscores only).");
        }
        if (passwordHash == null || passwordHash.trim().isEmpty()) {
            throw new IllegalArgumentException("Password hash is required.");
        }
        if (fullName == null || fullName.trim().isEmpty()) {
            throw new IllegalArgumentException("Full name is required.");
        }

        final String cleanUsername = username.trim();
        boolean exists = dataStore.getUsers().stream()
                .anyMatch(u -> u.getUsername().equalsIgnoreCase(cleanUsername));
        if (exists) {
            throw new IllegalArgumentException("Username \"" + cleanUsername + "\" is already taken.");
        }

        User user = new User(cleanUsername, passwordHash.trim(), fullName.trim(), role);
        dataStore.getUsers().add(user);
        dataStore.save();
        return user;
    }

    public synchronized User loginUser(String username, String passwordHash) {
        if (username == null || passwordHash == null) {
            throw new IllegalArgumentException("Username and password are required.");
        }
        final String cleanUsername = username.trim();
        return dataStore.getUsers().stream()
                .filter(u -> u.getUsername().equalsIgnoreCase(cleanUsername) && u.getPasswordHash().equals(passwordHash))
                .findFirst()
                .orElse(null);
    }

    public synchronized List<Bus> searchBuses(String source, String destination, String travelDate) {
        if (travelDate == null || travelDate.trim().isEmpty()) {
            throw new IllegalArgumentException("Please select a travel date.");
        }
        if (isPastDate(travelDate)) {
            throw new IllegalArgumentException("Travel date cannot be in the past (Rule 3.5).");
        }

        List<Bus> results = new ArrayList<>();
        for (Bus bus : dataStore.getBuses()) {
            boolean matchSource = (source == null || source.trim().isEmpty() ||
                    bus.getSource().equalsIgnoreCase(source.trim()));
            boolean matchDest = (destination == null || destination.trim().isEmpty() ||
                    bus.getDestination().equalsIgnoreCase(destination.trim()));
            if (matchSource && matchDest) {
                results.add(bus);
            }
        }
        return results;
    }

    public synchronized Bus getBusById(String busId) {
        return dataStore.getBuses().stream()
                .filter(b -> b.getId().equalsIgnoreCase(busId))
                .findFirst()
                .orElse(null);
    }

    public synchronized Bus addBus(Bus bus) {
        if (bus == null || bus.getId() == null || bus.getId().trim().isEmpty()) {
            throw new IllegalArgumentException("Bus ID is required.");
        }
        String id = bus.getId().trim().toUpperCase();
        if (getBusById(id) != null) {
            throw new IllegalArgumentException("A bus with ID \"" + id + "\" already exists.");
        }
        bus.setId(id);
        dataStore.getBuses().add(bus);
        dataStore.save();
        return bus;
    }

    public synchronized void removeBus(String busId) {
        Bus bus = getBusById(busId);
        if (bus == null) {
            throw new IllegalArgumentException("Bus " + busId + " not found.");
        }

        boolean hasActiveBookings = dataStore.getBookings().stream()
                .anyMatch(b -> b.getBusId().equalsIgnoreCase(busId) && "CONFIRMED".equalsIgnoreCase(b.getStatus()));

        if (hasActiveBookings) {
            throw new IllegalStateException("Cannot remove bus " + busId + ": Under Business Rule 3.5, a bus that has active passenger bookings cannot be removed.");
        }

        dataStore.getBuses().remove(bus);
        dataStore.save();
    }

    public synchronized Booking createBooking(String passengerUsername, String passengerFullName,
                                             String busId, String travelDate,
                                             List<Integer> selectedSeats, List<Passenger> passengers) {
        if (passengerUsername == null || passengerUsername.trim().isEmpty()) {
            throw new IllegalArgumentException("Passenger username is required.");
        }
        if (travelDate == null || isPastDate(travelDate)) {
            throw new IllegalArgumentException("Invalid travel date. Cannot book tickets for past dates.");
        }
        Bus bus = getBusById(busId);
        if (bus == null) {
            throw new IllegalArgumentException("Bus route not found.");
        }
        if (selectedSeats == null || selectedSeats.isEmpty()) {
            throw new IllegalArgumentException("Please select at least 1 seat.");
        }
        if (selectedSeats.size() > 6) {
            throw new IllegalArgumentException("Maximum 6 seats can be booked in one booking (Rule 3.5).");
        }

        List<Integer> booked = bus.getBookedSeats(travelDate);
        for (Integer seat : selectedSeats) {
            if (booked.contains(seat)) {
                throw new IllegalStateException("Seat #" + seat + " has already been booked for this date.");
            }
        }

        if (passengers == null || passengers.size() != selectedSeats.size()) {
            throw new IllegalArgumentException("Passenger details must be provided for every selected seat.");
        }

        String dateCode = travelDate.replace("-", "");
        int randCode = 1000 + new Random().nextInt(9000);
        String bookingId = "ST-BK-" + dateCode + "-" + randCode;

        bus.markSeatsBooked(travelDate, selectedSeats);

        Booking booking = new Booking(
                bookingId,
                passengerUsername,
                passengerFullName,
                bus.getId(),
                bus.getName(),
                bus.getSource(),
                bus.getDestination(),
                travelDate,
                bus.getDepartureTime(),
                new ArrayList<>(selectedSeats),
                new ArrayList<>(passengers),
                bus.getFare(),
                "CONFIRMED",
                0.0,
                new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date())
        );

        dataStore.getBookings().add(0, booking);
        dataStore.save();
        return booking;
    }

    public synchronized Booking cancelBooking(String bookingId, String requestingUsername, boolean isAdmin) {
        Booking booking = dataStore.getBookings().stream()
                .filter(b -> b.getBookingId().equalsIgnoreCase(bookingId))
                .findFirst()
                .orElse(null);

        if (booking == null) {
            throw new IllegalArgumentException("Booking not found: " + bookingId);
        }

        if (!isAdmin && !booking.getPassengerUsername().equalsIgnoreCase(requestingUsername)) {
            throw new SecurityException("Permission denied. Passengers can cancel only their own bookings.");
        }

        if ("CANCELLED".equalsIgnoreCase(booking.getStatus())) {
            throw new IllegalStateException("This booking has already been cancelled.");
        }

        Bus bus = getBusById(booking.getBusId());
        if (bus != null) {
            bus.releaseSeats(booking.getTravelDate(), booking.getSeats());
        }

        double refund = Math.round(booking.getTotalFare() * 0.90);
        booking.setStatus("CANCELLED");
        booking.setRefundAmount(refund);

        dataStore.save();
        return booking;
    }

    public synchronized List<Booking> getUserBookings(String username) {
        if (username == null) return Collections.emptyList();
        List<Booking> list = new ArrayList<>();
        for (Booking b : dataStore.getBookings()) {
            if (username.equalsIgnoreCase(b.getPassengerUsername())) {
                list.add(b);
            }
        }
        return list;
    }

    public synchronized List<Booking> getAllBookings() {
        return new ArrayList<>(dataStore.getBookings());
    }
}
