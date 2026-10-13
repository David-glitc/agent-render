const examples = {
  cli: {
    code: "$ agent-render render component.tsx -o preview.png",
    note: "A real browser render. Ready for your agent to inspect.",
    type: "PNG",
  },
  mcp: {
    code: '// Add to your MCP client configuration\n{ "mcpServers": {\n  "agent-render": { "command": "agent-render", "args": ["mcp"] }\n} }',
    note: "Your agent calls the tool. The image comes back in context.",
    type: "MCP",
  },
  curl: {
    code: '# First run: agent-render serve\ncurl http://127.0.0.1:4783/render \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"code":"<h1>Hello, agent.</h1>","format":"html"}\' \\\n  --output preview.png',
    note: "Keep the browser warm for the next render.",
    type: "PNG",
  },
};
const tabs = [...document.querySelectorAll('[role="tab"]')];
const selectTab = (tab) => {
  for (const item of tabs) {
    item.setAttribute("aria-selected", String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  }
  const example = examples[tab.dataset.mode];
  document.querySelector("#example-code").textContent = example.code;
  document.querySelector("#example-note").textContent = example.note;
  document.querySelector(".file-type").textContent = example.type;
  document.querySelector("#example").setAttribute("aria-labelledby", tab.id);
};
for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    let index = tabs.indexOf(tab);
    if (event.key === "ArrowRight") {
      index = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      index = (index + tabs.length - 1) % tabs.length;
    } else if (event.key === "Home") {
      index = 0;
    } else if (event.key === "End") {
      index = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    selectTab(tabs[index]);
    tabs[index].focus();
  });
}
document.querySelector("#copy").addEventListener("click", async () => {
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
const dialog = document.querySelector("#teaser");
const video = dialog.querySelector("video");
document.querySelector("#watch").addEventListener("click", () => {
  dialog.showModal();
  video.currentTime = 0;
  video
    .play()
    .then(() => {
      if (!dialog.open) {
        video.pause();
      }
    })
    .catch(() => {
      // Native controls remain available if the browser blocks playback.
    });
});
const closeTeaser = () => {
  video.pause();
  dialog.close();
};
document.querySelector("#close-teaser").addEventListener("click", closeTeaser);
dialog.addEventListener("cancel", () => video.pause());
dialog.addEventListener("close", () => video.pause());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) {
    return;
  }
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    closeTeaser();
  }
});
