import { sortedBoard, type BoardCell, type Team } from "../lib/store";

// Regular flat-top hexagon, full-bleed inside the bounding box so adjacent
// hexes share edges instead of leaving small triangular gaps.
const HEX_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

interface HexBoardProps {
  board: BoardCell[];
  gridSize: number;
  mode: "setup" | "host-game" | "participant";
  selectedCellId?: string;
  team1: Team;
  team2: Team;
  onCellClick?: (cell: BoardCell) => void;
  winnerTeam?: 0 | 1 | 2;
  compact?: boolean;
  winningPathIds?: string[];
}

export default function HexBoard({
  board, gridSize, mode, selectedCellId = "",
  team1, team2, onCellClick, compact = false, winningPathIds = [],
}: HexBoardProps) {
  const sorted = sortedBoard(board);
  const safeGrid = ([4, 5, 6].includes(gridSize) ? gridSize : 5) as 4 | 5 | 6;
  const cellSize = compact ? (safeGrid === 4 ? 64 : safeGrid === 5 ? 56 : 48)
                           : (safeGrid === 4 ? 80 : safeGrid === 5 ? 70 : 60);
  const rows = Array.from({ length: safeGrid }, (_, row) =>
    sorted.slice(row * safeGrid, row * safeGrid + safeGrid),
  );
  // True honeycomb tessellation for flat-top hexes filling a square box:
  //   - vertical step between rows ≈ 0.75 × bounding-box height ⇒ overlap = 0.25
  //   - odd rows shift horizontally by half a cell width
  //   - columns sit edge-to-edge (no horizontal gap)
  const verticalOverlap = cellSize * 0.25;
  const rowOffset = cellSize * 0.5;
  const horizontalGap = 0;
  const winningSet = new Set(winningPathIds);

  return (
    <div style={{ position: "relative", padding: "6px", width: "100%", overflowX: "hidden" }}>
      {/* Path goal edge strips — only in game/participant mode */}
      {mode !== "setup" && (
        <>
          <div style={{ position:"absolute",top:0,bottom:0,right:0,width:6,background:`linear-gradient(180deg, ${team1.color}cc, ${team1.color})`,borderRadius:"0 5px 5px 0",zIndex:3 }} />
          <div style={{ position:"absolute",top:0,bottom:0,left:0,width:6,background:`linear-gradient(180deg, ${team1.color}cc, ${team1.color})`,borderRadius:"5px 0 0 5px",zIndex:3 }} />
          <div style={{ position:"absolute",top:0,left:0,right:0,height:6,background:`linear-gradient(90deg, ${team2.color}cc, ${team2.color})`,borderRadius:"5px 5px 0 0",zIndex:3 }} />
          <div style={{ position:"absolute",bottom:0,left:0,right:0,height:6,background:`linear-gradient(90deg, ${team2.color}cc, ${team2.color})`,borderRadius:"0 0 5px 5px",zIndex:3 }} />
        </>
      )}

      {/* Connected honeycomb grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: `${-verticalOverlap}px`, direction: "ltr", alignItems: "center", width: "100%", margin: "0 auto", padding: "10px 4px" }}>
        {rows.map((rowCells, row) => (
          <div key={`row-${row}`} style={{ display: "grid", gridTemplateColumns: `repeat(${safeGrid}, ${cellSize}px)`, columnGap: `${horizontalGap}px`, marginInlineStart: row % 2 === 1 ? `${rowOffset}px` : 0 }}>
            {rowCells.map((cell) => {
          const claimed1 = cell.claimedBy === 1;
          const claimed2 = cell.claimedBy === 2;
          const isSelected = cell.id === selectedCellId;
          const isWinning = winningSet.has(cell.id);
          const bank = (cell as any).questionBank;
          const hasQ = !!cell.question.trim() || (Array.isArray(bank) && bank.some((q:any) => String(q?.question||"").trim()));

          let bg = "linear-gradient(135deg, #1a2332, #141e2d)";
          let border = "1.5px solid #243248";
          let textColor = "#cbd5e1";
          let shadow = "none";

          if (claimed1) {
            bg = `linear-gradient(135deg, ${team1.color}, ${team1.color}dd)`;
            border = `1.5px solid ${team1.color}`;
            textColor = "#fff";
            shadow = `0 0 12px ${team1.color}66, inset 0 0 0 1px rgba(255,255,255,0.15)`;
          } else if (claimed2) {
            bg = `linear-gradient(135deg, ${team2.color}, ${team2.color}dd)`;
            border = `1.5px solid ${team2.color}`;
            textColor = "#fff";
            shadow = `0 0 12px ${team2.color}66, inset 0 0 0 1px rgba(255,255,255,0.15)`;
          } else if (isSelected) {
            bg = "linear-gradient(135deg, #2a1f0e, #3a2b13)";
            border = "2.5px solid #f59e0b";
            textColor = "#fde68a";
            shadow = "0 0 18px rgba(245,158,11,0.6)";
          } else if (mode === "setup" && hasQ) {
            bg = "linear-gradient(135deg, #052e1c, #0a3d24)";
            border = "1.5px solid #16a34a";
            textColor = "#bbf7d0";
          } else if (mode === "setup" && !hasQ) {
            bg = "linear-gradient(135deg, #2a0e0e, #3a1313)";
            border = "1.5px dashed #ef4444";
            textColor = "#fca5a5";
          }
          if (cell.used && !claimed1 && !claimed2 && mode !== "setup") {
            bg = "linear-gradient(135deg, #0f172a, #141e2d)";
            border = "1.5px solid #334155";
            textColor = "#64748b";
          }
          if (isWinning) {
            border = "2.5px solid #fbbf24";
            shadow = "0 0 0 2px rgba(251,191,36,0.4), 0 0 22px rgba(251,191,36,0.55)";
          }

          const clickable = !!onCellClick && (
            mode === "setup" ||
            (mode === "host-game" && cell.claimedBy === 0 && !cell.used)
          );

          return (
            <div
              key={cell.id}
              title={
                mode === "setup"
                  ? hasQ ? "تم إعداد سؤال — اضغط للتعديل" : "لا يوجد سؤال بعد — اضغط للإضافة"
                  : cell.claimedBy !== 0 ? "تم حجز هذا الحرف" : ""
              }
              onClick={() => clickable && onCellClick!(cell)}
              style={{
                width: cellSize,
                height: cellSize,
                clipPath: HEX_CLIP,
                background: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                cursor: clickable ? "pointer" : "default",
                transition: "transform 0.18s ease, box-shadow 0.18s ease",
                boxShadow: shadow,
                outline: border,
                outlineOffset: "-2px",
                animation: isSelected ? "hexGlow 1.5s ease-in-out infinite" : isWinning ? "hexWin 1.6s ease-in-out infinite" : "none",
                userSelect: "none",
                minWidth: 44,
                minHeight: 44,
              }}
              onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLDivElement).style.transform = "scale(1.07)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
            >
              <span style={{
                fontWeight: 900,
                fontSize: cellSize * 0.36,
                color: textColor,
                fontFamily: "Cairo,sans-serif",
                lineHeight: 1,
                textShadow: claimed1 || claimed2 ? "0 1px 2px rgba(0,0,0,0.35)" : "none",
              }}>
                {cell.label}
              </span>

              {/* Setup status dot */}
              {mode === "setup" && !claimed1 && !claimed2 && (
                <span style={{ fontSize: cellSize * 0.18, color: hasQ ? "#22c55e" : "#ef4444", lineHeight: 1, marginTop: 2 }}>
                  {hasQ ? "✓" : "!"}
                </span>
              )}

              {/* Claimed team initials */}
              {(claimed1 || claimed2) && (
                <span style={{ fontSize: cellSize * 0.2, color: "rgba(255,255,255,0.85)", lineHeight: 1, fontWeight: 700, marginTop: 2 }}>
                  {claimed1 ? team1.initials : team2.initials}
                </span>
              )}
            </div>
          );
            })}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes hexGlow {
          0%,100% { filter: brightness(1); }
          50% { filter: brightness(1.25) drop-shadow(0 0 8px #f59e0b); }
        }
        @keyframes hexWin {
          0%,100% { filter: brightness(1); }
          50% { filter: brightness(1.2) drop-shadow(0 0 10px #fbbf24); }
        }
      `}</style>
    </div>
  );
}
