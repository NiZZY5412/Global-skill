/* TALVORA shared frontend-only chat. Replace storage calls with API calls when available. */
(() => {
    "use strict";

    const STORAGE_KEY = "talvora_chat_threads_v1";
    const API_ORIGIN = String(window.TALVORA_APP_CONFIG?.apiOrigin || window.TALVORA_BACKEND_URL || "").replace(/\/$/, "");
    const currentPortal = () => {
        try { return sessionStorage.getItem("talvora_employer_access_token") ? "employer" : "employee"; }
        catch (_) { return "employee"; }
    };
    const actor = () => {
        const portal = currentPortal();
        try {
            const profile = JSON.parse(sessionStorage.getItem(`talvora_${portal}_user`) || "{}");
            return { id: profile.id || `${portal}-local`, name: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || (portal === "employer" ? "Employer" : "Employee"), portal };
        } catch (_) { return { id: `${portal}-local`, name: portal === "employer" ? "Employer" : "Employee", portal }; }
    };
    const readThreads = () => { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); return value && typeof value === "object" ? value : {}; } catch (_) { return {}; } };
    const writeThreads = threads => localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    const token = () => { try { return sessionStorage.getItem(`talvora_${currentPortal()}_access_token`) || ""; } catch (_) { return ""; } };
    async function apiMessages(channel) {
        if (!API_ORIGIN || !token()) return null;
        try {
            const response = await fetch(`${API_ORIGIN}/api/chat/${channel}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token()}` } });
            if (!response.ok) return null;
            const payload = await response.json();
            return payload?.data?.messages || [];
        } catch (_) { return null; }
    }
    async function sendApiMessage(channel, text) {
        if (!API_ORIGIN || !token()) return false;
        try {
            const response = await fetch(`${API_ORIGIN}/api/chat/${channel}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify({ text }) });
            return response.ok;
        } catch (_) { return false; }
    }
    const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const date = value => new Date(value).toLocaleString([], { hour: "numeric", minute: "2-digit" });

    function install() {
        if (document.getElementById("talvoraChatLauncher")) return;
        document.body.insertAdjacentHTML("beforeend", `
            <button class="talvora-chat-launcher" id="talvoraChatLauncher" type="button" aria-expanded="false" aria-controls="talvoraChatPanel"><span class="talvora-chat-launcher-icon">✉</span><span>Chat Admin</span></button>
            <section class="talvora-chat-panel" id="talvoraChatPanel" role="dialog" aria-label="TALVORA chat" hidden>
                <header class="talvora-chat-header"><div class="talvora-chat-heading"><span class="talvora-chat-avatar">T</span><div><h2 class="talvora-chat-title">TALVORA Conversations</h2><p class="talvora-chat-subtitle">Frontend preview · messages stay in this browser</p></div></div><button class="talvora-chat-close" id="talvoraChatClose" type="button" aria-label="Close chat">×</button></header>
                <div class="talvora-chat-tabs"><button class="talvora-chat-tab active" type="button" data-chat-channel="admin">Chat Admin</button><button class="talvora-chat-tab" type="button" data-chat-channel="workplace">Employer ↔ Employee</button></div>
                <p class="talvora-chat-note" id="talvoraChatNote"></p><div class="talvora-chat-messages" id="talvoraChatMessages"></div>
                <form class="talvora-chat-form" id="talvoraChatForm"><textarea class="talvora-chat-input" id="talvoraChatInput" rows="1" maxlength="2000" placeholder="Write a message..."></textarea><button class="talvora-chat-send" type="submit">Send</button></form>
            </section>`);
        let channel = "admin";
        const panel = document.getElementById("talvoraChatPanel");
        const messages = document.getElementById("talvoraChatMessages");
        const note = document.getElementById("talvoraChatNote");
        const render = async () => {
            const threadId = `${channel}-general`;
            const remote = await apiMessages(channel);
            const list = remote || readThreads()[threadId] || [];
            note.textContent = channel === "admin" ? "Messages go to the Admin inbox. Admin review is read-only in this frontend." : "Direct workplace chat for Employer and Employee accounts only. Admin cannot reply here.";
            messages.innerHTML = list.length ? list.map(item => `<article class="talvora-chat-message ${item.senderId === actor().id ? "mine" : ""}"><strong>${escape(item.senderName)}</strong><div>${escape(item.text).replace(/\n/g, "<br>")}</div><span class="talvora-chat-message-meta">${date(item.createdAt)}</span></article>`).join("") : `<div class="talvora-chat-empty">No messages yet. Start the conversation.</div>`;
            messages.scrollTop = messages.scrollHeight;
        };
        const toggle = open => { panel.hidden = !open; document.getElementById("talvoraChatLauncher").setAttribute("aria-expanded", String(open)); if (open) render(); };
        document.getElementById("talvoraChatLauncher").addEventListener("click", () => toggle(panel.hidden));
        document.getElementById("talvoraChatClose").addEventListener("click", () => toggle(false));
        document.querySelectorAll("[data-chat-channel]").forEach(button => button.addEventListener("click", () => { channel = button.dataset.chatChannel; document.querySelectorAll("[data-chat-channel]").forEach(item => item.classList.toggle("active", item === button)); render(); }));
        document.getElementById("talvoraChatForm").addEventListener("submit", async event => { event.preventDefault(); const input = document.getElementById("talvoraChatInput"); const text = input.value.trim(); if (!text) return; const sent = await sendApiMessage(channel, text); if (!sent) { const threads = readThreads(); const threadId = `${channel}-general`; const who = actor(); threads[threadId] = [...(threads[threadId] || []), { id: `message-${Date.now()}`, senderId: who.id, senderName: who.name, senderPortal: who.portal, recipient: channel === "admin" ? "admin" : "employer-employee", text, createdAt: new Date().toISOString() }]; writeThreads(threads); } input.value = ""; render(); });
        window.addEventListener("storage", event => { if (event.key === STORAGE_KEY) render(); });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
})();
