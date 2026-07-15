const adminRoot = document.querySelector("[data-admin-root]");

if (adminRoot) {
  const loginPanel = adminRoot.querySelector("[data-admin-login]");
  const workspace = adminRoot.querySelector("[data-admin-workspace]");
  const loginForm = adminRoot.querySelector("[data-login-form]");
  const loginStatus = adminRoot.querySelector("[data-login-status]");
  const form = adminRoot.querySelector("[data-entry-form]");
  const list = adminRoot.querySelector("[data-entry-list]");
  const sectionEditor = adminRoot.querySelector("[data-section-editor]");
  const editorTitle = adminRoot.querySelector("[data-editor-title]");
  const editorStatus = adminRoot.querySelector("[data-editor-status]");
  const deleteButton = adminRoot.querySelector("[data-delete-entry]");
  let entries = [];

  const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Request failed.");
    return payload;
  };

  const addSection = (section = {}) => {
    const row = document.createElement("fieldset");
    row.className = "section-editor-row";
    row.innerHTML = `<legend>Page section</legend><label>Section title<input data-section-title maxlength="180" value="${escapeHtml(section.title || "")}" /></label><label>Section text<textarea data-section-body rows="7" maxlength="20000">${escapeHtml(section.body || "")}</textarea></label><button class="text-command danger" type="button" data-remove-section>Remove section</button>`;
    row.querySelector("[data-remove-section]").addEventListener("click", () => row.remove());
    sectionEditor.append(row);
  };

  const renderList = () => {
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "No supplemental entries have been created.";
      list.append(empty);
      return;
    }
    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-entry-item";
      button.innerHTML = `<span>${escapeHtml(entry.entryType.replaceAll("-", " "))}${entry.published ? "" : " · draft"}</span><strong>${escapeHtml(entry.title)}</strong>`;
      button.addEventListener("click", () => editEntry(entry));
      list.append(button);
    });
  };

  const resetEditor = () => {
    form.reset();
    form.elements.id.value = "";
    form.elements.order.value = "1000";
    form.elements.published.value = "true";
    sectionEditor.replaceChildren();
    addSection();
    editorTitle.textContent = "New entry";
    editorStatus.textContent = "";
    deleteButton.hidden = true;
  };

  const editEntry = (entry) => {
    resetEditor();
    for (const name of ["id", "entryType", "identifier", "title", "summary", "division", "source", "imageUrl", "order"]) form.elements[name].value = entry[name] ?? "";
    form.elements.published.value = String(Boolean(entry.published));
    sectionEditor.replaceChildren();
    (entry.sections.length ? entry.sections : [{}]).forEach(addSection);
    editorTitle.textContent = entry.title;
    deleteButton.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadEntries = async () => {
    const payload = await request("/api/admin/entries");
    entries = payload.entries || [];
    entries.sort((left, right) => (left.order || 1000) - (right.order || 1000) || left.title.localeCompare(right.title));
    renderList();
  };

  const showWorkspace = async () => {
    loginPanel.hidden = true;
    workspace.hidden = false;
    resetEditor();
    await loadEntries();
  };

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginStatus.textContent = "Signing in…";
    try {
      await request("/api/admin/login", { method: "POST", body: JSON.stringify({ password: loginForm.elements.password.value }) });
      loginForm.reset();
      await showWorkspace();
    } catch (error) {
      loginStatus.textContent = error.message;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    editorStatus.textContent = "Saving…";
    const payload = Object.fromEntries(new FormData(form));
    payload.published = payload.published === "true";
    payload.sections = [...sectionEditor.querySelectorAll(".section-editor-row")].map((row) => ({ title: row.querySelector("[data-section-title]").value, body: row.querySelector("[data-section-body]").value }));
    try {
      const result = await request("/api/admin/entries", { method: "POST", body: JSON.stringify(payload) });
      await loadEntries();
      editEntry(result.entry);
      editorStatus.textContent = "Saved. Published entries are now available on the public site.";
    } catch (error) {
      editorStatus.textContent = error.message;
    }
  });

  deleteButton.addEventListener("click", async () => {
    const id = form.elements.id.value;
    if (!id || !window.confirm("Delete this supplemental entry permanently?")) return;
    editorStatus.textContent = "Deleting…";
    try {
      await request(`/api/admin/entries?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadEntries();
      resetEditor();
    } catch (error) {
      editorStatus.textContent = error.message;
    }
  });

  adminRoot.querySelector("[data-add-section]").addEventListener("click", () => addSection());
  adminRoot.querySelector("[data-new-entry]").addEventListener("click", resetEditor);
  adminRoot.querySelector("[data-logout]").addEventListener("click", async () => {
    await request("/api/admin/login", { method: "DELETE" });
    workspace.hidden = true;
    loginPanel.hidden = false;
  });

  request("/api/admin/login").then((session) => session.authenticated ? showWorkspace() : null).catch(() => {
    loginStatus.textContent = "The administrator service is unavailable.";
  });
}
