export type BrowserSupportReport = {
  hasMediaDevices: boolean;
  hasAudioContext: boolean;
  hasDisplayMedia: boolean;
  hasShadowDom: boolean;
};

export function getBrowserSupportReport(): BrowserSupportReport {
  return {
    hasMediaDevices: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    hasAudioContext: typeof window !== "undefined" && (!!window.AudioContext || !!window.webkitAudioContext),
    hasDisplayMedia: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia,
    hasShadowDom: typeof Element !== "undefined" && !!Element.prototype.attachShadow
  };
}
