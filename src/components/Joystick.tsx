// Adapted from the user's Hair-and-Makeup Aippy React joystick:
// https://github.com/benryaus-cmd/Hair-and-Makeup/blob/main/src/ui/Joystick.tsx
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export function Joystick({ onChange, disabled = false }: { onChange: (x: number, y: number) => void; disabled?: boolean }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const emit = useRef(onChange);
  useLayoutEffect(() => { emit.current = onChange; }, [onChange]);
  const reset = useCallback(() => {
    const id = active.current;
    active.current = null;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px,0px)';
    emit.current(0, 0);
    if (id !== null && baseRef.current?.hasPointerCapture(id)) baseRef.current.releasePointerCapture(id);
  }, []);
  useEffect(() => {
    const onBlur = () => reset();
    const onVisibility = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      reset();
    };
  }, [reset]);
  useEffect(() => { if (disabled) reset(); }, [disabled, reset]);
  const move = (x: number, y: number) => {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    const radius = Math.max(20, r.width / 2 - 24);
    let dx = x - r.left - r.width / 2, dy = y - r.top - r.height / 2;
    const d = Math.hypot(dx, dy);
    if (d > radius) { dx *= radius / d; dy *= radius / d; }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px,${dy}px)`;
    emit.current(dx / radius, -dy / radius);
  };
  return <div className="joystick" ref={baseRef} style={{ touchAction: 'none' }}
    role="group" aria-label="Movement joystick" aria-disabled={disabled}
    onPointerDown={e => {
      e.preventDefault(); e.stopPropagation();
      if (disabled || active.current !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      active.current = e.pointerId;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { reset(); return; }
      move(e.clientX, e.clientY);
    }}
    onPointerMove={e => { if (active.current === e.pointerId) { e.preventDefault(); move(e.clientX, e.clientY); } }}
    onPointerUp={e => { if (active.current === e.pointerId) reset(); }}
    onPointerCancel={e => { if (active.current === e.pointerId) reset(); }}
    onLostPointerCapture={e => { if (active.current === e.pointerId) reset(); }}
    onContextMenu={e => e.preventDefault()}>
    <div className="joy-cross joy-x" /><div className="joy-cross joy-y" />
    <div ref={knobRef} className="joy-knob"><span>✦</span></div>
    <span className="joy-label">MOVE</span>
  </div>;
}
