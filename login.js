import { supabase } from "../supabase.js";

const form = document.getElementById("login-form");
const messageEl = document.getElementById("message");

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#b00" : "#044";
}

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
