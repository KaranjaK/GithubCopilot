document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Add small helper to escape HTML when inserting user-provided strings
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Helper to compute initials for a participant (used for avatar)
  function initials(name) {
    if (!name || typeof name !== "string") return "";
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(s => s[0]?.toUpperCase() || "")
      .join("");
  }

  // Inject compact styles only if styles.css isn't already linked (avoid duplication)
  (function injectParticipantStyles() {
    if (document.querySelector('link[href="styles.css"]')) return;
    const css = `
      .activity-card { padding: 12px; border-radius: 8px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 12px; }
      .participants { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e6e6e6; display:block; }
      .participants-header { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
      .participants strong { margin:0; color:#333; }
      .participant-count { background:#eef6ff; color:#0366d6; font-weight:600; padding:2px 8px; border-radius:999px; font-size:12px; }
      .participants-list { margin:0; padding:0; color:#444; max-height:120px; overflow:auto; list-style:none; }
      .participant-item { display:flex; align-items:center; gap:8px; margin:6px 0; padding:4px 6px; border-radius:6px; transition:background .15s; }
      .participant-item:hover { background: #f7f9fc; }
      .participant-avatar { width:28px; height:28px; border-radius:50%; background:#e6f0ff; display:inline-flex; align-items:center; justify-content:center; color:#0366d6; font-weight:700; font-size:12px; flex:0 0 28px; }
      .participant-name { color:#222; }
      .no-participants { color:#777; font-style:italic; margin-top:6px; }
    `;
    const style = document.createElement("style");
    style.setAttribute("data-injected", "participants-styles");
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Clear activity select before populating
      activitySelect.innerHTML = '<option value="">Select an activity</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - (details.participants ? details.participants.length : 0);

        // Build participants HTML: pretty header with count and a styled bulleted list or friendly empty state
        const participants = Array.isArray(details.participants) ? details.participants : [];
          const participantsHtml = participants.length
           ? `<div class="participants-header"><strong>Participants</strong><span class="participant-count">${participants.length}</span></div>
             <ul class="participants-list">${participants.map(p => `<li class="participant-item"><span class="participant-avatar">${escapeHtml(initials(p))}</span><span class="participant-name">${escapeHtml(p)}</span><button class="participant-delete" data-email="${escapeHtml(p)}" aria-label="Remove participant">✖</button></li>`).join("")}</ul>`
           : `<div class="participants-header"><strong>Participants</strong><span class="participant-count">0</span></div><p class="no-participants">No participants yet</p>`;

        activityCard.innerHTML = `
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(details.description || "")}</p>
          <p><strong>Schedule:</strong> ${escapeHtml(details.schedule || "")}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants">
            ${participantsHtml}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Handle clicks on delete icons inside this activity card (event delegation)
        activityCard.addEventListener("click", async (ev) => {
          const target = ev.target;
          if (!target || !target.classList.contains("participant-delete")) return;

          const email = target.getAttribute("data-email");
          if (!email) return;

          // Optional: confirm before removing
          if (!confirm(`Remove ${email} from ${name}?`)) return;

          try {
            const resp = await fetch(`/activities/${encodeURIComponent(name)}/participants?email=${encodeURIComponent(email)}`, { method: "DELETE" });
            const result = await resp.json();

            if (resp.ok) {
              messageDiv.textContent = result.message;
              messageDiv.className = "success";
              // Refresh activities to update UI
              fetchActivities();
            } else {
              messageDiv.textContent = result.detail || "Failed to remove participant";
              messageDiv.className = "error";
            }
          } catch (error) {
            console.error("Error removing participant:", error);
            messageDiv.textContent = "Failed to remove participant. Please try again.";
            messageDiv.className = "error";
          }

          messageDiv.classList.remove("hidden");
          setTimeout(() => messageDiv.classList.add("hidden"), 5000);
        });
        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // Refresh activities to show the newly registered participant
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
