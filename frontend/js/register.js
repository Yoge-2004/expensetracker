document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    // ✅ Capture Name
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;

    try {
        await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }) // ✅ Send Name
        });

        alert("Registration successful! Please login.");
        window.location.href = "index.html";

    } catch (error) {
        alert(error.message);
    }
});