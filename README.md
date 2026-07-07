# NDC Project

## Description
This project contains backend components for NDC (Network Data Center) operations.

## Structure
- `backend/` - Django backend application
  - `api/` - API endpoints
  - `geodata/` - Geographic data management
  - `data/` - Static data files
- `kvm_share/` - Directory shared between the Ubuntu host and Windows 10 VM
  - `test_robot.py` - Simple script to test Autodesk Robot COM interface connectivity
  - `robot_worker.py` - Worker daemon running in the Windows VM to poll jobs and perform calculations
  - `how to run the worker.txt` - PowerShell shortcut command to launch the worker

## Setup (Ubuntu Host)
1. Clone the repository.
2. Install dependencies: `pip install -r requirements.txt`.
3. Configure environment variables (copy `.env.example` to `.env`).
   - *Note:* Make sure `ALLOWED_HOSTS` includes the KVM virtual bridge IP (`192.168.122.1` or `*`) to permit the VM worker to connect to the backend.
4. Run migrations: `python manage.py migrate`.
5. Start development server:
   ```bash
   python manage.py runserver 0.0.0.0:8001
   ```
   *(Binding to `0.0.0.0` ensures the server listens on the virtual network bridge interface).*

## Autodesk Robot SDK Integration (Windows VM Worker)
Because Autodesk Robot Structural Analysis runs strictly on Windows, structural calculations are handled by a worker running inside a Windows 10 VM.

### 1. VM Configuration
- Configure a shared folder between your Ubuntu host and the Windows VM using virt-manager (mounts to `Z:\` in the guest VM).
- Run the command to register the COM server (if not already done):
  ```cmd
  "C:\Program Files\Autodesk\Autodesk Robot Structural Analysis Professional 2027\Exe\robot.exe" /RegServer
  ```
- Generate python early-bound COM bindings (highly recommended for performance):
  ```cmd
  python -m win32com.client.makepy
  ```

### 2. Running the Worker
In the Windows VM, launch the worker using the shared directory script:
```powershell
# Inside Windows VM:
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python Z:\robot_worker.py"
```
The worker will start polling the Django API on `http://192.168.122.1:8001/api/api/calculations/pending/` for tasks.

### 3. Testing the Integration
You can submit a mock job payload to the Django API from the Ubuntu host:
```bash
python backend/trigger_job.py
```
This queues a job on Django. The VM worker will detect it, connect to Autodesk Robot Structural Analysis via COM, run the calculations (including wind force calculations depending on `region` and `terrain_type`), and submit the results back to Django.

## License
[Add your license here]

