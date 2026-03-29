import { supabase } from "../supabase.js";

const form = document.getElementById("login-form");
const messageEl = document.getElementById("message");

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#b00" : "#044";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    setMessage("Bitte alles eingeben", true);
    return;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single(); // 🔥 wichtig!

    if (error || !data) {
      setMessage("Login fehlgeschlagen", true);
      return;
    }

    // ✅ WICHTIG: speichern
    localStorage.setItem("loggedInUser", JSON.stringify({
      id: data.id,
      username: data.username
    }));

    console.log("LOGIN OK:", data);

    // 🔥 kurze Verzögerung (wichtig!)
    setTimeout(() => {
      window.location.href = "/";
    }, 200);

  } catch (err) {
    console.error(err);
    setMessage("Fehler beim Login", true);
  }
});