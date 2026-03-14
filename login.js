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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    let errorMsg = "Login fehlgeschlagen.";
    if (error.message.includes("Invalid login credentials")) {
      errorMsg = "Ungültige Anmeldedaten.";
    }
    setMessage(errorMsg, true);
    return;
  }

  // Weiterleitung zur Hauptseite
  window.location.href = '/';
});
