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
  winnerTeam?: 0 | 1 | 2;
  compact?: boolean;
}

export default function HexBoard({
  board, gridSize, mode, selectedCellId = "",
  team1, team2, onCellClick, compact = false,
}: HexBoardProps) {
  const sorted = sortedBoard(board);
  const safeGrid = ([4, 5, 6].includes(gridSize) ? gridSize : 5) as 4 | 5 | 6;
  const cellSize = compact ? (safeGrid === 4 ? 70 : safeGrid === 5 ? 60 : 52)
                           : (safeGrid === 4 ? 90 : safeGrid === 5 ? 78 : 66);
  const gap = 1;

  return (
    <div style={{ position: "relative", padding: "8px" }}>
      {/* Path goal edge strips — only in game/participant mode */}
      {mode !== "setup" && (
        <>
          <div style={{ position:"absolute",top:0,bottom:0,right:0,width:5,background:team1.color,borderRadius:"0 4px 4px 0",opacity:0.8,zIndex:3 }} />
          <div style={{ position:"absolute",top:0,bottom:0,left:0,width:5,background:team1.color,borderRadius:"4px 0 0 4px",opacity:0.8,zIndex:3 }} />
          <div style={{ position:"absolute",top:0,left:0,right:0,height:5,background:team2.color,borderRadius:"4px 4px 0 0",opacity:0.8,zIndex:3 }} />
          <div style={{ position:"absolute",bottom:0,left:0,right:0,height:5,background:team2.color,borderRadius:"0 0 4px 4px",opacity:0.8,zIndex:3 }} />
        </>
      )}

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${safeGrid}, ${cellSize}px)`,
        gap: `${gap}px`,
        direction: "ltr",
        justifyContent: "center",
        padding: "8px 12px",
      }}>
        {sorted.map((cell, idx) => {
          const row = Math.floor(idx / safeGrid);
          const isOddRow = row % 2 === 1;
          const claimed1 = cell.claimedBy === 1;
          const claimed2 = cell.claimedBy === 2;
          const isSelected = cell.id === selectedCellId;
          const hasQ = !!cell.question.trim();

          let bg = "#1a2332";
          let border = "1px solid #253347";
          let textColor = "#475569";
          let shadow = "none";

          if (claimed1) {
            bg = team1.color; border = `2px solid ${team1.color}`; textColor = "#fff";
            shadow = `0 0 16px ${team1.color}66`;
          } else if (claimed2) {
            bg = team2.color; border = `2px solid ${team2.color}`; textColor = "#fff";
            shadow = `0 0 16px ${team2.color}66`;
          } else if (isSelected) {
            bg = "#1e3a5f"; border = "3px solid #f59e0b"; textColor = "#f59e0b";
            shadow = "0 0 20px rgba(245,158,11,0.5)";
          } else if (mode === "setup" && hasQ) {
            bg = "#0f2318"; border = "1px solid #16a34a44"; textColor = "#22c55e";
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
                transition: "all 0.2s ease",
                boxShadow: shadow,
                outline: border,
                outlineOffset: "-2px",
                marginTop: isOddRow ? cellSize * 0.34 : 0,
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

              {/* Setup status dot */}
              {mode === "setup" && !claimed1 && !claimed2 && (
                <span style={{ fontSize: cellSize * 0.17, color: hasQ ? "#22c55e" : "#ef4444", lineHeight: 1, marginTop: 2 }}>
                  {hasQ ? "✓" : "!"}
                </span>
              )}

              {/* Claimed team initials */}
              {(claimed1 || claimed2) && (
                <span style={{ fontSize: cellSize * 0.19, color: "rgba(255,255,255,0.75)", lineHeight: 1, fontWeight: 700 }}>
                  {claimed1 ? team1.initials : team2.initials}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes hexGlow {
          0%,100% { filter: brightness(1); }
          50% { filter: brightness(1.3) drop-shadow(0 0 8px #f59e0b); }
        }
      `}</style>
    </div>
  );
}
