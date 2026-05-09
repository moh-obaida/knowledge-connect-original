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
  const cellSize = compact ? (safeGrid === 4 ? 66 : safeGrid === 5 ? 58 : 50)
                           : (safeGrid === 4 ? 88 : safeGrid === 5 ? 76 : 66);
  const rows = Array.from({ length: safeGrid }, (_, row) =>
    sorted.slice(row * safeGrid, row * safeGrid + safeGrid),
  );
  // True honeycomb tessellation for flat-top hexes filling a square box:
  //   - vertical step between rows ≈ 0.75 × bounding-box height ⇒ overlap = 0.25
  //   - odd rows shift horizontally by half a cell width
  //   - columns sit edge-to-edge (no horizontal gap)
  const verticalOverlap = cellSize * 0.24;
  const rowOffset = cellSize * 0.48;
  const horizontalGap = 0;
  const winningSet = new Set(winningPathIds);
  const boardWidth = safeGrid * cellSize + rowOffset + 24;

  return (
    <div
      aria-label={`لوحة سداسية من ${safeGrid} صفوف، في كل صف ${safeGrid} حروف`}
      style={{
        position: "relative",
        padding: compact ? "0.8rem 0.45rem" : "1.1rem 0.65rem",
        width: "100%",
        overflowX: "auto",
      }}
    >
      {/* Path goal edge strips — only in game/participant mode */}
      {mode !== "setup" && (
        <>
          <div style={{ position:"absolute",top:10,bottom:10,right:4,width:8,background:`linear-gradient(180deg, ${team1.color}dd, ${team1.color})`,borderRadius:999,zIndex:3, boxShadow:`0 0 18px ${team1.color}55` }} />
          <div style={{ position:"absolute",top:10,bottom:10,left:4,width:8,background:`linear-gradient(180deg, ${team1.color}dd, ${team1.color})`,borderRadius:999,zIndex:3, boxShadow:`0 0 18px ${team1.color}55` }} />
          <div style={{ position:"absolute",top:4,left:14,right:14,height:8,background:`linear-gradient(90deg, ${team2.color}dd, ${team2.color})`,borderRadius:999,zIndex:3, boxShadow:`0 0 18px ${team2.color}55` }} />
          <div style={{ position:"absolute",bottom:4,left:14,right:14,height:8,background:`linear-gradient(90deg, ${team2.color}dd, ${team2.color})`,borderRadius:999,zIndex:3, boxShadow:`0 0 18px ${team2.color}55` }} />
        </>
      )}

      {/* Connected honeycomb grid */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${-verticalOverlap}px`,
          direction: "ltr",
          alignItems: "flex-start",
          width: "max-content",
          minWidth: Math.min(boardWidth, 360),
          margin: "0 auto",
          padding: compact ? "10px 8px" : "14px 12px",
          borderRadius: compact ? 24 : 32,
          background: "linear-gradient(135deg, rgba(76,29,149,0.28), rgba(245,158,11,0.14))",
          border: "1px solid rgba(245,158,11,0.28)",
          boxShadow: compact ? "0 12px 28px rgba(46,16,101,0.16)" : "0 22px 55px rgba(46,16,101,0.22)",
        }}
      >
        {rows.map((rowCells, row) => (
          <div
            key={`row-${row}`}
            data-row={row + 1}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${safeGrid}, ${cellSize}px)`,
              columnGap: `${horizontalGap}px`,
              marginInlineStart: row % 2 === 1 ? `${rowOffset}px` : 0,
            }}
          >
            {rowCells.map((cell) => {
          const claimed1 = cell.claimedBy === 1;
          const claimed2 = cell.claimedBy === 2;
          const isSelected = cell.id === selectedCellId;
          const isWinning = winningSet.has(cell.id);
          const bank = (cell as any).questionBank;
          const hasQ = !!cell.question.trim() || (Array.isArray(bank) && bank.some((q:any) => String(q?.question||"").trim()));

          let bg = "linear-gradient(145deg, #fffdf6, #fff4df)";
          let border = "2px solid rgba(76,29,149,0.58)";
          let textColor = "#160f2e";
          let shadow = "inset 0 0 0 1px rgba(255,255,255,0.72), 0 7px 18px rgba(46,16,101,0.12)";

          if (claimed1) {
            bg = `linear-gradient(135deg, ${team1.color}, ${team1.color}dd)`;
            border = `2px solid ${team1.color}`;
            textColor = "#fff";
            shadow = `0 0 18px ${team1.color}66, inset 0 0 0 1px rgba(255,255,255,0.26)`;
          } else if (claimed2) {
            bg = `linear-gradient(135deg, ${team2.color}, ${team2.color}dd)`;
            border = `2px solid ${team2.color}`;
            textColor = "#fff";
            shadow = `0 0 18px ${team2.color}66, inset 0 0 0 1px rgba(255,255,255,0.26)`;
          } else if (isSelected) {
            bg = "linear-gradient(145deg, #fff7d1, #fde68a)";
            border = "3px solid #f59e0b";
            textColor = "#2e1065";
            shadow = "0 0 0 4px rgba(245,158,11,0.2), 0 0 24px rgba(245,158,11,0.55)";
          } else if (mode === "setup" && hasQ) {
            bg = "linear-gradient(145deg, #ecfdf5, #dcfce7)";
            border = "2px solid #16a34a";
            textColor = "#14532d";
          } else if (mode === "setup" && !hasQ) {
            bg = "linear-gradient(145deg, #fff7ed, #ffe4e6)";
            border = "2px dashed #ef4444";
            textColor = "#7f1d1d";
          }
          if (cell.used && !claimed1 && !claimed2 && mode !== "setup") {
            bg = "linear-gradient(145deg, #f1f5f9, #e2e8f0)";
            border = "2px solid #94a3b8";
            textColor = "#64748b";
          }
          if (isWinning) {
            border = "3px solid #fbbf24";
            shadow = "0 0 0 3px rgba(251,191,36,0.38), 0 0 26px rgba(251,191,36,0.65)";
          }

          const clickable = !!onCellClick && (
            mode === "setup" ||
            (mode === "host-game" && cell.claimedBy === 0 && !cell.used)
          );

          return (
            <button
              type="button"
              key={cell.id}
              aria-label={`حرف ${cell.label}${cell.claimedBy === 1 ? ` محجوز لصالح ${team1.name}` : cell.claimedBy === 2 ? ` محجوز لصالح ${team2.name}` : ""}`}
              disabled={!clickable}
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
                border: 0,
                transition: "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
                boxShadow: shadow,
                outline: border,
                outlineOffset: "-2px",
                animation: isSelected ? "hexGlow 1.5s ease-in-out infinite" : isWinning ? "hexWin 1.6s ease-in-out infinite" : "none",
                userSelect: "none",
                minWidth: 44,
                minHeight: 44,
                fontFamily: "var(--kc-font-arabic)",
              }}
              onMouseEnter={e => { if (clickable) { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.045)"; (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.06)"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
            >
              <span style={{
                fontWeight: 900,
                fontSize: cellSize * 0.42,
                color: textColor,
                fontFamily: "var(--kc-font-arabic)",
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
            </button>
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
