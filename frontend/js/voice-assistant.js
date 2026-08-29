// ==========================================
// SMART HOSPITAL AI VOICE ASSISTANT
// ==========================================


// ------------------------------------------
// GET HTML ELEMENTS
// ------------------------------------------

const chatArea = document.getElementById("chatArea");
const userMessage = document.getElementById("userMessage");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");
const typingIndicator = document.getElementById("typingIndicator");

const tokenForm = document.getElementById("tokenForm");
const bookingResult = document.getElementById("bookingResult");


// ==========================================
// ADD USER MESSAGE
// ==========================================

function addUserMessage(message) {

    const div = document.createElement("div");

    div.className = "message user-message";

    div.innerHTML = `
        <div class="message-content">
            <p>${escapeHTML(message)}</p>
        </div>

        <div class="message-avatar">
            👤
        </div>
    `;

    chatArea.appendChild(div);

    scrollChat();
}


// ==========================================
// ADD BOT MESSAGE
// ==========================================

function addBotMessage(message) {

    const div = document.createElement("div");

    div.className = "message bot-message";

    div.innerHTML = `
        <div class="message-avatar">
            🤖
        </div>

        <div class="message-content">
            <p>${formatBotMessage(message)}</p>
        </div>
    `;

    chatArea.appendChild(div);

    scrollChat();
}


// ==========================================
// FORMAT BOT MESSAGE
// ==========================================

function formatBotMessage(message) {

    return escapeHTML(message)
        .replace(/\n/g, "<br>");
}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


// ==========================================
// SCROLL CHAT
// ==========================================

function scrollChat() {

    chatArea.scrollTop = chatArea.scrollHeight;
}


// ==========================================
// SEND MESSAGE TO BACKEND
// ==========================================

async function sendMessage(message) {

    if (!message || message.trim() === "") {
        return;
    }

    // Show patient message
    addUserMessage(message);

    // Clear input
    userMessage.value = "";

    // Show typing
    typingIndicator.style.display = "block";

    try {

        const response = await fetch(
            "http://127.0.0.1:5000/chat",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    message: message,

                    // Later this can come from login
                    patient_id: "P001"
                })
            }
        );


        if (!response.ok) {

            throw new Error(
                "Server returned an error"
            );

        }


        const data = await response.json();


        // Hide typing
        typingIndicator.style.display = "none";


        // Show Llama response
        addBotMessage(data.response);


        // Speak response
        speakResponse(data.response);


    }
    catch (error) {

        console.error(
            "Backend Error:",
            error
        );


        typingIndicator.style.display = "none";


        addBotMessage(
            "❌ Unable to connect to SmartHospital AI. Please make sure the backend and Llama server are running."
        );

    }
}


// ==========================================
// SEND BUTTON
// ==========================================

sendBtn.addEventListener(
    "click",
    function () {

        const message =
            userMessage.value.trim();

        sendMessage(message);

    }
);


// ==========================================
// ENTER KEY
// ==========================================

userMessage.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {

            event.preventDefault();

            const message =
                userMessage.value.trim();

            sendMessage(message);

        }

    }
);


// ==========================================
// QUICK MESSAGE
// ==========================================

function sendQuickMessage(message) {

    userMessage.value = message;

    sendMessage(message);
}


// ==========================================
// VOICE RECOGNITION
// ==========================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


let recognition = null;


if (SpeechRecognition) {

    recognition =
        new SpeechRecognition();


    recognition.lang = "en-IN";

    recognition.continuous = false;

    recognition.interimResults = false;


    // --------------------------------------
    // START LISTENING
    // --------------------------------------

    voiceBtn.addEventListener(
        "click",
        function () {

            try {

                recognition.start();

                voiceBtn.classList.add(
                    "listening"
                );

                voiceBtn.innerHTML = "🔴";

            }
            catch (error) {

                console.log(
                    "Recognition already running"
                );

            }

        }
    );


    // --------------------------------------
    // SPEECH RESULT
    // --------------------------------------

    recognition.onresult =
        function (event) {

            const speech =
                event.results[0][0].transcript;


            console.log(
                "Patient said:",
                speech
            );


            // Put speech into input
            userMessage.value = speech;


            // Send to Llama
            sendMessage(speech);

        };


    // --------------------------------------
    // RECOGNITION END
    // --------------------------------------

    recognition.onend =
        function () {

            voiceBtn.classList.remove(
                "listening"
            );

            voiceBtn.innerHTML = "🎙️";

        };


    // --------------------------------------
    // RECOGNITION ERROR
    // --------------------------------------

    recognition.onerror =
        function (event) {

            console.error(
                "Voice Error:",
                event.error
            );


            voiceBtn.classList.remove(
                "listening"
            );

            voiceBtn.innerHTML = "🎙️";

        };

}
else {

    voiceBtn.addEventListener(
        "click",
        function () {

            alert(
                "Voice recognition is not supported in this browser. Please use Google Chrome."
            );

        }
    );

}


// ==========================================
// TEXT TO SPEECH
// ==========================================

function speakResponse(text) {

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }


    // Stop previous speech
    window.speechSynthesis.cancel();


    const speech =
        new SpeechSynthesisUtterance(text);


    speech.lang = "en-IN";

    speech.rate = 0.9;

    speech.pitch = 1;


    window.speechSynthesis.speak(
        speech
    );
}


// ==========================================
// NORMAL TOKEN FORM BOOKING
// ==========================================

if (tokenForm) {

    tokenForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const department =
                document.getElementById(
                    "department"
                ).value;


            const doctor =
                document.getElementById(
                    "doctor"
                ).value;


            const date =
                document.getElementById(
                    "appointmentDate"
                ).value;


            if (
                !department ||
                !doctor ||
                !date
            ) {

                return;

            }


            bookingResult.innerHTML = `
                <div class="success-message">
                    ⏳ Booking your token...
                </div>
            `;


            try {

                const response =
                    await fetch(
                        "http://127.0.0.1:5000/book-token",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({

                                patient_id: "P001",

                                department:
                                    department,

                                doctor:
                                    doctor,

                                date:
                                    date

                            })
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        "Booking failed"
                    );

                }


                const data =
                    await response.json();


                if (data.success) {

                    bookingResult.innerHTML = `

                        <div class="success-message">

                            ✅ Token booked successfully!

                            <br><br>

                            Token:
                            <strong>
                                #${data.token_id}
                            </strong>

                            <br>

                            Department:
                            <strong>
                                ${escapeHTML(data.department)}
                            </strong>

                            <br>

                            Doctor:
                            <strong>
                                ${escapeHTML(data.doctor)}
                            </strong>

                            <br>

                            Date:
                            <strong>
                                ${escapeHTML(data.date)}
                            </strong>

                        </div>

                    `;

                }
                else {

                    bookingResult.innerHTML = `

                        <div class="success-message">

                            ❌ ${escapeHTML(data.message)}

                        </div>

                    `;

                }

            }
            catch (error) {

                console.error(error);


                bookingResult.innerHTML = `

                    <div class="success-message">

                        ❌ Unable to connect to
                        SmartHospital server.

                    </div>

                `;

            }

        }
    );

}