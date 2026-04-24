import { supabase } from "../supabase.js";

// --- DOM Referenzen ---
const form = document.getElementById("login-form");
const messageEl = document.getElementById("message");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("toggle-password");

// --- UI-Helper: Feedback-System ---
// Steuert die Anzeige von Statusmeldungen (Fehler/Erfolg) für den User
const setMessage = (text, isError = false) => {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#b00" : "#044";
};

// --- UX: Passwort-Sichtbarkeit ---
// Ermöglicht das Umschalten der Input-Type Eigenschaft zur besseren Kontrolle bei der Eingabe
togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePassword.classList.toggle("active", !isHidden);
});

// --- Geschäftslogik: Authentifizierungs-Flow ---
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Prüfe Daten...");

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  // Validierung: Inputs prüfen, bevor API-Request gestartet wird
  if (!username || !password) {
    return setMessage("Bitte alles ausfüllen.", true);
  }

  try {
    // Data-Layer: Abgleich der Credentials mit Supabase
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !data) {
      return setMessage("Login fehlgeschlagen. Daten prüfen.", true);
    }

    // State-Management: Session lokal im Browser speichern
    localStorage.setItem("loggedInUser", JSON.stringify({
      id: data.id,
      username: data.username
    }));

    setMessage("Erfolgreich! Leite weiter...");

    // Routing: Verzögerte Weiterleitung zur Hauptseite
    setTimeout(() => {
      window.location.replace("/");
    }, 500);

  } catch (err) {
    setMessage("Systemfehler.", true);
  }
});