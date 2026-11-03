package com.swifttransit.storage;

import com.swifttransit.model.*;
import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * DataStore managing busdata.ser file persistence with automated first-run seeding.
 */
public class DataStore implements Serializable {
    private static final long serialVersionUID = 1L;

    private static final String DEFAULT_FILE_PATH = "busdata.ser";

    private List<User> users = new ArrayList<>();
    private List<Bus> buses = new ArrayList<>();
    private List<Booking> bookings = new ArrayList<>();

    private transient String filePath = DEFAULT_FILE_PATH;

    public DataStore() {
        this(DEFAULT_FILE_PATH);
    }

    public DataStore(String filePath) {
        this.filePath = (filePath != null && !filePath.trim().isEmpty()) ? filePath : DEFAULT_FILE_PATH;
        load();
    }

    public synchronized List<User> getUsers() { return users; }
    public synchronized List<Bus> getBuses() { return buses; }
    public synchronized List<Booking> getBookings() { return bookings; }

    @SuppressWarnings("unchecked")
    public synchronized void load() {
        File file = new File(filePath);
        if (!file.exists() || file.length() == 0) {
            seedDefaultData();
            save();
            return;
        }

        try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream(file))) {
            DataStore loaded = (DataStore) ois.readObject();
            this.users = (loaded.users != null) ? loaded.users : new ArrayList<>();
            this.buses = (loaded.buses != null) ? loaded.buses : new ArrayList<>();
            this.bookings = (loaded.bookings != null) ? loaded.bookings : new ArrayList<>();
        } catch (Exception e) {
            System.err.println("Warning: Could not read " + filePath + " (" + e.getMessage() + "), initializing defaults.");
            seedDefaultData();
            save();
        }
    }

    public synchronized void save() {
        try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream(filePath))) {
            oos.writeObject(this);
        } catch (IOException e) {
            System.err.println("Error saving data to " + filePath + ": " + e.getMessage());
        }
    }

    public synchronized void seedDefaultData() {
        this.users = new ArrayList<>();
        this.buses = new ArrayList<>();
        this.bookings = new ArrayList<>();

        // SHA-256 for admin123: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
        // SHA-256 for pass123:  b06b8da468e228581775704bb8427f71cb32298e8bf9ad4914c810d7a969b914
        users.add(new User("admin", "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", "System Administrator", "ADMIN"));
        users.add(new User("rahul", "b06b8da468e228581775704bb8427f71cb32298e8bf9ad4914c810d7a969b914", "Rahul Sharma", "PASSENGER"));

        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        String today = sdf.format(new Date());

        Bus bus1 = new Bus("BUS-101", "Shivneri Volvo Super AC", "Mumbai", "Pune", "06:00 AM", 450.0, 28);
        bus1.markSeatsBooked(today, Arrays.asList(1, 2, 7, 8));

        Bus bus2 = new Bus("BUS-102", "Maharaja Sleeper Coach (2+1)", "Mumbai", "Goa", "08:30 PM", 1200.0, 24);
        bus2.markSeatsBooked(today, Arrays.asList(3, 4));

        Bus bus3 = new Bus("BUS-103", "Deccan Express Semi-Luxury", "Pune", "Nashik", "07:15 AM", 350.0, 28);
        Bus bus4 = new Bus("BUS-104", "Gujarat Express AC Multi-Axle", "Mumbai", "Ahmedabad", "10:00 PM", 850.0, 28);

        buses.add(bus1);
        buses.add(bus2);
        buses.add(bus3);
        buses.add(bus4);

        List<Passenger> roster = new ArrayList<>();
        roster.add(new Passenger(1, "Rahul Sharma", 24));
        roster.add(new Passenger(2, "Priya Sharma", 22));

        Booking initialBooking = new Booking(
                "ST-BK-1001",
                "rahul",
                "Rahul Sharma",
                "BUS-101",
                "Shivneri Volvo Super AC",
                "Mumbai",
                "Pune",
                today,
                "06:00 AM",
                Arrays.asList(1, 2),
                roster,
                450.0,
                "CONFIRMED",
                0.0,
                new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").format(new Date())
        );
        bookings.add(initialBooking);
    }
}
