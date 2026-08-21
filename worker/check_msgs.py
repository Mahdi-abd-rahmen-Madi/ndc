import win32com.client
import math
import sys

def check_warnings():
    robot_app = win32com.client.Dispatch("Robot.Application")
    project = robot_app.Project
    
    print("Checking engine messages...")
    calc_engine = project.CalcEngine
    messages = calc_engine.Messages
    count = messages.Count
    print(f"Total messages: {count}")
    
    for i in range(1, count + 1):
        msg = messages.Get(i)
        print(f"Message {i}:")
        print(f"  Description: {msg.Description}")
        print(f"  Node: {msg.Node}")
        print(f"  Bar: {msg.Bar}")
    
    print("Done checking.")

check_warnings()
