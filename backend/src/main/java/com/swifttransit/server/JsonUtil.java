package com.swifttransit.server;

import com.swifttransit.model.*;

import java.util.*;

/**
 * Lightweight JSON utility for serialization and deserialization without external libraries.
 */
public class JsonUtil {

    public static String escape(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (ch < ' ') {
                        String hex = Integer.toHexString(ch);
                        sb.append("\\u").append("0000".substring(hex.length())).append(hex);
                    } else {
                        sb.append(ch);
                    }
            }
        }
        return sb.toString();
    }

    public static String userToJson(User u) {
        if (u == null) return "null";
        return "{" +
                "\"username\":\"" + escape(u.getUsername()) + "\"," +
                "\"fullName\":\"" + escape(u.getFullName()) + "\"," +
                "\"role\":\"" + escape(u.getRole()) + "\"" +
                "}";
    }

    public static String passengerToJson(Passenger p) {
        if (p == null) return "null";
        return "{" +
                "\"seatNumber\":" + p.getSeatNumber() + "," +
                "\"name\":\"" + escape(p.getName()) + "\"," +
                "\"age\":" + p.getAge() +
                "}";
    }

    public static String busToJson(Bus b) {
        if (b == null) return "null";
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"id\":\"").append(escape(b.getId())).append("\",");
        sb.append("\"name\":\"").append(escape(b.getName())).append("\",");
        sb.append("\"source\":\"").append(escape(b.getSource())).append("\",");
        sb.append("\"destination\":\"").append(escape(b.getDestination())).append("\",");
        sb.append("\"departureTime\":\"").append(escape(b.getDepartureTime())).append("\",");
        sb.append("\"fare\":").append(b.getFare()).append(",");
        sb.append("\"totalSeats\":").append(b.getTotalSeats()).append(",");
        sb.append("\"bookedSeatsByDate\":{");
        Map<String, List<Integer>> map = b.getBookedSeatsByDate();
        int mCount = 0;
        for (Map.Entry<String, List<Integer>> entry : map.entrySet()) {
            if (mCount++ > 0) sb.append(",");
            sb.append("\"").append(escape(entry.getKey())).append("\":[");
            List<Integer> seats = entry.getValue();
            for (int i = 0; i < seats.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(seats.get(i));
            }
            sb.append("]");
        }
        sb.append("}}");
        return sb.toString();
    }

    public static String bookingToJson(Booking bk) {
        if (bk == null) return "null";
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"bookingId\":\"").append(escape(bk.getBookingId())).append("\",");
        sb.append("\"passengerUsername\":\"").append(escape(bk.getPassengerUsername())).append("\",");
        sb.append("\"passengerFullName\":\"").append(escape(bk.getPassengerFullName())).append("\",");
        sb.append("\"busId\":\"").append(escape(bk.getBusId())).append("\",");
        sb.append("\"busName\":\"").append(escape(bk.getBusName())).append("\",");
        sb.append("\"source\":\"").append(escape(bk.getSource())).append("\",");
        sb.append("\"destination\":\"").append(escape(bk.getDestination())).append("\",");
        sb.append("\"travelDate\":\"").append(escape(bk.getTravelDate())).append("\",");
        sb.append("\"departureTime\":\"").append(escape(bk.getDepartureTime())).append("\",");
        sb.append("\"farePerSeat\":").append(bk.getFarePerSeat()).append(",");
        sb.append("\"totalFare\":").append(bk.getTotalFare()).append(",");
        sb.append("\"status\":\"").append(escape(bk.getStatus())).append("\",");
        sb.append("\"refundAmount\":").append(bk.getRefundAmount()).append(",");
        sb.append("\"createdAt\":\"").append(escape(bk.getCreatedAt())).append("\",");
        sb.append("\"seats\":[");
        for (int i = 0; i < bk.getSeats().size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(bk.getSeats().get(i));
        }
        sb.append("],\"passengers\":[");
        for (int i = 0; i < bk.getPassengers().size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(passengerToJson(bk.getPassengers().get(i)));
        }
        sb.append("]}");
        return sb.toString();
    }

    public static String busListToJson(List<Bus> list) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(busToJson(list.get(i)));
        }
        sb.append("]");
        return sb.toString();
    }

    public static String bookingListToJson(List<Booking> list) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(bookingToJson(list.get(i)));
        }
        sb.append("]");
        return sb.toString();
    }

    // Helper to extract a string field from flat JSON object
    public static String getString(String json, String key) {
        if (json == null) return null;
        String search = "\"" + key + "\"";
        int idx = json.indexOf(search);
        if (idx == -1) return null;
        int colon = json.indexOf(':', idx + search.length());
        if (colon == -1) return null;
        int start = json.indexOf('"', colon);
        if (start == -1) return null;
        int end = json.indexOf('"', start + 1);
        while (end != -1 && json.charAt(end - 1) == '\\') {
            end = json.indexOf('"', end + 1);
        }
        if (end == -1) return null;
        return json.substring(start + 1, end).replace("\\\"", "\"").replace("\\\\", "\\");
    }

    // Helper to extract double or int
    public static Double getDouble(String json, String key) {
        if (json == null) return null;
        String search = "\"" + key + "\"";
        int idx = json.indexOf(search);
        if (idx == -1) return null;
        int colon = json.indexOf(':', idx + search.length());
        if (colon == -1) return null;
        int i = colon + 1;
        while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
        int start = i;
        while (i < json.length() && (Character.isDigit(json.charAt(i)) || json.charAt(i) == '.' || json.charAt(i) == '-')) i++;
        if (start == i) return null;
        try {
            return Double.parseDouble(json.substring(start, i));
        } catch (Exception e) {
            return null;
        }
    }

    // Extract integer array: "seats": [1, 2, 3]
    public static List<Integer> getIntList(String json, String key) {
        List<Integer> list = new ArrayList<>();
        if (json == null) return list;
        String search = "\"" + key + "\"";
        int idx = json.indexOf(search);
        if (idx == -1) return list;
        int openBracket = json.indexOf('[', idx);
        int closeBracket = json.indexOf(']', openBracket);
        if (openBracket == -1 || closeBracket == -1) return list;
        String inside = json.substring(openBracket + 1, closeBracket).trim();
        if (inside.isEmpty()) return list;
        for (String item : inside.split(",")) {
            try {
                list.add(Integer.parseInt(item.trim()));
            } catch (Exception ignored) {}
        }
        return list;
    }

    // Extract list of Passenger objects: "passengers": [{"seatNumber":1,"name":"...","age":24}]
    public static List<Passenger> getPassengersList(String json) {
        List<Passenger> list = new ArrayList<>();
        if (json == null) return list;
        int idx = json.indexOf("\"passengers\"");
        if (idx == -1) return list;
        int openBracket = json.indexOf('[', idx);
        int closeBracket = json.indexOf(']', openBracket);
        if (openBracket == -1 || closeBracket == -1) return list;
        String inside = json.substring(openBracket + 1, closeBracket).trim();
        if (inside.isEmpty()) return list;

        String[] parts = inside.split("\\},\\s*\\{");
        for (String p : parts) {
            String block = p;
            if (!block.startsWith("{")) block = "{" + block;
            if (!block.endsWith("}")) block = block + "}";
            Double seat = getDouble(block, "seatNumber");
            String name = getString(block, "name");
            Double age = getDouble(block, "age");
            if (seat != null && name != null && age != null) {
                list.add(new Passenger(seat.intValue(), name, age.intValue()));
            }
        }
        return list;
    }
}
