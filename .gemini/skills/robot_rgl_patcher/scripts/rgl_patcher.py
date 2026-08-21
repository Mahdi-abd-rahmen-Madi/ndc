import argparse
import os
import sys
import shutil
import json

def get_args():
    parser = argparse.ArgumentParser(description="Robot Structural Analysis RGL Patcher")
    subparsers = parser.add_subparsers(dest="command", required=True)

    backup_parser = subparsers.add_parser("backup")
    backup_parser.add_argument("--file", required=True, help="Path to the RGL file")
    backup_parser.add_argument("--output", help="Optional JSON output file path")

    restore_parser = subparsers.add_parser("restore")
    restore_parser.add_argument("--file", required=True, help="Path to the RGL file to restore")
    restore_parser.add_argument("--output", help="Optional JSON output file path")

    remove_parser = subparsers.add_parser("remove-lines")
    remove_parser.add_argument("--file", required=True, help="Path to the RGL file")
    remove_parser.add_argument("--prefix", required=True, help="Line prefix to remove (e.g. 'ALS:SEI')")
    remove_parser.add_argument("--output", help="Optional JSON output file path")

    return parser.parse_args()

def write_output(result, output_path=None):
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Success! Data written to: {output_path}")
    else:
        print(json.dumps(result, indent=2))

def cmd_backup(args):
    bak_path = args.file + ".bak"
    if not os.path.exists(args.file):
        sys.exit(f"Error: Base file not found at {args.file}")
        
    if not os.path.exists(bak_path):
        shutil.copy2(args.file, bak_path)
        write_output({"status": "success", "message": f"Created backup at {bak_path}"}, args.output)
    else:
        write_output({"status": "skipped", "message": f"Backup already exists at {bak_path}"}, args.output)

def cmd_restore(args):
    bak_path = args.file + ".bak"
    if not os.path.exists(bak_path):
        sys.exit(f"Error: Backup file not found at {bak_path}")
        
    shutil.copy2(bak_path, args.file)
    write_output({"status": "success", "message": f"Restored {args.file} from {bak_path}"}, args.output)

def cmd_remove_lines(args):
    bak_path = args.file + ".bak"
    if not os.path.exists(bak_path):
        sys.exit(f"Error: You must create a backup first using the 'backup' command before modifying the file.")
        
    try:
        with open(args.file, 'r', encoding='utf-16le') as f:
            lines = f.readlines()
            
        new_lines = []
        combinations_count = 0
        in_combinations_section = False
        removed_count = 0
        
        for line in lines:
            if line.startswith("COMBINATIONS:"):
                in_combinations_section = True
                new_lines.append("COMBINATIONS_PLACEHOLDER\n")
                continue
                
            if in_combinations_section and line.startswith(args.prefix):
                removed_count += 1
                continue
                
            if in_combinations_section and ":" in line and any(x in line for x in ["ULS:", "SLS:", "ALS:", "SPC:"]):
                combinations_count += 1
                
            new_lines.append(line)
            
        for i, line in enumerate(new_lines):
            if line == "COMBINATIONS_PLACEHOLDER\n":
                new_lines[i] = f"COMBINATIONS:{combinations_count}\n"
                
        with open(args.file, 'w', encoding='utf-16le') as f:
            f.writelines(new_lines)
            
        write_output({
            "status": "success", 
            "removed_count": removed_count,
            "new_combination_count": combinations_count,
            "message": f"Removed {removed_count} lines starting with '{args.prefix}'."
        }, args.output)
        
    except Exception as e:
        # Auto-restore on error
        if os.path.exists(bak_path):
            shutil.copy2(bak_path, args.file)
        sys.exit(f"Error: Failed to patch file: {e}. The file was automatically restored from backup.")

def main():
    args = get_args()
    if args.command == "backup":
        cmd_backup(args)
    elif args.command == "restore":
        cmd_restore(args)
    elif args.command == "remove-lines":
        cmd_remove_lines(args)

if __name__ == "__main__":
    main()
