package com.swifttransit.model;

import java.io.Serializable;
import java.util.*;

/**
 * Bus entity representing a scheduled transit route and seat inventory.
 */
public class Bus implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;
    private String name;
    private String source;
    private String destination;
    private String departureTime;
    private double fare;
    private int totalSeats;
    // Map of travelDate (dd-MM-yyyy) -> list of booked seat numbers
    private Map<String, List<Integer>> bookedSeatsByDate = new HashMap<>();

    public Bus() {}

    public Bus(String id, String name, String source, String destination, String departureTime, double fare, int totalSeats) {
        this.id = id;
        this.name = name;
        this.source = source;
        this.destination = destination;
        this.departureTime = departureTime;
        this.fare = fare;
        this.totalSeats = totalSeats > 0 ? totalSeats : 28;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getDepartureTime() { return departureTime; }
    public void setDepartureTime(String departureTime) { this.departureTime = departureTime; }

    public double getFare() { return fare; }
    public void setFare(double fare) { this.fare = fare; }

    public int getTotalSeats() { return totalSeats; }
    public void setTotalSeats(int totalSeats) { this.totalSeats = totalSeats; }

    public Map<String, List<Integer>> getBookedSeatsByDate() {
        if (bookedSeatsByDate == null) bookedSeatsByDate = new HashMap<>();
        return bookedSeatsByDate;
    }

    public void setBookedSeatsByDate(Map<String, List<Integer>> bookedSeatsByDate) {
        this.bookedSeatsByDate = bookedSeatsByDate;
    }

    public synchronized List<Integer> getBookedSeats(String travelDate) {
        if (bookedSeatsByDate == null) bookedSeatsByDate = new HashMap<>();
        List<Integer> list = bookedSeatsByDate.get(travelDate);
        return list != null ? new ArrayList<>(list) : new ArrayList<>();
    }

    public synchronized int getAvailableSeatCount(String travelDate) {
        List<Integer> booked = getBookedSeats(travelDate);
        return Math.max(0, totalSeats - booked.size());
    }

    public synchronized void markSeatsBooked(String travelDate, List<Integer> seatNumbers) {
        if (bookedSeatsByDate == null) bookedSeatsByDate = new HashMap<>();
        Set<Integer> set = new TreeSet<>(getBookedSeats(travelDate));
        set.addAll(seatNumbers);
        bookedSeatsByDate.put(travelDate, new ArrayList<>(set));
    }

    public synchronized void releaseSeats(String travelDate, List<Integer> seatNumbers) {
        if (bookedSeatsByDate == null || !bookedSeatsByDate.containsKey(travelDate)) return;
        List<Integer> current = new ArrayList<>(bookedSeatsByDate.get(travelDate));
        current.removeAll(seatNumbers);
        bookedSeatsByDate.put(travelDate, current);
    }
}
