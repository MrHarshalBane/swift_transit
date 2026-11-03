package com.swifttransit;

import com.swifttransit.model.Bus;
import com.swifttransit.server.SwiftTransitServer;
import com.swifttransit.service.BusReservationService;
import com.swifttransit.storage.DataStore;

import java.io.File;

/**
 * Main application launcher for the SwiftTransit Java Backend.
 */
public class Main {
    public static void main(String[] args) {
        int port = 8080;
        String portEnv = System.getenv("PORT");
        if (portEnv != null) {
            try {
                port = Integer.parseInt(portEnv.trim());
            } catch (NumberFormatException ignored) {}
        }
        if (args.length > 0) {
            try {
                port = Integer.parseInt(args[0].trim());
            } catch (NumberFormatException ignored) {}
        }

        // Initialize persistent DataStore (busdata.ser)
        DataStore dataStore = new DataStore("busdata.ser");
        BusReservationService service = new BusReservationService(dataStore);

        // Find web root directory (where index.html is located)
        File webDir = new File("..");
        if (!new File(webDir, "index.html").exists()) {
            webDir = new File(".");
        }
        if (!new File(webDir, "index.html").exists()) {
            webDir = new File("../..");
        }

        try {
            SwiftTransitServer server = new SwiftTransitServer(port, service, webDir);
            server.start();

            // Print summary
            System.out.println("Loaded " + dataStore.getBuses().size() + " active bus routes.");
            System.out.println("Loaded " + dataStore.getUsers().size() + " users.");
            System.out.println("Loaded " + dataStore.getBookings().size() + " existing bookings.");
            System.out.println("Press Ctrl+C to terminate.");
        } catch (Exception e) {
            System.err.println("Failed to start SwiftTransit server: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
