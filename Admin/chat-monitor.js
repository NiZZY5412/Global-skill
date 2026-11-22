(() => {
    "use strict";

    const STORAGE_KEY = "talvora_chat_threads_v1";
    const threadNames = {
        "admin-general": "Admin inbox",
        "workplace-general": "Employer ↔ Employee"
    };
    const container = document.getElementById("chatThreads");

    const readThreads = () => {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            return value && typeof value === "object" ? value : {};
        } catch (_) {
            return {};
        }
    };

    const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));

    const formatDate = value => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    };

    function render() {
        const threads = readThreads();
        const entries = Object.entries(threads).filter(([, messages]) => Array.isArray(messages) && messages.length);
        if (!entries.length) {
            container.innerHTML = `<div class="chat-empty"><strong>No conversations yet.</strong><br>User-entered messages will appear here when the chat widget is used.</div>`;
            return;
        }
        container.innerHTML = entries.map(([threadId, messages]) => `
            <article class="chat-thread">
                <header class="chat-thread-header"><h2>${escape(threadNames[threadId] || threadId)}</h2><span>${messages.length} message${messages.length === 1 ? "" : "s"}</span></header>
                <div class="chat-thread-messages">${messages.map(message => `
                    <article class="chat-thread-message">
                        <strong>${escape(message.senderName || message.senderPortal || "User")}</strong>
                        <p>${escape(message.text)}</p>
                        <time>${escape(formatDate(message.createdAt))}</time>
                    </article>`).join("")}</div>
            </article>`).join("");
    }

    document.getElementById("refreshChats").addEventListener("click", render);
    window.addEventListener("storage", event => { if (event.key === STORAGE_KEY) render(); });
    render();
})();
