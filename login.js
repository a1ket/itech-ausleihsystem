import { supabase } from "./supabase.js";

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

  setMessage("Anmeldung läuft …");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setMessage(error.message || "Login fehlgeschlagen.", true);
    return;
  }

  setMessage(`Erfolgreich angemeldet als ${data.user?.email ?? "Nutzer"}.`);
  // TODO: Weiterleitung / App starten
});
