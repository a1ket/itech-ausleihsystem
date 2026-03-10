import { supabase } from "../supabase.js";

const form = document.getElementById("login-form");
const message = document.getElementById("message");

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#b00020" : "#065f46";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    setMessage("Bitte Benutzername und Passwort eingeben.", true);
    return;
  }

  setMessage("Anmeldung wird durchgeführt...");

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    setMessage("Login erfolgreich. Weiterleitung...");

    // kurze UX Pause
    setTimeout(() => {
      window.location.replace("/dashboard");
    }, 800);

  } catch (error) {
    console.error("Login error:", error);
    setMessage("Login fehlgeschlagen. Bitte Zugangsdaten prüfen.", true);
  }
});