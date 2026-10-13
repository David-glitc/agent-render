const button = document.querySelector("#copy");
button.addEventListener("click", async () => {
  const status = document.querySelector("#copy-status");
  try {
    await navigator.clipboard.writeText(
      document.querySelector("#commands").textContent
    );
    status.textContent = "Copied. Paste into your terminal.";
  } catch {
    status.textContent = "Select the commands above and copy them.";
  }
});
