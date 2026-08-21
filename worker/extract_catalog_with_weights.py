import win32com.client
import sys

def run():
    try:
        robot = win32com.client.Dispatch("Robot.Application")
    except Exception as e:
        print(e)
        return
    
    project = robot.Project
    if not project.IsActive:
        project.New(4)

    sec_databases = project.Preferences.SectionsActive
    count = sec_databases.Count
    
    target_dbs = ["RCAT", "OTUA"]
    
    out_lines = []
    out_lines.append("Robot Structural Analysis - Active Standard Sections (Filtered for France)")
    out_lines.append("=====================================================================")
    
    # Create ONE dummy label outside the loop to query properties efficiently
    try:
        dummy_label = project.Structure.Labels.Create(3, "TEMP_EXTRACT_LABEL")
        dummy_data = dummy_label.Data
    except Exception as e:
        print(f"Error creating dummy label: {e}")
        return

    for i in range(1, count + 1):
        db = sec_databases.GetDatabase(i)
        if not db: continue
        db_name = db.Name
        if db_name not in target_dbs: continue
        
        arr = db.GetAll()
        sec_count = arr.Count
        out_lines.append(f"\n### DATABASE: {db_name} ###")
        out_lines.append(f"Total sections: {sec_count}\n")
        
        for j in range(1, sec_count + 1):
            name = arr.Get(j)
            try:
                # Load section info into our single dummy data object
                if dummy_data.LoadFromDBase(name):
                    area_m2 = dummy_data.GetValue(0) # I_BSDV_A is 0
                    weight_kg_m = area_m2 * 7850
                    out_lines.append(f"{name:<20} | Weight: {weight_kg_m:6.2f} kg/m")
                else:
                    out_lines.append(f"{name:<20} | (Load Failed)")
            except Exception as e:
                out_lines.append(f"{name:<20} | (Error: {e})")
                
    with open("c:\\Users\\cometa\\KVM_Share\\docs\\standard_sections_catalog.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines))
        
    print("Done")

if __name__ == "__main__":
    run()
