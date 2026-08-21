import win32com.client
import os

try:
    robot_app = win32com.client.gencache.EnsureDispatch("Robot.Application")
    project = robot_app.Project
    view = project.ViewMngr.GetView(1)
    
    if view:
        print("View found. Attempting to save...")
        # IRobotOutputFileFormat values: 0=BMP, 1=JPG, 2=PNG (approximate, let's try passing 1 for JPG, 2 for PNG)
        # Actually in COM, we might just pass 1 or 2
        file_path_jpg = os.path.join(os.getcwd(), "native_capture.jpg")
        # Try JPG (1)
        try:
            view.Printable.SaveToFile(file_path_jpg, 1)
            print(f"Saved JPG to: {file_path_jpg}")
        except Exception as e:
            print(f"Failed to save JPG: {e}")
            
        file_path_png = os.path.join(os.getcwd(), "native_capture.png")
        # Try PNG (2)
        try:
            view.Printable.SaveToFile(file_path_png, 2)
            print(f"Saved PNG to: {file_path_png}")
        except Exception as e:
            print(f"Failed to save PNG: {e}")
    else:
        print("No active view found.")
except Exception as e:
    print(f"Error: {e}")
