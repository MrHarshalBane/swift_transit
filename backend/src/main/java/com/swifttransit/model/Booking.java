package com.swifttransit.model;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * Booking entity representing a confirmed or cancelled reservation.
 */
public class Booking implements Serializable {
    private static final long serialVersionUID = 1L;

    private String bookingId;
    private String passengerUsername;
    private String passengerFullName;
    private String busId;
    private String busName;
    private String source;
    private String destination;
    private String travelDate; // dd-MM-yyyy
    private String departureTime;
    private List<Integer> seats = new ArrayList<>();
    private List<Passenger> passengers = new ArrayList<>();
    private double farePerSeat;
    private double totalFare;
    private String status; // "CONFIRMED" or "CANCELLED"
    private double refundAmount;
    private String createdAt;

    public Booking() {}

    public Booking(String bookingId, String passengerUsername, String passengerFullName,
                   String busId, String busName, String source, String destination,
                   String travelDate, String departureTime, List<Integer> seats,
                   List<Passenger> passengers, double farePerSeat, String status,
                   double refundAmount, String createdAt) {
        this.bookingId = bookingId;
        this.passengerUsername = passengerUsername;
        this.passengerFullName = passengerFullName;
        this.busId = busId;
        this.busName = busName;
        this.source = source;
        this.destination = destination;
        this.travelDate = travelDate;
        this.departureTime = departureTime;
        this.seats = seats != null ? seats : new ArrayList<>();
        this.passengers = passengers != null ? passengers : new ArrayList<>();
        this.farePerSeat = farePerSeat;
        this.totalFare = farePerSeat * this.seats.size();
        this.status = status != null ? status : "CONFIRMED";
        this.refundAmount = refundAmount;
        this.createdAt = createdAt;
    }

    public String getBookingId() { return bookingId; }
    public void setBookingId(String bookingId) { this.bookingId = bookingId; }

    public String getPassengerUsername() { return passengerUsername; }
    public void setPassengerUsername(String passengerUsername) { this.passengerUsername = passengerUsername; }

    public String getPassengerFullName() { return passengerFullName; }
    public void setPassengerFullName(String passengerFullName) { this.passengerFullName = passengerFullName; }

    public String getBusId() { return busId; }
    public void setBusId(String busId) { this.busId = busId; }

    public String getBusName() { return busName; }
    public void setBusName(String busName) { this.busName = busName; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getTravelDate() { return travelDate; }
    public void setTravelDate(String travelDate) { this.travelDate = travelDate; }

    public String getDepartureTime() { return departureTime; }
    public void setDepartureTime(String departureTime) { this.departureTime = departureTime; }

    public List<Integer> getSeats() { return seats; }
    public void setSeats(List<Integer> seats) { this.seats = seats; }

    public List<Passenger> getPassengers() { return passengers; }
    public void setPassengers(List<Passenger> passengers) { this.passengers = passengers; }

    public double getFarePerSeat() { return farePerSeat; }
    public void setFarePerSeat(double farePerSeat) { this.farePerSeat = farePerSeat; }

    public double getTotalFare() { return totalFare; }
    public void setTotalFare(double totalFare) { this.totalFare = totalFare; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public double getRefundAmount() { return refundAmount; }
    public void setRefundAmount(double refundAmount) { this.refundAmount = refundAmount; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
