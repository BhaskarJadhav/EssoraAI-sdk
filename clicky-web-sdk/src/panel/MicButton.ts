export function createMicButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "clicky-button clicky-mic";
  button.type = "button";
  button.title = "Push to talk";
  button.innerHTML = `
    <span class="clicky-mic-label">Mic</span>
    <span class="clicky-waveform" aria-hidden="true">
      <span></span><span></span><span></span><span></span><span></span>
    </span>
  `;
  return button;
}
