package com.swifttransit.server;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import com.swifttransit.model.*;
import com.swifttransit.service.BusReservationService;
import com.swifttransit.storage.DataStore;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.Executors;

/**
 * SwiftTransit HTTP REST API & Static Asset Server.
 * Built using JDK built-in com.sun.net.httpserver.HttpServer (Zero external dependencies).
 */
public class SwiftTransitServer {
    private final int port;
    private final BusReservationService service;
    private final File webRootDir;
    private HttpServer server;

    public SwiftTransitServer(int port, BusReservationService service, File webRootDir) {
        this.port = port;
        this.service = service;
        this.webRootDir = webRootDir;
    }

    public void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newFixedThreadPool(16));

        // API Context
        server.createContext("/api/", new ApiHandler(service));

        // Static Web Context (serves frontend)
        server.createContext("/", new StaticFileHandler(webRootDir));

        server.start();
        System.out.println("=================================================");
        System.out.println(" SwiftTransit Java Backend Server Online");
        System.out.println(" Port: " + port);
        System.out.println(" Web UI: http://localhost:" + port);
        System.out.println(" API:    http://localhost:" + port + "/api/health");
        System.out.println(" Data:   busdata.ser");
        System.out.println("=================================================");
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    // Static File Serving Handler
    static class StaticFileHandler implements HttpHandler {
        private final File baseDir;

        public StaticFileHandler(File baseDir) {
            this.baseDir = baseDir;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if (path.startsWith("/api/")) {
                exchange.sendResponseHeaders(404, -1);
                return;
            }
            if ("/".equals(path) || path.isEmpty()) {
                path = "/index.html";
            }

            File requestedFile = new File(baseDir, path.replace('/', File.separatorChar));
            if (!requestedFile.exists() || requestedFile.isDirectory()) {
                requestedFile = new File(baseDir, "index.html");
            }

            if (!requestedFile.exists()) {
                String notFound = "404 Not Found";
                exchange.sendResponseHeaders(404, notFound.length());
                exchange.getResponseBody().write(notFound.getBytes(StandardCharsets.UTF_8));
                exchange.close();
                return;
            }

            String contentType = "text/plain";
            String name = requestedFile.getName().toLowerCase();
            if (name.endsWith(".html")) contentType = "text/html; charset=UTF-8";
            else if (name.endsWith(".css")) contentType = "text/css; charset=UTF-8";
            else if (name.endsWith(".js")) contentType = "application/javascript; charset=UTF-8";
            else if (name.endsWith(".json")) contentType = "application/json; charset=UTF-8";
            else if (name.endsWith(".svg")) contentType = "image/svg+xml";
            else if (name.endsWith(".png")) contentType = "image/png";

            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            byte[] bytes = Files.readAllBytes(requestedFile.toPath());
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    // REST API Router
    static class ApiHandler implements HttpHandler {
        private final BusReservationService service;

        public ApiHandler(BusReservationService service) {
            this.service = service;
        }

        private void setCorsHeaders(HttpExchange exchange) {
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
        }

        private void sendJson(HttpExchange exchange, int statusCode, String jsonResponse) throws IOException {
            setCorsHeaders(exchange);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
            byte[] bytes = jsonResponse.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(statusCode, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }

        private void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
            String json = "{\"success\":false,\"error\":\"" + JsonUtil.escape(message) + "\"}";
            sendJson(exchange, statusCode, json);
        }

        private String readBody(HttpExchange exchange) throws IOException {
            try (InputStream is = exchange.getRequestBody();
                 BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                return sb.toString();
            }
        }

        private Map<String, String> getQueryParams(String query) {
            Map<String, String> params = new HashMap<>();
            if (query == null || query.isEmpty()) return params;
            for (String pair : query.split("&")) {
                int eq = pair.indexOf('=');
                if (eq > 0) {
                    try {
                        String k = URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8.name());
                        String v = URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8.name());
                        params.put(k, v);
                    } catch (Exception ignored) {}
                }
            }
            return params;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            setCorsHeaders(exchange);
            String method = exchange.getRequestMethod().toUpperCase();
            if ("OPTIONS".equals(method)) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }

            String path = exchange.getRequestURI().getPath();
            String query = exchange.getRequestURI().getQuery();
            Map<String, String> params = getQueryParams(query);

            try {
                if ("/api/health".equals(path) && "GET".equals(method)) {
                    sendJson(exchange, 200, "{\"success\":true,\"status\":\"UP\",\"engine\":\"Java 26 HTTP Server\",\"version\":\"1.0.0\"}");
                }
                // Auth: Register
                else if ("/api/auth/register".equals(path) && "POST".equals(method)) {
                    String body = readBody(exchange);
                    String username = JsonUtil.getString(body, "username");
                    String passwordHash = JsonUtil.getString(body, "passwordHash");
                    String fullName = JsonUtil.getString(body, "fullName");
                    String role = JsonUtil.getString(body, "role");

                    User u = service.registerUser(username, passwordHash, fullName, role);
                    sendJson(exchange, 201, "{\"success\":true,\"user\":" + JsonUtil.userToJson(u) + "}");
                }
                // Auth: Login
                else if ("/api/auth/login".equals(path) && "POST".equals(method)) {
                    String body = readBody(exchange);
                    String username = JsonUtil.getString(body, "username");
                    String passwordHash = JsonUtil.getString(body, "passwordHash");

                    User u = service.loginUser(username, passwordHash);
                    if (u != null) {
                        sendJson(exchange, 200, "{\"success\":true,\"user\":" + JsonUtil.userToJson(u) + "}");
                    } else {
                        sendError(exchange, 401, "Invalid username or password credentials.");
                    }
                }
                // Buses: Search / List
                else if ("/api/buses".equals(path) && "GET".equals(method)) {
                    String source = params.get("source");
                    String destination = params.get("destination");
                    String date = params.get("date");

                    List<Bus> buses;
                    if (date != null && !date.trim().isEmpty()) {
                        buses = service.searchBuses(source, destination, date);
                    } else {
                        buses = service.getDataStore().getBuses();
                    }
                    sendJson(exchange, 200, "{\"success\":true,\"buses\":" + JsonUtil.busListToJson(buses) + "}");
                }
                // Buses: Add (Admin)
                else if ("/api/buses".equals(path) && "POST".equals(method)) {
                    String body = readBody(exchange);
                    String id = JsonUtil.getString(body, "id");
                    String name = JsonUtil.getString(body, "name");
                    String source = JsonUtil.getString(body, "source");
                    String destination = JsonUtil.getString(body, "destination");
                    String departureTime = JsonUtil.getString(body, "departureTime");
                    Double fare = JsonUtil.getDouble(body, "fare");
                    Double seats = JsonUtil.getDouble(body, "totalSeats");

                    Bus b = new Bus(id, name, source, destination, departureTime,
                            fare != null ? fare : 400.0,
                            seats != null ? seats.intValue() : 28);
                    Bus added = service.addBus(b);
                    sendJson(exchange, 201, "{\"success\":true,\"bus\":" + JsonUtil.busToJson(added) + "}");
                }
                // Buses: Remove (Admin)
                else if ("/api/buses".equals(path) && "DELETE".equals(method)) {
                    String busId = params.get("id");
                    if (busId == null || busId.trim().isEmpty()) {
                        String body = readBody(exchange);
                        busId = JsonUtil.getString(body, "id");
                    }
                    if (busId == null || busId.trim().isEmpty()) {
                        sendError(exchange, 400, "Bus ID required.");
                        return;
                    }
                    service.removeBus(busId);
                    sendJson(exchange, 200, "{\"success\":true,\"message\":\"Bus " + JsonUtil.escape(busId) + " removed successfully.\"}");
                }
                // Bookings: List
                else if ("/api/bookings".equals(path) && "GET".equals(method)) {
                    String username = params.get("username");
                    List<Booking> list = (username != null && !username.trim().isEmpty())
                            ? service.getUserBookings(username)
                            : service.getAllBookings();
                    sendJson(exchange, 200, "{\"success\":true,\"bookings\":" + JsonUtil.bookingListToJson(list) + "}");
                }
                // Bookings: Create
                else if ("/api/bookings".equals(path) && "POST".equals(method)) {
                    String body = readBody(exchange);
                    String username = JsonUtil.getString(body, "username");
                    String fullName = JsonUtil.getString(body, "fullName");
                    String busId = JsonUtil.getString(body, "busId");
                    String travelDate = JsonUtil.getString(body, "travelDate");
                    List<Integer> seats = JsonUtil.getIntList(body, "seats");
                    List<Passenger> roster = JsonUtil.getPassengersList(body);

                    Booking bk = service.createBooking(username, fullName, busId, travelDate, seats, roster);
                    sendJson(exchange, 201, "{\"success\":true,\"booking\":" + JsonUtil.bookingToJson(bk) + "}");
                }
                // Bookings: Cancel
                else if ("/api/bookings/cancel".equals(path) && "POST".equals(method)) {
                    String body = readBody(exchange);
                    String bookingId = JsonUtil.getString(body, "bookingId");
                    String username = JsonUtil.getString(body, "username");
                    String role = JsonUtil.getString(body, "role");
                    boolean isAdmin = "ADMIN".equalsIgnoreCase(role);

                    Booking cancelled = service.cancelBooking(bookingId, username, isAdmin);
                    sendJson(exchange, 200, "{\"success\":true,\"booking\":" + JsonUtil.bookingToJson(cancelled) + "}");
                } else {
                    sendError(exchange, 404, "Endpoint not found: " + path);
                }
            } catch (IllegalArgumentException | IllegalStateException e) {
                sendError(exchange, 400, e.getMessage());
            } catch (SecurityException e) {
                sendError(exchange, 403, e.getMessage());
            } catch (Exception e) {
                e.printStackTrace();
                sendError(exchange, 500, "Internal server error: " + e.getMessage());
            }
        }
    }
}
