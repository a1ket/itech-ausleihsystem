import { supabase } from "../supabase.js";

const form = document.getElementById("login-form");
const messageEl = document.getElementById("message");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("toggle-password");

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#b00" : "#044";
}

togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePassword.classList.toggle("active", !isHidden);
});

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
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !data) {
      setMessage("Login fehlgeschlagen. Daten prüfen.", true);
      return;
    }

    // Erfolg: Wir speichern das Objekt exakt so, wie index.html es braucht
    localStorage.setItem("loggedInUser", JSON.stringify({
      id: data.id,
      username: data.username
    }));

    setMessage("Erfolgreich! Leite weiter...");

    setTimeout(() => {
      // Wir springen eine Ebene hoch zur Hauptseite
      window.location.replace("/");
    }, 500);

  } catch (err) {
    setMessage("Systemfehler.", true);
  }
});