import { supabase } from "../supabase.js";

const form = document.getElementById("login-form");
const messageEl = document.getElementById("message");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("toggle-password");

// Hilfsfunktion für Statusmeldungen
function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#b00" : "#044";
}

// Passwort-Sichtbarkeit umschalten (Dein Toggle-Feature)
togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  
  // Icon-Status ändern (aktiviert/deaktiviert die Linie im Auge)
  togglePassword.classList.toggle("active", !isHidden);
});

// Login-Prozess
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Prüfe Daten...");

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    setMessage("Bitte alles ausfüllen.", true);
    return;
  }

  try {
    // Abfrage an Supabase
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single(); // Holt genau einen Datensatz

    if (error || !data) {
      setMessage("Login fehlgeschlagen. Daten prüfen.", true);
      console.error("Supabase Error:", error);
      return;
    }

    // Erfolgreich: Im LocalStorage speichern für index.html
    localStorage.setItem("loggedInUser", JSON.stringify({
      id: data.id,
      username: data.username
    }));

    setMessage("Erfolgreich! Leite weiter...");

    // Kleiner Delay für die UX, dann ab zur Hauptseite
    setTimeout(() => {
      window.location.href = "/";
    }, 600);

  } catch (err) {
    console.error("Systemfehler:", err);
    setMessage("Ein technischer Fehler ist aufgetreten.", true);
  }
});