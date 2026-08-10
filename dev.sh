#!/bin/bash

# Kill background processes on exit
trap 'kill $(jobs -p)' EXIT

# Enable inspect mode for development
export INSPECT_MODE=true

# Start backend
echo "Starting backend server..."
cd backend
./venv/bin/python manage.py runserver 0.0.0.0:8001 &
BACKEND_PID=$!
cd ..
# Start Django Q2 Cluster
echo "Starting Django Q2 background worker..."
cd backend
./venv/bin/python manage.py qcluster &
QCLUSTER_PID=$!
cd ..

# Start frontend
echo "Starting frontend server..."
cd frontend
pnpm dev --host &
FRONTEND_PID=$!
cd ..

echo "Backend running on http://0.0.0.0:8001 (PID: $BACKEND_PID)"
echo "QCluster running in background (PID: $QCLUSTER_PID)"
echo "Frontend running on http://localhost:5173 (PID: $FRONTEND_PID)"
echo "Press Ctrl+C to stop all servers"

# Wait for both processes
wait
