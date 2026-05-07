import { sortedBoard, type BoardCell, type Team } from "../lib/store";

const HEX_CLIP = "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)";

interface HexBoardProps {
  board: BoardCell[];
  gridSize: number;
  mode: "setup" | "host-game" | "participant";
  selectedCellId?: string;
  team1: Team;
  team2: Team;
  onCellClick?: (cell: BoardCell) => void;
  compact?: boolean;
  winningPathIds?: string[];
}

export default function HexBoard({
  board, gridSize, mode, selectedCellId = "", team1, team2, onCellClick, compact = false, winningPathIds = [],
}: HexBoardProps) {
  const sorted = sortedBoard(board);
  const safeGrid = ([4, 5, 6].includes(gridSize) ? gridSize : 5) as 4 | 5 | 6;
  const cellSize = compact ? (safeGrid === 4 ? 62 : safeGrid === 5 ? 54 : 46) : (safeGrid === 4 ? 82 : safeGrid === 5 ? 70 : 60);
  const verticalOverlap = cellSize * 0.28;
  const rowOffset = cellSize * 0.48;
  const rows = Array.from({ length: safeGrid }, (_, row) => sorted.slice(row * safeGrid, row * safeGrid + safeGrid));
  const motionReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const cellSize = compact ? (safeGrid === 4 ? 70 : safeGrid === 5 ? 60 : 52)
                           : (safeGrid === 4 ? 90 : safeGrid === 5 ? 78 : 66);
  const gap = 0;

  return (
    <div style={{ position: "relative", padding: "8px", width: "100%", overflowX: "hidden" }}>
      {mode !== "setup" && (
        <>
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 5, background: team1.color, borderRadius: "0 4px 4px 0", opacity: 0.8, zIndex: 3 }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 5, background: team1.color, borderRadius: "4px 0 0 4px", opacity: 0.8, zIndex: 3 }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: team2.color, borderRadius: "4px 4px 0 0", opacity: 0.8, zIndex: 3 }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: team2.color, borderRadius: "0 0 4px 4px", opacity: 0.8, zIndex: 3 }} />
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: `${-verticalOverlap}px`, direction: "ltr", alignItems: "center", width: "100%", maxWidth: "100%", paddingBottom: "6px" }}>
        {rows.map((rowCells, row) => (
          <div key={`row-${row}`} style={{ display: "grid", gridTemplateColumns: `repeat(${safeGrid}, ${cellSize}px)`, columnGap: `${-cellSize * 0.04}px`, marginInlineStart: row % 2 === 1 ? `${rowOffset}px` : 0 }}>
            {rowCells.map((cell) => {
              const claimed1 = cell.claimedBy === 1;
              const claimed2 = cell.claimedBy === 2;
              const isSelected = cell.id === selectedCellId;
              const hasQ = !!cell.question.trim();
              const isWinning = winningPathIds.includes(cell.id);

              let bg = "#f8fafc";
              let border = "2px solid #6b46c1";
              let textColor = "#0f172a";
              let shadow = "none";

              if (claimed1) { bg = team1.color; border = `2px solid ${team1.color}`; textColor = "#fff"; shadow = `0 0 16px ${team1.color}66`; }
              else if (claimed2) { bg = team2.color; border = `2px solid ${team2.color}`; textColor = "#fff"; shadow = `0 0 16px ${team2.color}66`; }
              else if (isSelected) { bg = "#eef2ff"; border = "3px solid #f59e0b"; textColor = "#1e1b4b"; shadow = "0 0 20px rgba(245,158,11,0.5)"; }
              else if (mode === "setup" && hasQ) { bg = "#dcfce7"; border = "2px solid #22c55e"; textColor = "#166534"; }
          let bg = "#f8fafc";
          let border = "2px solid #6b46c1";
          let textColor = "#0f172a";
          let shadow = "none";

          if (claimed1) {
            bg = team1.color; border = `2px solid ${team1.color}`; textColor = "#fff";
            shadow = `0 0 16px ${team1.color}66`;
          } else if (claimed2) {
            bg = team2.color; border = `2px solid ${team2.color}`; textColor = "#fff";
            shadow = `0 0 16px ${team2.color}66`;
          } else if (isSelected) {
            bg = "#eef2ff"; border = "3px solid #f59e0b"; textColor = "#1e1b4b";
            shadow = "0 0 20px rgba(245,158,11,0.5)";
          } else if (mode === "setup" && hasQ) {
            bg = "#dcfce7"; border = "2px solid #22c55e"; textColor = "#166534";
          }

              if (cell.used && !claimed1 && !claimed2 && mode !== "setup") { bg = "#202c3f"; border = "2px solid #334155"; textColor = "#94a3b8"; }
              if (isWinning) { border = "3px solid #fbbf24"; shadow = "0 0 0 2px rgba(251,191,36,0.35), 0 0 20px rgba(251,191,36,0.45)"; }

              const clickable = !!onCellClick && (mode === "setup" || (mode === "host-game" && cell.claimedBy === 0 && !cell.used));
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
                transition: "all 0.2s ease",
                boxShadow: shadow,
                outline: border,
                outlineOffset: "-3px",
                marginTop: isOddRow ? cellSize * 0.26 : 0,
                animation: isSelected ? "hexGlow 1.5s ease-in-out infinite" : "none",
                userSelect: "none",
              }}
              onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLDivElement).style.transform = "scale(1.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
            >
              <span style={{
                fontWeight: 900,
                fontSize: cellSize * 0.34,
                color: textColor,
                fontFamily: "Cairo,sans-serif",
                lineHeight: 1,
              }}>
                {cell.label}
              </span>

              return (
                <button key={cell.id} onClick={() => clickable && onCellClick?.(cell)} type="button" aria-label={`خلية ${cell.label}${claimed1 ? ` للفريق ${team1.name}` : claimed2 ? ` للفريق ${team2.name}` : ""}`}
                  style={{ width: cellSize, height: cellSize, clipPath: HEX_CLIP, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", cursor: clickable ? "pointer" : "default", transition: motionReduced ? "none" : "all 0.2s ease", boxShadow: shadow, outline: border, outlineOffset: "-2px", animation: isSelected && !motionReduced ? "hexGlow 1.5s ease-in-out infinite" : "none", userSelect: "none", border: "none", padding: 0 }}>
                  <span style={{ fontWeight: 900, fontSize: cellSize * 0.36, color: textColor, fontFamily: "Cairo,sans-serif", lineHeight: 1 }}>{cell.label}</span>
                  {mode === "setup" && !claimed1 && !claimed2 && <span style={{ fontSize: cellSize * 0.17, color: hasQ ? "#22c55e" : "#ef4444", lineHeight: 1, marginTop: 2 }}>{hasQ ? "✓" : "!"}</span>}
                  {(claimed1 || claimed2) && <span style={{ fontSize: cellSize * 0.22, color: "rgba(255,255,255,0.9)", lineHeight: 1, fontWeight: 800 }}>{claimed1 ? "◆" : "●"}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
