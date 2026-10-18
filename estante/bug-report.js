(() => {
  "use strict";
  const API_URL = "https://pxqhpntifbtjaoqtirao.supabase.co/functions/v1/estante-bug-report";
  const PUBLIC_KEY = "sb_publishable_BQovHTX0tTRpLtVfOnTVAQ_QxiV1o42";
  const button = document.getElementById("reportBugBtn");
  const dialog = document.getElementById("bugReportDialog");
  const form = document.getElementById("bugReportForm");
  if (!button || !dialog || !form) return;

  const description = document.getElementById("bugDescription");
  const category = document.getElementById("bugCategory");
  const website = document.getElementById("bugReportWebsite");
  const status = document.getElementById("bugReportStatus");
  const submit = document.getElementById("bugReportSubmit");
  let lastSentAt = 0;
  let isSending = false;

  function openForm() {
    form.reset();
    status.textContent = "";
    status.dataset.state = "";
    submit.disabled = false;
    dialog.showModal();
    description.focus();
  }

  button.addEventListener("click", openForm);
  document.getElementById("bugReportClose").addEventListener("click", () => dialog.close());
  document.getElementById("bugReportCancel").addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSending) return;
    const text = description.value.trim();
    if (text.length < 15 || text.length > 1500) {
      status.textContent = "Descreva o problema com pelo menos 15 caracteres.";
      status.dataset.state = "error";
      description.focus();
      return;
    }
    if (Date.now() - lastSentAt < 10000) {
      status.textContent = "Aguarde alguns segundos antes de enviar outro relato.";
      status.dataset.state = "error";
      return;
    }

    isSending = true;
    submit.disabled = true;
    status.textContent = "Enviando…";
    status.dataset.state = "";
    const pagePath = location.pathname.slice(0, 200);
    const payload = {
      category: category.value,
      description: text,
      app_version: typeof APP_VERSION === "string" ? APP_VERSION : "4.1.0",
      page_path: pagePath.startsWith("/") ? pagePath : "/",
      website: website.value.trim(),
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("send_failed");
      lastSentAt = Date.now();
      isSending = false;
      form.reset();
      status.textContent = "Relato enviado. Obrigado por ajudar a melhorar o Estante.";
      status.dataset.state = "success";
      setTimeout(() => { if (dialog.open) dialog.close(); }, 1300);
    } catch {
      isSending = false;
      status.textContent = "Não consegui enviar agora. Confira sua conexão e tente novamente.";
      status.dataset.state = "error";
      submit.disabled = false;
    }
  });
})();
