import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

// Nodes = students scattered; they get linked into the letter "N" — the network forming.
const NODES: [number, number][] = [
  [30, 150], [30, 95], [30, 40], [62, 80], [96, 120], [130, 160], [130, 105], [130, 50],
];
const STRAY: [number, number][] = [
  [8, 12], [150, 20], [160, 140], [4, 175], [80, 18], [92, 182], [150, 90], [12, 70],
];

export function SplashScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("nexus_splash_seen")) return;
    sessionStorage.setItem("nexus_splash_seen", "1");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setShow(true);
    const t = setTimeout(() => setShow(false), reduce ? 700 : 2600);
    return () => clearTimeout(t);
  }, []);

  const path = `M${NODES.map((n) => n.join(" ")).join(" L")}`;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          onClick={() => setShow(false)}
          aria-label="NEXUS"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 right-[-10%] h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute bottom-[-15%] left-[-10%] h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
          </div>

          <svg viewBox="0 0 160 190" className="relative h-44 w-40 text-primary" fill="none">
            {STRAY.map(([x, y], i) => (
              <motion.line
                key={`l${i}`}
                x1={x} y1={y}
                x2={NODES[i % NODES.length]![0]} y2={NODES[i % NODES.length]![1]}
                stroke="currentColor" strokeOpacity={0.18} strokeWidth={0.8}
                initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, delay: 0.1 + i * 0.05 }}
              />
            ))}
            {STRAY.map(([x, y], i) => (
              <motion.circle
                key={`s${i}`} cx={x} cy={y} r={2} className="fill-accent"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.4] }}
                transition={{ duration: 1.7, delay: i * 0.06 }}
              />
            ))}
            <motion.path
              d={path} stroke="currentColor" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, delay: 0.45, ease: [0.65, 0, 0.35, 1] }}
            />
            {NODES.map(([x, y], i) => (
              <motion.circle
                key={i} cx={x} cy={y} r={6} className="fill-background" stroke="currentColor" strokeWidth={3}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.45 + i * 0.12 }}
              />
            ))}
          </svg>

          <motion.div
            className="relative mt-6 text-center"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 1.45, duration: 0.6 }}
          >
            <div className="font-display text-4xl font-semibold tracking-[0.35em] text-foreground" dir="ltr">NEXUS</div>
            <div className="mt-2 text-sm text-muted-foreground">كل زميل نقطة… وكلنا شبكة واحدة</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
