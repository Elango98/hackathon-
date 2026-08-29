"""
SmartHospital Backend API
Flask + CSV-based Patient Queue Management System
with Ollama AI Voice Assistant
"""
import sys
import io
# Fix Windows console UTF-8 encoding
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


from flask import Flask, request, jsonify
from flask_cors import CORS
import csv
import os
import uuid
from datetime import datetime

# ── Try importing Ollama (graceful fallback if not installed) ──────────────
try:
    from ollama import chat as ollama_chat
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    print("⚠️  Ollama not installed. /chat endpoint will return a mock reply.")

app = Flask(__name__)
CORS(app)

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
PATIENTS_CSV = os.path.join(BASE_DIR, "patients.csv")
DOCTORS_CSV  = os.path.join(BASE_DIR, "doctors.csv")
TOKENS_CSV   = os.path.join(BASE_DIR, "tokens.csv")

# ── Admin credentials (hardcoded) ──────────────────────────────────────────
ADMIN_ID       = "admin"
ADMIN_PASSWORD = "admin123"

# ── Ollama System Prompt ───────────────────────────────────────────────────
SYSTEM_PROMPT = """
You are the SmartHospital AI Assistant.

You help patients with:
1. Hospital token booking
2. Department information (General Medicine, Cardiology, Orthopedics, ENT, Dermatology, Pediatrics)
3. Doctor information
4. Token and queue status
5. Appointment guidance
6. Symptom → department routing

If a patient describes a health problem, suggest the appropriate hospital department.
Do NOT diagnose diseases. Do NOT pretend to be a doctor.
Keep answers short, simple, and helpful.
Always be warm and empathetic.
"""

# ── CSV Helpers ────────────────────────────────────────────────────────────

def read_csv(filepath):
    """Read CSV file and return list of dicts."""
    rows = []
    try:
        with open(filepath, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(dict(row))
    except FileNotFoundError:
        pass
    return rows


def write_csv(filepath, rows, fieldnames):
    """Write list of dicts to CSV file."""
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def append_csv_row(filepath, row):
    """Append a single row dict to an existing CSV."""
    with open(filepath, "a", newline="", encoding="utf-8") as f:
        # Read existing to get fieldnames
        pass
    # Read headers first
    with open(filepath, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

    with open(filepath, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writerow(row)


# ══════════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════════════════

@app.route("/login/patient", methods=["POST"])
def patient_login():
    """
    POST /login/patient
    Body: { "email": "...", "password": "..." }
    Returns patient info on success.
    """
    data     = request.get_json()
    email    = (data.get("email", "") or "").strip().lower()
    password = (data.get("password", "") or "").strip()

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password required."}), 400

    patients = read_csv(PATIENTS_CSV)
    for p in patients:
        if p["email"].strip().lower() == email and p["password"].strip() == password:
            return jsonify({
                "success": True,
                "patient_id": p["patient_id"],
                "name":       p["name"],
                "email":      p["email"],
                "phone":      p["phone"],
            })

    return jsonify({"success": False, "message": "Invalid email or password."}), 401


@app.route("/login/doctor", methods=["POST"])
def doctor_login():
    """
    POST /login/doctor
    Body: { "doctor_id": "D001", "password": "..." }
    """
    data      = request.get_json()
    doctor_id = (data.get("doctor_id", "") or "").strip().upper()
    password  = (data.get("password", "") or "").strip()

    if not doctor_id or not password:
        return jsonify({"success": False, "message": "Doctor ID and password required."}), 400

    doctors = read_csv(DOCTORS_CSV)
    for d in doctors:
        if d["doctor_id"].strip().upper() == doctor_id and d["password"].strip() == password:
            return jsonify({
                "success":    True,
                "doctor_id":  d["doctor_id"],
                "name":       d["name"],
                "department": d["department"],
            })

    return jsonify({"success": False, "message": "Invalid Doctor ID or password."}), 401


@app.route("/login/admin", methods=["POST"])
def admin_login():
    """
    POST /login/admin
    Body: { "admin_id": "admin", "password": "admin123" }
    """
    data       = request.get_json()
    admin_id   = (data.get("admin_id", "") or "").strip()
    password   = (data.get("password", "") or "").strip()

    if admin_id == ADMIN_ID and password == ADMIN_PASSWORD:
        return jsonify({"success": True, "name": "Hospital Admin"})

    return jsonify({"success": False, "message": "Invalid admin credentials."}), 401


# ══════════════════════════════════════════════════════════════════════
# DOCTOR LIST
# ══════════════════════════════════════════════════════════════════════

@app.route("/doctors", methods=["GET"])
def get_doctors():
    """
    GET /doctors?dept=cardiology
    Returns list of available doctors for a department.
    """
    dept    = request.args.get("dept", "").strip().lower()
    doctors = read_csv(DOCTORS_CSV)

    result = []
    for d in doctors:
        if dept and d["department"].strip().lower() != dept:
            continue
        if d.get("available", "yes").strip().lower() != "yes":
            continue
        result.append({
            "doctor_id":   d["doctor_id"],
            "name":        d["name"],
            "department":  d["department"],
            "qualification": d.get("qualification", ""),
            "experience":  d.get("experience_years", ""),
        })

    return jsonify({"doctors": result})


# ══════════════════════════════════════════════════════════════════════
# TOKEN BOOKING
# ══════════════════════════════════════════════════════════════════════

@app.route("/book-token", methods=["POST"])
def book_token():
    """
    POST /book-token
    Body: { patient_id, patient_name, doctor_id, department, visit_type, symptoms }
    Returns: { token_id, position, estimated_wait_minutes, doctor_name }
    """
    data         = request.get_json()
    patient_id   = (data.get("patient_id",   "") or "").strip()
    patient_name = (data.get("patient_name", "") or "").strip()
    doctor_id    = (data.get("doctor_id",    "") or "").strip().upper()
    department   = (data.get("department",   "") or "").strip().lower()
    visit_type   = (data.get("visit_type",   "walkin") or "walkin").strip()
    symptoms     = (data.get("symptoms",     "") or "").strip()

    if not patient_id or not doctor_id or not department:
        return jsonify({"success": False, "message": "patient_id, doctor_id, and department are required."}), 400

    # Get doctor name
    doctors     = read_csv(DOCTORS_CSV)
    doctor_name = doctor_id
    for d in doctors:
        if d["doctor_id"].strip().upper() == doctor_id:
            doctor_name = d["name"]
            break

    # Count current waiting position for this doctor
    tokens   = read_csv(TOKENS_CSV)
    waiting  = [t for t in tokens
                if t["doctor_id"].strip().upper() == doctor_id
                and t["status"].strip().lower() == "waiting"]
    position = len(waiting) + 1

    # Generate token ID like T006
    all_ids  = [t["token_id"] for t in tokens if t["token_id"].startswith("T")]
    next_num = len(all_ids) + 1
    token_id = f"T{next_num:03d}"

    # Build new row
    new_row = {
        "token_id":     token_id,
        "patient_id":   patient_id,
        "patient_name": patient_name,
        "doctor_id":    doctor_id,
        "doctor_name":  doctor_name,
        "department":   department,
        "visit_type":   visit_type,
        "symptoms":     symptoms,
        "status":       "waiting",
        "position":     position,
        "created_at":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    append_csv_row(TOKENS_CSV, new_row)

    estimated_wait = position * 8  # ~8 min per patient

    return jsonify({
        "success":               True,
        "token_id":              token_id,
        "position":              position,
        "estimated_wait_minutes": estimated_wait,
        "doctor_name":           doctor_name,
        "department":            department,
    })


# ══════════════════════════════════════════════════════════════════════
# QUEUE STATUS
# ══════════════════════════════════════════════════════════════════════

@app.route("/queue/patient/<patient_id>", methods=["GET"])
def queue_status_patient(patient_id):
    """
    GET /queue/patient/P001
    Returns the active (waiting) token for a patient.
    """
    tokens = read_csv(TOKENS_CSV)

    # Find latest active token for this patient
    active = [t for t in tokens
              if t["patient_id"].strip() == patient_id
              and t["status"].strip().lower() == "waiting"]

    if not active:
        return jsonify({"has_token": False, "message": "No active token found."})

    token = active[-1]  # most recent

    # Recalculate live position
    doctor_id = token["doctor_id"].strip().upper()
    waiting   = [t for t in tokens
                 if t["doctor_id"].strip().upper() == doctor_id
                 and t["status"].strip().lower() == "waiting"]

    # Sort by created_at to find position
    waiting.sort(key=lambda x: x.get("created_at", ""))
    position = 1
    for i, t in enumerate(waiting):
        if t["token_id"] == token["token_id"]:
            position = i + 1
            break

    return jsonify({
        "has_token":    True,
        "token_id":     token["token_id"],
        "doctor_name":  token["doctor_name"],
        "department":   token["department"],
        "visit_type":   token["visit_type"],
        "status":       token["status"],
        "position":     position,
        "patients_ahead": position - 1,
        "estimated_wait": (position - 1) * 8,
    })


@app.route("/queue/doctor/<doctor_id>", methods=["GET"])
def queue_doctor(doctor_id):
    """
    GET /queue/doctor/D001
    Returns the full queue for a doctor.
    """
    tokens   = read_csv(TOKENS_CSV)
    doctor_id = doctor_id.strip().upper()

    queue = [t for t in tokens
             if t["doctor_id"].strip().upper() == doctor_id
             and t["status"].strip().lower() == "waiting"]

    queue.sort(key=lambda x: x.get("created_at", ""))

    # Assign live positions
    for i, t in enumerate(queue):
        t["position"] = i + 1

    # Count completed today
    today     = datetime.now().strftime("%Y-%m-%d")
    completed = [t for t in tokens
                 if t["doctor_id"].strip().upper() == doctor_id
                 and t["status"].strip().lower() == "completed"
                 and t.get("created_at", "").startswith(today)]

    return jsonify({
        "doctor_id":       doctor_id,
        "waiting_count":   len(queue),
        "completed_count": len(completed),
        "queue":           queue,
    })


# ══════════════════════════════════════════════════════════════════════
# CALL NEXT (Doctor action)
# ══════════════════════════════════════════════════════════════════════

@app.route("/call-next", methods=["POST"])
def call_next():
    """
    POST /call-next
    Body: { "doctor_id": "D001" }
    Marks the first waiting token as 'completed' and returns the next patient.
    """
    data      = request.get_json()
    doctor_id = (data.get("doctor_id", "") or "").strip().upper()

    if not doctor_id:
        return jsonify({"success": False, "message": "doctor_id required."}), 400

    tokens = read_csv(TOKENS_CSV)

    # Find waiting tokens for this doctor, sorted by created_at
    waiting = [t for t in tokens
               if t["doctor_id"].strip().upper() == doctor_id
               and t["status"].strip().lower() == "waiting"]
    waiting.sort(key=lambda x: x.get("created_at", ""))

    if not waiting:
        return jsonify({"success": False, "message": "No patients waiting.", "queue_empty": True})

    # Mark the first one as completed
    first_token_id = waiting[0]["token_id"]
    for t in tokens:
        if t["token_id"] == first_token_id:
            t["status"]   = "completed"
            t["position"] = "0"
            break

    # Recalculate positions for remaining waiting tokens
    still_waiting = [t for t in tokens
                     if t["doctor_id"].strip().upper() == doctor_id
                     and t["status"].strip().lower() == "waiting"]
    still_waiting.sort(key=lambda x: x.get("created_at", ""))
    for i, t in enumerate(still_waiting):
        for row in tokens:
            if row["token_id"] == t["token_id"]:
                row["position"] = str(i + 1)

    # Write back
    fieldnames = list(tokens[0].keys()) if tokens else []
    write_csv(TOKENS_CSV, tokens, fieldnames)

    # Determine the new current patient
    new_first = still_waiting[0] if still_waiting else None

    return jsonify({
        "success":           True,
        "called_token":      first_token_id,
        "next_patient":      new_first["patient_name"] if new_first else None,
        "next_token_id":     new_first["token_id"]     if new_first else None,
        "remaining_waiting": len(still_waiting),
    })


# ══════════════════════════════════════════════════════════════════════
# ADMIN STATS
# ══════════════════════════════════════════════════════════════════════

@app.route("/admin/stats", methods=["GET"])
def admin_stats():
    """
    GET /admin/stats
    Returns aggregate hospital statistics.
    """
    tokens  = read_csv(TOKENS_CSV)
    doctors = read_csv(DOCTORS_CSV)
    patients = read_csv(PATIENTS_CSV)

    today = datetime.now().strftime("%Y-%m-%d")

    total_tokens    = [t for t in tokens if t.get("created_at","").startswith(today)]
    waiting_tokens  = [t for t in total_tokens if t["status"].strip().lower() == "waiting"]
    completed_tokens = [t for t in total_tokens if t["status"].strip().lower() == "completed"]

    available_doctors = [d for d in doctors if d.get("available","yes").strip().lower() == "yes"]

    # Department-wise queue counts
    dept_counts = {}
    for t in waiting_tokens:
        dept = t.get("department","unknown").strip().lower()
        dept_counts[dept] = dept_counts.get(dept, 0) + 1

    # Average wait time (rough: 8 min per patient)
    avg_wait = 0
    if waiting_tokens:
        positions = [int(t.get("position", 1)) for t in waiting_tokens]
        avg_wait  = int(sum(positions) * 8 / len(positions)) if positions else 0

    return jsonify({
        "total_patients_today":    len(set(t["patient_id"] for t in total_tokens)),
        "waiting_patients":        len(waiting_tokens),
        "completed_consultations": len(completed_tokens),
        "available_doctors":       len(available_doctors),
        "total_doctors":           len(doctors),
        "emergency_cases":         0,   # placeholder
        "average_wait_minutes":    avg_wait,
        "department_queue":        dept_counts,
        "total_registered_patients": len(patients),
    })


# ══════════════════════════════════════════════════════════════════════
# OLLAMA VOICE ASSISTANT
# ══════════════════════════════════════════════════════════════════════

@app.route("/chat", methods=["POST"])
def chat_with_ai():
    """
    POST /chat
    Body: { "message": "...", "context": { ... } }
    Returns AI reply from Ollama (llama3.2:3b).
    """
    try:
        data         = request.get_json()
        user_message = (data.get("message", "") or "").strip()
        context      = data.get("context", {})

        print("USER:", user_message)

        if not user_message:
            return jsonify({"reply": "Please say something! How can I help you today?"})

        # Enrich system prompt with patient context if provided
        enriched_prompt = SYSTEM_PROMPT
        if context:
            enriched_prompt += f"""

Current patient context:
- Patient: {context.get('patient_name', 'Unknown')}
- Department booked: {context.get('department', 'None')}
- Token: {context.get('token_id', 'None')}
- Queue position: {context.get('position', 'Unknown')}
"""

        if not OLLAMA_AVAILABLE:
            # Mock reply for testing without Ollama
            mock_reply = (
                f"Hello! I'm the SmartHospital AI Assistant. "
                f"You said: '{user_message}'. "
                f"Ollama is not installed, so this is a mock reply. "
                f"Please install Ollama and run 'ollama pull llama3.2:3b' to enable real AI responses."
            )
            return jsonify({"reply": mock_reply})

        response = ollama_chat(
            model="llama3.2:3b",
            messages=[
                {"role": "system",  "content": enriched_prompt},
                {"role": "user",    "content": user_message},
            ]
        )

        reply = response["message"]["content"]
        print("LLAMA:", reply)

        return jsonify({"reply": reply})

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"reply": f"❌ AI error: {str(e)}. Please ensure Ollama is running."}), 500


# ══════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":          "ok",
        "server":          "SmartHospital API",
        "ollama_available": OLLAMA_AVAILABLE,
        "timestamp":       datetime.now().isoformat(),
    })


# ══════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 45)
    print("  SmartHospital Backend API")
    print("  Flask + CSV + Ollama (llama3.2:3b)")
    print("=" * 45)
    print("  Server : http://127.0.0.1:5000")
    print("  Health : http://127.0.0.1:5000/health")
    print("=" * 45)

    app.run(host="127.0.0.1", port=5000, debug=True)