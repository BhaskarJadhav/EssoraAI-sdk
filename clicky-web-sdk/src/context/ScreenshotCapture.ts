import type { ClickyScreenshot } from "../core/types";

export class ScreenshotCapture {
  async captureStill(label = "user-selected browser surface"): Promise<ClickyScreenshot> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen capture is not supported in this browser");
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    try {
      const video = document.createElement("video");
      video.muted = true;
      video.srcObject = stream;
      await video.play();

      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
          return;
        }
        video.onloadedmetadata = () => resolve();
      });

      const maximumDimension = 1280;
      const resizeRatio = Math.min(1, maximumDimension / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * resizeRatio));
      canvas.height = Math.max(1, Math.round(video.videoHeight * resizeRatio));
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Could not create screenshot canvas context");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const base64 = dataUrl.split(",")[1] ?? "";

      return {
        mimeType: "image/jpeg",
        base64,
        width: canvas.width,
        height: canvas.height,
        label
      };
    } finally {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  }
}
