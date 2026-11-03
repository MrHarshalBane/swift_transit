#!/usr/bin/env bash
set -e

echo "========================================================"
echo " SwiftTransit Java Backend Startup Script"
echo "========================================================"

cd "$(dirname "$0")"

mkdir -p bin

echo "Compiling Java source files..."
javac -d bin src/main/java/com/swifttransit/model/*.java \
             src/main/java/com/swifttransit/storage/*.java \
             src/main/java/com/swifttransit/service/*.java \
             src/main/java/com/swifttransit/server/*.java \
             src/main/java/com/swifttransit/*.java

echo ""
echo "Starting SwiftTransit Java Server on http://localhost:8080 ..."
java -cp bin com.swifttransit.Main "$@"
