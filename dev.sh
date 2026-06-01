#!/bin/bash

# Kill background processes on exit
trap 'kill $(jobs -p)' EXIT

# Start backend
echo "Starting backend server..."
cd backend
./venv/bin/python manage.py runserver 0.0.0.0:8001 &
BACKEND_PID=$!
cd ..

# Start frontend
echo "Starting frontend server..."
cd frontend
pnpm dev --host &
FRONTEND_PID=$!
cd ..

echo "Backend running on http://0.0.0.0:8001 (PID: $BACKEND_PID)"
echo "Frontend running on http://localhost:5173 (PID: $FRONTEND_PID)"
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait
