import { supabase } from "../supabase.js";

const form = document.getElementById("login-form");
const messageEl = document.getElementById("message");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("toggle-password");

// Funktion zum Anzeigen von Meldungen
function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#b00" : "#044";
}

// Passwort ein/ausblenden
togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePassword.classList.toggle("active", isHidden);
  togglePassword.setAttribute("aria-label", isHidden ? "Passwort anzeigen" : "Passwort verbergen");
});

// Login-Formular
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    setMessage("Bitte Benutzername und Passwort eingeben.", true);
    return;
  }

  try {
    // Supabase Auth: Login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setMessage("Ungültige Anmeldedaten.", true);
      return;
    }

    if (!data.session) {
      setMessage("Fehler beim Einloggen. Keine Session erhalten.", true);
      return;
    }

    // Erfolgreich eingeloggt → Weiterleitung zur Main-Seite
    window.location.href = "/index.html";

  } catch (err) {
    console.error(err);
    setMessage("Fehler beim Einloggen.", true);
  }
});

// Optional: Prüfen, ob User bereits eingeloggt ist (falls er Login-Seite direkt aufruft)
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    // Schon eingeloggt → Main-Seite
    window.location.href = "/index.html";
  }
})();