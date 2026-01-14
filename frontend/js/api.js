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

    // 1. Handle Login Redirects (401)
    if (response.status === 401 && !endpoint.includes("/auth/login")) {
        localStorage.removeItem("token");
        window.location.href = "index.html";
        return;
    }

    // 2. ✅ FIX: Handle "No Content" (204) for Deletes
    // If the server says "Success, but I have nothing to send back", we return null.
    if (response.status === 204) {
        return null;
    }

    // 3. Handle Errors
    if (!response.ok) {
        const error = await response.json().catch(() => ({})); // Safe parse
        throw new Error(error.message || "Something went wrong");
    }

    // 4. Return JSON
    return response.json();
}