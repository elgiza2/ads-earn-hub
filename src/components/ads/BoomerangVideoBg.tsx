import { useEffect, useRef, useState } from "react";

const SRC = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260611_183632_c311af08-e4b7-458f-81e7-79847a49b3d3.mp4";

export function BoomerangVideoBg() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frames = useRef<HTMLCanvasElement[]>([]);
  const [looping, setLooping] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let stopped = false;
    const capture = () => {
      if (stopped || v.ended || !v.videoWidth) return;
      const w = Math.min(960, v.videoWidth);
      const h = Math.round((v.videoHeight / v.videoWidth) * w);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      try { c.getContext("2d")?.drawImage(v, 0, 0, w, h); frames.current.push(c); } catch {}
    };
    const anyV = v as any;
    const loop = () => {
      if (stopped || v.ended) return;
      capture();
      if (anyV.requestVideoFrameCallback) anyV.requestVideoFrameCallback(loop);
      else requestAnimationFrame(loop);
    };
    const onPlay = () => loop();
    const onEnd = () => { if (frames.current.length > 2) setLooping(true); else { v.currentTime = 0; v.play(); } };
    v.addEventListener("play", onPlay, { once: true });
    v.addEventListener("ended", onEnd);
    v.play().catch(() => {});
    return () => { stopped = true; v.removeEventListener("ended", onEnd); };
  }, []);

  useEffect(() => {
    if (!looping) return;
    const c = canvasRef.current!;
    const f = frames.current;
    c.width = f[0]!.width; c.height = f[0]!.height;
    const ctx = c.getContext("2d")!;
    let i = 0, dir = 1;
    const id = setInterval(() => {
      ctx.drawImage(f[i]!, 0, 0);
      i += dir;
      if (i >= f.length - 1 || i <= 0) dir *= -1;
    }, 1000 / 30);
    return () => clearInterval(id);
  }, [looping]);

  return (
    <div className="fixed inset-0 z-0 origin-center scale-[1.08] overflow-hidden pointer-events-none">
      <video ref={videoRef} src={SRC} muted playsInline crossOrigin="anonymous" autoPlay className={`h-full w-full object-cover ${looping ? "hidden" : ""}`} />
      <canvas ref={canvasRef} className={`h-full w-full object-cover ${looping ? "" : "hidden"}`} />
    </div>
  );
}
