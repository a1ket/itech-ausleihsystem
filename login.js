import { supabase } from "../supabase.js";

const form = document.getElementById("login-form");
const messageEl = document.getElementById("message");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("toggle-password");

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#b00" : "#044";
}

// Toggle Passwort-Sichtbarkeit
togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePassword.classList.toggle("active", isHidden);
  togglePassword.setAttribute("aria-label", isHidden ? "Passwort anzeigen" : "Passwort verbergen");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    setMessage("Bitte Benutzername und Passwort eingeben.", true);
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', email)
    .eq('password', password);

  if (error) {
    setMessage("Fehler beim Überprüfen der Daten.", true);
    return;
  }

  if (data.length === 0) {
    setMessage("Ungültige Anmeldedaten.", true);
    return;
  }

  // Erfolgreich – Weiterleitung zur Hauptseite
  window.location.href = '/';
});
