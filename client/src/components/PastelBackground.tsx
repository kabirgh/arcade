export default function PastelBackground() {
  return (
    <div
      className="absolute -inset-60"
      style={{
        backgroundImage: `
             radial-gradient(120% 120% at 20% 25%, rgba(255,246,181,0.55) 0 45%, transparent 60%)
            ,radial-gradient(120% 120% at 10% 70%, rgba(255,147,155,0.55) 0 20%, transparent 60%)
            ,radial-gradient(120% 120% at 60% 15%, rgba(190,235,200,0.55) 0 45%, transparent 60%)
            ,radial-gradient(120% 120% at 65% 55%, rgba(168,222,236,0.55) 0 45%, transparent 60%)
            ,radial-gradient(120% 120% at 110% -10%, rgba(255,147,155,0.55) 0 10%, transparent 80%)
          `,
        filter: "blur(100px)",
        zIndex: -1,
        animation: "gentle-move 30s ease-in-out infinite",
      }}
    />
  );
}
