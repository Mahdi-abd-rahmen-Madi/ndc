# Add Note de Calcul (RTF) to Django Backend

Since you already added the verification screenshot, you just need to add the new `note_de_calcul` to your model and view.

## 1. Update your Django Model (`models.py`)

Add a `FileField` for the RTF file.

```python
# models.py
class Job(models.Model):
    # ... your existing fields (screenshot, verification_screenshot) ...
    
    # ADD THIS LINE for the RTF document:
    note_de_calcul = models.FileField(upload_to='notes_de_calcul/', null=True, blank=True)
```

Run migrations:
```bash
python manage.py makemigrations
python manage.py migrate
```

## 2. Update your API View (`views.py` or `api.py`)

Look for the key `note_de_calcul` in the `request.FILES` dictionary.

```python
# views.py / api.py

def complete_calculation(request, job_id):
    job = Job.objects.get(id=job_id)
    
    # ... (existing screenshot and verification_screenshot logic) ...

    # ADD THIS BLOCK:
    if 'note_de_calcul' in request.FILES:
        job.note_de_calcul = request.FILES['note_de_calcul']
        
    job.save()
    
    return JsonResponse({"message": "Job updated successfully"})
```

## 3. Update Django Admin (Optional)

Add it to `admin.py` to download the RTF from the admin panel.

```python
@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    # Add 'note_de_calcul' to your list_display
    list_display = ('id', 'status', 'screenshot', 'verification_screenshot', 'note_de_calcul')
```
