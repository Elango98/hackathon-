/* ================================================================
   SmartHospital — Unified JavaScript
   Handles: Login, Token Booking, Queue, Doctor Call-Next, Admin
   All API calls go to http://127.0.0.1:5000
   ================================================================ */

const API = "http://127.0.0.1:5000";


/* ================================================================
   STEP 3 — PATIENT LOGIN
   ================================================================ */

async function patientLogin(event) {

    event.preventDefault();

    const email    = document.getElementById("patientEmail").value.trim();
    const password = document.getElementById("patientPassword").value.trim();

    const btn = event.target.querySelector("button[type='submit']");
    btn.textContent = "Logging in...";
    btn.disabled    = true;

    try {

        const res  = await fetch(`${API}/login/patient`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (data.success) {

            // Save patient info to sessionStorage
            sessionStorage.setItem("patient_id",   data.patient_id);
            sessionStorage.setItem("patient_name", data.name);
            sessionStorage.setItem("patient_email", data.email);

            window.location.href = "patient-dashboard.html";

        } else {

            showError("loginError", data.message || "Login failed. Please check credentials.");
            btn.textContent = "Login";
            btn.disabled    = false;

        }

    } catch (err) {

        showError("loginError", "❌ Cannot connect to server. Please ensure Flask is running on port 5000.");
        btn.textContent = "Login";
        btn.disabled    = false;

    }

}


/* ================================================================
   DOCTOR LOGIN
   ================================================================ */

async function doctorLogin(event) {

    event.preventDefault();

    const doctor_id = document.getElementById("doctorId").value.trim();
    const password  = document.getElementById("doctorPassword").value.trim();

    const btn = event.target.querySelector("button[type='submit']");
    btn.textContent = "Logging in...";
    btn.disabled    = true;

    try {

        const res  = await fetch(`${API}/login/doctor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ doctor_id, password }),
        });

        const data = await res.json();

        if (data.success) {

            sessionStorage.setItem("doctor_id",   data.doctor_id);
            sessionStorage.setItem("doctor_name", data.name);
            sessionStorage.setItem("doctor_dept", data.department);

            window.location.href = "doctor-dashboard.html";

        } else {

            showError("loginError", data.message || "Invalid credentials.");
            btn.textContent = "Login";
            btn.disabled    = false;

        }

    } catch (err) {

        showError("loginError", "❌ Cannot connect to server. Ensure Flask is running on port 5000.");
        btn.textContent = "Login";
        btn.disabled    = false;

    }

}


/* ================================================================
   ADMIN LOGIN
   ================================================================ */

async function adminLogin(event) {

    event.preventDefault();

    const admin_id = document.getElementById("adminId").value.trim();
    const password = document.getElementById("adminPassword").value.trim();

    const btn = event.target.querySelector("button[type='submit']");
    btn.textContent = "Logging in...";
    btn.disabled    = true;

    try {

        const res  = await fetch(`${API}/login/admin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ admin_id, password }),
        });

        const data = await res.json();

        if (data.success) {

            sessionStorage.setItem("admin_name", data.name);
            window.location.href = "admin-dashboard.html";

        } else {

            showError("loginError", data.message || "Invalid admin credentials.");
            btn.textContent = "Login";
            btn.disabled    = false;

        }

    } catch (err) {

        showError("loginError", "❌ Cannot connect to server.");
        btn.textContent = "Login";
        btn.disabled    = false;

    }

}


/* ================================================================
   STEP 4 — BOOK TOKEN
   ================================================================ */

const tokenForm = document.getElementById("tokenForm");

if (tokenForm) {

    const deptSelect   = document.getElementById("department");
    const doctorSelect = document.getElementById("doctor");

    const selectedDepartment = document.getElementById("selectedDepartment");
    const selectedDoctor     = document.getElementById("selectedDoctor");


    /* Department → dynamically load doctors */

    deptSelect.addEventListener("change", async function () {

        const dept = deptSelect.value;
        selectedDepartment.textContent =
            dept ? deptSelect.options[deptSelect.selectedIndex].text : "Not selected";

        // Reset doctor
        doctorSelect.innerHTML = `<option value="">Loading doctors...</option>`;
        selectedDoctor.textContent = "Not selected";

        if (!dept) {
            doctorSelect.innerHTML = `<option value="">Choose Doctor</option>`;
            return;
        }

        try {

            const res  = await fetch(`${API}/doctors?dept=${dept}`);
            const data = await res.json();

            doctorSelect.innerHTML = `<option value="">Choose Doctor</option>`;

            if (data.doctors && data.doctors.length > 0) {
                data.doctors.forEach(d => {
                    const opt      = document.createElement("option");
                    opt.value      = d.doctor_id;
                    opt.textContent = `${d.name} (${d.qualification}, ${d.experience} yrs)`;
                    opt.dataset.name = d.name;
                    doctorSelect.appendChild(opt);
                });
            } else {
                doctorSelect.innerHTML = `<option value="">No doctors available</option>`;
            }

        } catch (err) {
            doctorSelect.innerHTML = `<option value="">Error loading doctors</option>`;
        }

    });


    /* Doctor selection display */

    doctorSelect.addEventListener("change", function () {
        const opt = doctorSelect.options[doctorSelect.selectedIndex];
        selectedDoctor.textContent = opt.dataset.name || opt.text || "Not selected";
    });


    /* Submit Token Form */

    tokenForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const patient_id   = sessionStorage.getItem("patient_id")   || "GUEST";
        const patient_name = sessionStorage.getItem("patient_name") || "Guest Patient";

        const doctor_id   = doctorSelect.value;
        const department  = deptSelect.value;
        const visit_type  = document.querySelector("input[name='visitType']:checked")?.value || "walkin";
        const symptoms    = document.getElementById("symptoms").value.trim();

        if (!doctor_id || !department) {
            alert("Please select a department and doctor.");
            return;
        }

        const btn = tokenForm.querySelector("button[type='submit']");
        btn.textContent = "Booking...";
        btn.disabled    = true;

        try {

            const res  = await fetch(`${API}/book-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patient_id, patient_name,
                    doctor_id, department,
                    visit_type, symptoms,
                }),
            });

            const data = await res.json();

            if (data.success) {

                /* Save token info */
                sessionStorage.setItem("token_id",  data.token_id);
                sessionStorage.setItem("token_dept", data.department);
                sessionStorage.setItem("token_position", data.position);

                /* Populate result */
                document.getElementById("generatedToken").textContent    = data.token_id;
                document.getElementById("resultDepartment").textContent  =
                    deptSelect.options[deptSelect.selectedIndex].text;
                document.getElementById("resultDoctor").textContent      = data.doctor_name;

                const ahead = document.getElementById("resultAhead");
                const wait  = document.getElementById("resultWait");
                if (ahead) ahead.textContent = data.position - 1;
                if (wait)  wait.textContent  = data.estimated_wait_minutes + " min";

                /* Hide form, show result */
                document.querySelector(".booking-card").style.display = "none";
                document.getElementById("tokenResult").classList.remove("hidden");
                document.getElementById("tokenResult").scrollIntoView({ behavior: "smooth" });

            } else {

                alert("Booking failed: " + (data.message || "Unknown error"));
                btn.textContent = "🎫 Confirm & Get Token";
                btn.disabled    = false;

            }

        } catch (err) {
            alert("❌ Cannot connect to server. Ensure Flask is running on port 5000.");
            btn.textContent = "🎫 Confirm & Get Token";
            btn.disabled    = false;
        }

    });

}


/* ================================================================
   STEP 5 — PATIENT DASHBOARD (Live Queue Status)
   ================================================================ */

async function loadPatientDashboard() {

    const patient_id   = sessionStorage.getItem("patient_id");
    const patient_name = sessionStorage.getItem("patient_name") || "Patient";

    // Update welcome text
    const welcomeEl = document.getElementById("welcomeName");
    if (welcomeEl) welcomeEl.textContent = patient_name;

    if (!patient_id) return;

    try {

        const res  = await fetch(`${API}/queue/patient/${patient_id}`);
        const data = await res.json();

        if (data.has_token) {

            setInnerText("dashTokenId",     data.token_id);
            setInnerText("dashAhead",        data.patients_ahead);
            setInnerText("dashWait",         data.estimated_wait + " min");
            setInnerText("dashDept",         data.department);
            setInnerText("dashDoctor",       data.doctor_name);

        } else {

            setInnerText("dashTokenId", "—");
            setInnerText("dashAhead",   "—");
            setInnerText("dashWait",    "—");

        }

    } catch (err) {
        console.warn("Could not load queue status:", err);
    }

}

// Auto-refresh every 30 seconds on patient dashboard
if (document.getElementById("dashTokenId")) {
    loadPatientDashboard();
    setInterval(loadPatientDashboard, 30000);
}


/* ================================================================
   STEP 6 — DOCTOR DASHBOARD (Queue + Call Next)
   ================================================================ */

async function loadDoctorDashboard() {

    const doctor_id   = sessionStorage.getItem("doctor_id");
    const doctor_name = sessionStorage.getItem("doctor_name") || "Doctor";

    const nameEl = document.getElementById("doctorName");
    if (nameEl) nameEl.textContent = doctor_name;

    if (!doctor_id) return;

    try {

        const res  = await fetch(`${API}/queue/doctor/${doctor_id}`);
        const data = await res.json();

        setInnerText("waitingCount",   data.waiting_count);
        setInnerText("completedCount", data.completed_count);
        setInnerText("todayCount",
            (data.waiting_count || 0) + (data.completed_count || 0));

        // Current patient (first in queue)
        const queue = data.queue || [];

        if (queue.length > 0) {
            setInnerText("currentToken",   queue[0].token_id);
            setInnerText("currentPatient", queue[0].patient_name);
        } else {
            setInnerText("currentToken",   "—");
            setInnerText("currentPatient", "No patients waiting");
        }

        // Render queue table
        const tbody = document.getElementById("queueTableBody");
        if (tbody) {

            tbody.innerHTML = "";

            if (queue.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">No patients in queue</td></tr>`;
            }

            queue.forEach((t, i) => {

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><strong>${t.token_id}</strong></td>
                    <td>${t.patient_name}</td>
                    <td><span class="status-badge waiting">Waiting</span></td>
                    <td>
                        ${i === 0
                            ? `<button class="call-btn" onclick="callNext()">📢 Call</button>`
                            : `<span style="color:#999;">#${t.position}</span>`
                        }
                    </td>
                `;
                tbody.appendChild(row);

            });

        }

    } catch (err) {
        console.warn("Could not load doctor queue:", err);
    }

}


async function callNext() {

    const doctor_id = sessionStorage.getItem("doctor_id");
    if (!doctor_id) return;

    const btn = document.querySelector(".call-btn");
    if (btn) { btn.textContent = "Calling..."; btn.disabled = true; }

    try {

        const res  = await fetch(`${API}/call-next`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ doctor_id }),
        });

        const data = await res.json();

        if (data.success) {

            showToast(`✅ Called ${data.called_token}. Next: ${data.next_patient || "Queue empty"}`);
            loadDoctorDashboard();  // Refresh

        } else {
            showToast(data.message || "No patients waiting.");
        }

    } catch (err) {
        showToast("❌ Cannot connect to server.");
    }

}


// Auto-load & refresh doctor dashboard
if (document.getElementById("queueTableBody")) {
    loadDoctorDashboard();
    setInterval(loadDoctorDashboard, 15000);
}


/* ================================================================
   STEP 7 — ADMIN DASHBOARD (Live Stats)
   ================================================================ */

async function loadAdminDashboard() {

    try {

        const res  = await fetch(`${API}/admin/stats`);
        const data = await res.json();

        setInnerText("statTotalPatients",  data.total_patients_today);
        setInnerText("statWaiting",        data.waiting_patients);
        setInnerText("statDoctors",        data.available_doctors);
        setInnerText("statEmergency",      data.emergency_cases);
        setInnerText("statCompleted",      data.completed_consultations);
        setInnerText("statAvgWait",        data.average_wait_minutes + " min");

        // Department queue breakdown
        const deptEl = document.getElementById("deptQueue");
        if (deptEl && data.department_queue) {

            const depts = data.department_queue;
            const labels = {
                general:     "General Medicine",
                cardiology:  "Cardiology",
                orthopedics: "Orthopedics",
                ent:         "ENT",
                dermatology: "Dermatology",
                pediatrics:  "Pediatrics",
            };

            deptEl.innerHTML = Object.keys(labels).map(key => {
                const count = depts[key] || 0;
                const level = count >= 5 ? "🔴 High" : count >= 3 ? "🟡 Medium" : "🟢 Low";
                return `<p>${labels[key]} — ${level} (${count} waiting)</p>`;
            }).join("");

        }

    } catch (err) {
        console.warn("Could not load admin stats:", err);
    }

}

// Auto-load admin dashboard
if (document.getElementById("statTotalPatients")) {
    loadAdminDashboard();
    setInterval(loadAdminDashboard, 20000);
}


/* ================================================================
   LOGOUT
   ================================================================ */

function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}


/* ================================================================
   UTILITIES
   ================================================================ */

function setInnerText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function showError(id, message) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = message;
        el.style.display = "block";
    } else {
        alert(message);
    }
}

function showToast(message) {
    const existing = document.getElementById("toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id    = "toast";
    toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px;
        background: #1f2937; color: white;
        padding: 14px 22px; border-radius: 12px;
        font-size: 15px; z-index: 9999;
        box-shadow: 0 8px 25px rgba(0,0,0,0.25);
        animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
