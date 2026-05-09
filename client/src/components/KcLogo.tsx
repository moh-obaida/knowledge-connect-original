import type { CSSProperties } from "react";

type KcLogoProps = {
  compact?: boolean;
  light?: boolean;
  subtitle?: string;
  style?: CSSProperties;
};

export default function KcLogo({ compact = false, light = false, subtitle, style }: KcLogoProps) {
  const textColor = light ? "#ffffff" : "#2e1065";
  const mutedColor = light ? "#ddd6fe" : "#64748b";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: compact ? "0.5rem" : "0.65rem", ...style }}>
      <div
        aria-hidden="true"
        className="kc-logo-mark"
        style={{
          width: compact ? 42 : 54,
          height: compact ? 42 : 54,
          display: "grid",
          placeItems: "center",
          color: "#2e1065",
          fontWeight: 900,
          fontSize: compact ? "1.25rem" : "1.6rem",
          filter: light ? "drop-shadow(0 12px 24px rgba(245,158,11,0.24))" : "none",
        }}
      >
        ا
      </div>
      <div>
        <div style={{ fontWeight: 900, fontSize: compact ? "1.08rem" : "1.28rem", color: textColor, lineHeight: 1.15 }}>
          وصلة المعرفة
        </div>
        {subtitle && <div style={{ color: mutedColor, fontSize: compact ? "0.78rem" : "0.86rem", lineHeight: 1.6 }}>{subtitle}</div>}
      </div>
    </div>
  );
}
