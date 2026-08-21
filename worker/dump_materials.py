import win32com.client

def main():
    try:
        robot_app = win32com.client.gencache.EnsureDispatch("Robot.Application")
        robot_app.Interactive = 0
        robot_app.Visible = 1
        
        project = robot_app.Project
        materials = project.Preferences.Materials
        
        valid_materials = []
        # 1 = I_MT_STEEL, 2 = I_MT_CONCRETE
        for mat_type in [1, 2]:
            names_array = materials.Get(mat_type)
            count = getattr(names_array, 'Count', 0)
            for i in range(1, count + 1):
                valid_materials.append(names_array.Get(i))
                
        with open("french_materials_dump.txt", "w") as f:
            for m in valid_materials:
                f.write(f"{m}\n")
        print(f"Dumped {len(valid_materials)} materials to french_materials_dump.txt")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
