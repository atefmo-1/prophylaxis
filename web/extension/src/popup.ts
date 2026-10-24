// Fallback when Chrome won't open the side panel by itself: one click here opens it.
document.getElementById("open")!.addEventListener("click", async () => {
  const win = await chrome.windows.getCurrent();
  await chrome.sidePanel.open({ windowId: win.id! });
  window.close();
});
