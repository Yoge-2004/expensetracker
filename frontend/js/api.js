const API_BASE_URL = "http://localhost:8080/api";

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` })
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
    });

    // 1. Handle Session Expiry (but not on login page)
    if (response.status === 401 && !endpoint.includes("/auth/login")) {
        localStorage.removeItem("token");
        window.location.href = "index.html";
        return;
    }

    // 2. Handle Empty Success Responses (like Update Password or Delete)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return null;
    }

    // 3. ✅ THE FIX: Smart Error Parsing
    if (!response.ok) {
        const text = await response.text(); // Get the raw text first

        try {
            const errorObj = JSON.parse(text); // Try to turn it into an object

            // If the backend gave us a specific 'message', use that.
            // This turns '{"message": "Invalid email..."}' into -> "Invalid email..."
            throw new Error(errorObj.message || errorObj.error || "Something went wrong");

        } catch (e) {
            // If the error was already extracted above, re-throw it
            if (e.message && e.message !== "Unexpected token" && !e.message.includes("JSON")) {
                throw e;
            }
            // Fallback: If it wasn't JSON, just show the raw text
            throw new Error(text || "Something went wrong");
        }
    }

    return response.json();
}