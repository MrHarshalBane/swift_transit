package com.swifttransit.model;

import java.io.Serializable;

/**
 * Passenger roster record for a specific seat in a booking.
 */
public class Passenger implements Serializable {
    private static final long serialVersionUID = 1L;

    private int seatNumber;
    private String name;
    private int age;

    public Passenger() {}

    public Passenger(int seatNumber, String name, int age) {
        this.seatNumber = seatNumber;
        this.name = name;
        this.age = age;
    }

    public int getSeatNumber() { return seatNumber; }
    public void setSeatNumber(int seatNumber) { this.seatNumber = seatNumber; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getAge() { return age; }
    public void setAge(int age) { this.age = age; }
}
