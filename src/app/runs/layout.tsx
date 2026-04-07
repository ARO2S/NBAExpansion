export default function RunsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#05070A]">
      {/* Subtle orange grid — fixed so it doesn't scroll */}
      <div
        className="pointer-events-none fixed inset-0 -z-10
        bg-[linear-gradient(to_right,#FF8A0010_1px,transparent_1px),linear-gradient(to_bottom,#FF8A0010_1px,transparent_1px)]
        bg-[size:6rem_5rem]"
      />
      {/* Faint orange top glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,138,0,0.10),transparent)]" />
      {children}
    </div>
  );
}
