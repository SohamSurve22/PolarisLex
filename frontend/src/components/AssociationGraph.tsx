import { useState, useCallback, useRef, useEffect } from "react";
import { useGetAssociations, getGetAssociationsQueryKey } from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocData {
  id: string;
  documentType: string;
  complianceScore: number;
  status: string;
  extractedFields?: {
    name?: string | null;
    licenseNumber?: string | null;
    vehicleNumber?: string | null;
    expiryDate?: string | null;
  } | null;
  violations?: unknown[];
}

export interface UserAssocData {
  userId: string;
  associated: boolean;
  confidenceScore: number;
  issues: Array<{
    type: string;
    field: string;
    description: string;
    dlValue?: string | null;
    rcValue?: string | null;
    icValue?: string | null;
  }>;
  documents?: {
    dl?: DocData | null;
    rc?: DocData | null;
    ic?: DocData | null;
  };
  summary?: string;
}

interface TooltipInfo {
  x: number;
  y: number;
  title: string;
  lines: string[];
  color: string;
}

// ─── Layout Helpers ───────────────────────────────────────────────────────────

const SVG_W = 840;
const CELL_W = 260;
const CELL_H = 290;
const DOC_R = 80; // radius from user center to doc nodes

const DOC_OFFSETS: Record<string, { dx: number; dy: number }> = {
  DL: { dx: -DOC_R - 30, dy: 0 },
  RC: { dx: 0,           dy: -(DOC_R + 10) },
  IC: { dx:  DOC_R + 30, dy: 0 },
};

function getLayout(n: number) {
  const cols = n <= 1 ? 1 : n <= 2 ? 2 : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const svgH = rows * CELL_H + 60;
  return { cols, rows, svgH };
}

function getCenter(i: number, n: number): { x: number; y: number } {
  const { cols } = getLayout(n);
  const cellW = SVG_W / cols;
  const col = i % cols;
  const row = Math.floor(i / cols);
  return {
    x: cellW * col + cellW / 2,
    y: CELL_H * row + CELL_H / 2 + 20,
  };
}

// ─── Color Helpers ────────────────────────────────────────────────────────────

function statusColor(status: string) {
  if (status === "compliant")       return "#34d399";
  if (status === "review_required") return "#fbbf24";
  return "#f43f5e";
}

function scoreColor(score: number) {
  if (score >= 80) return "#34d399";
  if (score >= 50) return "#fbbf24";
  return "#f43f5e";
}

// Cycle through a palette for unknown users
const PALETTE = ["#a78bfa", "#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#f87171", "#38bdf8", "#c084fc"];
const USER_COLOR_CACHE = new Map<string, string>();
let paletteIdx = 0;
function getUserColor(userId: string): string {
  const FIXED: Record<string, string> = {
    "demo-user":       "#a78bfa",
    "user-expired":    "#fbbf24",
    "user-mismatch":   "#f87171",
    "user-missing-ic": "#60a5fa",
  };
  if (FIXED[userId]) return FIXED[userId];
  if (!USER_COLOR_CACHE.has(userId)) {
    USER_COLOR_CACHE.set(userId, PALETTE[paletteIdx % PALETTE.length]);
    paletteIdx++;
  }
  return USER_COLOR_CACHE.get(userId)!;
}

// ─── SVG Defs ────────────────────────────────────────────────────────────────

function SVGDefs() {
  return (
    <defs>
      {/* Glow filters per color */}
      {["#34d399","#fbbf24","#f43f5e","#a78bfa","#60a5fa","#f472b6","#38bdf8","#c084fc"].map((c) => {
        const id = `glow-${c.replace("#", "")}`;
        return (
          <filter key={id} id={id} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" type="matrix" result="glow"
              values={`0 0 0 0 ${parseInt(c.slice(1,3),16)/255}
                       0 0 0 0 ${parseInt(c.slice(3,5),16)/255}
                       0 0 0 0 ${parseInt(c.slice(5,7),16)/255}
                       0 0 0 1 0`}
            />
            <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        );
      })}
      {/* Pulse animation for mismatch */}
      <style>{`
        @keyframes pulse-ring {
          0%   { stroke-opacity: 0.9; r: 38; }
          50%  { stroke-opacity: 0.3; r: 46; }
          100% { stroke-opacity: 0.9; r: 38; }
        }
        @keyframes spin-dash {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -32; }
        }
        @keyframes fade-in-cluster {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        .cluster-new { animation: fade-in-cluster 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>
    </defs>
  );
}

// ─── Node Components ──────────────────────────────────────────────────────────

function UserNode({
  userId, cx, cy, associated, isHovered, isSelected, color,
  onMouseEnter, onMouseLeave, onClick,
}: {
  userId: string; cx: number; cy: number;
  associated: boolean; isHovered: boolean; isSelected: boolean; color: string;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const abbrev = userId.split("-").map(w => w[0]).join("").toUpperCase().slice(0, 3);
  const scale = isHovered ? 1.15 : isSelected ? 1.05 : 1;
  const filterId = `glow-${color.replace("#", "")}`;

  return (
    <g
      style={{
        transformOrigin: `${cx}px ${cy}px`,
        transform: `scale(${scale})`,
        transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        cursor: "pointer",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Animated outer pulse for mismatch */}
      {!associated && (
        <circle cx={cx} cy={cy} r={38} fill="none" stroke="#f43f5e" strokeWidth="1.5"
          strokeOpacity="0.7" strokeDasharray="5 3"
          style={{ animation: "spin-dash 3s linear infinite" }}
        />
      )}

      {/* Glow halo */}
      {isHovered && (
        <circle cx={cx} cy={cy} r={34} fill={color} fillOpacity="0.12"
          filter={`url(#${filterId})`}
        />
      )}

      {/* Selection ring */}
      {isSelected && (
        <circle cx={cx} cy={cy} r={40} fill="none" stroke={color}
          strokeWidth="2" strokeDasharray="none" strokeOpacity="0.5"
        />
      )}

      {/* Status ring */}
      <circle cx={cx} cy={cy} r={35} fill="none"
        stroke={associated ? "#34d399" : "#f43f5e"}
        strokeWidth="1.8"
        strokeOpacity={isHovered ? 1 : 0.6}
        strokeDasharray={associated ? "none" : "5 3"}
      />

      {/* Main circle */}
      <circle cx={cx} cy={cy} r={30}
        fill={isHovered ? `${color}30` : `${color}18`}
        stroke={color}
        strokeWidth={isHovered ? 2.5 : 1.8}
        style={{ transition: "fill 0.15s ease, stroke-width 0.15s ease" }}
      />

      {/* Abbrev */}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="12"
        fontWeight="700" fill={color} fontFamily="monospace"
        style={{ transition: "font-size 0.15s ease" }}
      >
        {abbrev}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7"
        fill={color} fontFamily="sans-serif" opacity="0.75"
      >
        {userId.length > 11 ? userId.slice(0, 10) + "…" : userId}
      </text>

      {/* Association badge */}
      <circle cx={cx + 22} cy={cy - 22} r={8}
        fill={associated ? "#052e16" : "#450a0a"}
        stroke={associated ? "#34d399" : "#f43f5e"}
        strokeWidth="1.5"
      />
      <text x={cx + 22} y={cy - 18} textAnchor="middle"
        fontSize="11" fill={associated ? "#34d399" : "#f43f5e"}
      >
        {associated ? "✓" : "✗"}
      </text>
    </g>
  );
}

function DocNode({
  docType, cx, cy, doc, isMissing, hasMismatch,
  isHovered, isSelected,
  onMouseEnter, onMouseLeave, onClick,
}: {
  docType: string; cx: number; cy: number;
  doc?: DocData | null; isMissing: boolean; hasMismatch: boolean;
  isHovered: boolean; isSelected: boolean;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const w = 56, h = 38, rx = 7;
  const x = cx - w / 2, y = cy - h / 2;
  const scale = isHovered ? 1.18 : isSelected ? 1.08 : 1;
  const color = isMissing ? "#475569" : statusColor(doc?.status ?? "flagged");
  const score = doc?.complianceScore ?? 0;
  const filterId = `glow-${color.replace("#", "")}`;

  return (
    <g
      style={{
        transformOrigin: `${cx}px ${cy}px`,
        transform: `scale(${scale})`,
        transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        cursor: "pointer",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Mismatch animated ring */}
      {hasMismatch && (
        <rect
          x={x - 5} y={y - 5} width={w + 10} height={h + 10} rx={rx + 3}
          fill="none" stroke="#f43f5e" strokeWidth="1.5"
          strokeDasharray="5 3"
          style={{ animation: "spin-dash 2s linear infinite" }}
        />
      )}

      {/* Glow halo on hover */}
      {isHovered && !isMissing && (
        <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={rx + 2}
          fill={color} fillOpacity="0.2" filter={`url(#${filterId})`}
        />
      )}

      {/* Selection ring */}
      {isSelected && (
        <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={rx + 3}
          fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.6"
        />
      )}

      {/* Main rect */}
      <rect x={x} y={y} width={w} height={h} rx={rx}
        fill={isMissing ? "#0f172a" : (isHovered ? `${color}28` : `${color}15`)}
        stroke={color}
        strokeWidth={isHovered ? 2.2 : 1.6}
        strokeDasharray={isMissing ? "4 3" : undefined}
        style={{ transition: "fill 0.15s ease, stroke-width 0.15s ease" }}
      />

      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10"
        fontWeight="700" fill={color} fontFamily="monospace"
      >
        {docType}
      </text>
      <text x={cx} y={cy + 7} textAnchor="middle" fontSize="9"
        fill={isMissing ? "#64748b" : color} fontFamily="monospace"
      >
        {isMissing ? "—" : score}
      </text>
    </g>
  );
}

// ─── Cluster (self-fetching) ──────────────────────────────────────────────────

function ClusterNode({
  userId, cx, cy, isNew,
  hoveredKey, selectedUser, selectedDoc,
  onHover, onHoverEnd, onUserClick, onDocClick,
  onDataLoaded,
}: {
  userId: string; cx: number; cy: number; isNew: boolean;
  hoveredKey: string | null;
  selectedUser: string | null; selectedDoc: string | null;
  onHover: (key: string, e: React.MouseEvent, info: TooltipInfo) => void;
  onHoverEnd: () => void;
  onUserClick: (userId: string) => void;
  onDocClick: (userId: string, doc: string) => void;
  onDataLoaded: (userId: string, data: UserAssocData) => void;
}) {
  const { data, isLoading } = useGetAssociations(userId, {
    query: { queryKey: getGetAssociationsQueryKey(userId) },
  });

  // Notify parent when data arrives
  useEffect(() => {
    if (data) onDataLoaded(userId, data as UserAssocData);
  }, [data, userId, onDataLoaded]);

  const color = getUserColor(userId);
  const userKey = userId;

  if (isLoading || !data) {
    return (
      <g className={isNew ? "cluster-new" : undefined}
        style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r={30} fill="#1e293b" stroke="#334155"
          strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"
        />
        <text x={cx} y={cx} textAnchor="middle" fontSize="9" fill="#475569" dy="4">…</text>
      </g>
    );
  }

  const assocData = data as UserAssocData;
  const docs = assocData.documents ?? {};
  const DOC_TYPES = ["DL", "RC", "IC"] as const;

  const mismatchDocTypes = new Set<string>();
  const mismatchPairs: [string, string][] = [];
  for (const issue of assocData.issues ?? []) {
    if (issue.type === "vehicle_mismatch") {
      mismatchPairs.push(["RC", "IC"]);
      mismatchDocTypes.add("RC");
      mismatchDocTypes.add("IC");
    }
    if (issue.type === "name_mismatch") {
      mismatchPairs.push(["DL", "RC"]);
      mismatchDocTypes.add("DL");
      mismatchDocTypes.add("RC");
    }
  }

  const isUserSelected = selectedUser === userId && !selectedDoc;

  return (
    <g className={isNew ? "cluster-new" : undefined}
      style={{ transformOrigin: `${cx}px ${cy}px` }}>

      {/* Cluster background ellipse */}
      <ellipse cx={cx} cy={cy} rx={148} ry={120}
        fill={`${color}07`} stroke={`${color}18`} strokeWidth="1"
      />

      {/* Edges user → docs */}
      {DOC_TYPES.map((dt) => {
        const off = DOC_OFFSETS[dt];
        const nx = cx + off.dx, ny = cy + off.dy;
        const docKey = dt.toLowerCase() as "dl" | "rc" | "ic";
        const doc = docs[docKey];
        const isMissing = !doc;
        const edgeClr = isMissing ? "#334155" : statusColor(doc.status);
        return (
          <line key={dt} x1={cx} y1={cy} x2={nx} y2={ny}
            stroke={edgeClr} strokeWidth="1.6" strokeOpacity={isMissing ? 0.4 : 0.55}
            strokeDasharray={isMissing ? "5 4" : undefined}
          />
        );
      })}

      {/* Mismatch arcs */}
      {mismatchPairs.map(([d1, d2], i) => {
        const o1 = DOC_OFFSETS[d1], o2 = DOC_OFFSETS[d2];
        const mx = cx + (o1.dx + o2.dx) / 2;
        const my = cy + (o1.dy + o2.dy) / 2 - 28;
        return (
          <path key={i}
            d={`M ${cx + o1.dx} ${cy + o1.dy} Q ${mx} ${my} ${cx + o2.dx} ${cy + o2.dy}`}
            fill="none" stroke="#f43f5e" strokeWidth="1.8"
            strokeDasharray="5 4" strokeOpacity="0.85"
          />
        );
      })}

      {/* Doc nodes */}
      {DOC_TYPES.map((dt) => {
        const off = DOC_OFFSETS[dt];
        const nx = cx + off.dx, ny = cy + off.dy;
        const docKey = dt.toLowerCase() as "dl" | "rc" | "ic";
        const doc = docs[docKey];
        const isMissing = !doc;
        const nodeKey = `${userId}:${dt}`;
        const isHovered = hoveredKey === nodeKey;
        const isSelected = selectedUser === userId && selectedDoc === dt;

        return (
          <DocNode
            key={dt} docType={dt} cx={nx} cy={ny}
            doc={doc ?? null} isMissing={isMissing}
            hasMismatch={mismatchDocTypes.has(dt)}
            isHovered={isHovered} isSelected={isSelected}
            onMouseEnter={(e) => {
              const docInfo = isMissing
                ? { title: `${dt} — Missing`, lines: [`Not uploaded for ${userId}`, "Cannot verify association without this document."], color: "#f59e0b" }
                : {
                    title: `${dt} — ${doc!.status.replace("_", " ")}`,
                    lines: [
                      `Score: ${doc!.complianceScore}/100`,
                      doc!.extractedFields?.name ? `Name: ${doc!.extractedFields.name}` : "",
                      doc!.extractedFields?.vehicleNumber ? `Vehicle: ${doc!.extractedFields.vehicleNumber}` : "",
                      doc!.extractedFields?.expiryDate ? `Expiry: ${doc!.extractedFields.expiryDate}` : "",
                      mismatchDocTypes.has(dt) ? "⚠ Field mismatch detected" : "",
                    ].filter(Boolean),
                    color: isMissing ? "#f59e0b" : statusColor(doc!.status),
                  };
              onHover(nodeKey, e, docInfo);
            }}
            onMouseLeave={onHoverEnd}
            onClick={() => onDocClick(userId, dt)}
          />
        );
      })}

      {/* User node (on top) */}
      <UserNode
        userId={userId} cx={cx} cy={cy}
        associated={assocData.associated}
        isHovered={hoveredKey === userKey}
        isSelected={isUserSelected}
        color={color}
        onMouseEnter={(e) => {
          onHover(userKey, e, {
            title: userId,
            lines: [
              `${assocData.associated ? "✓ Associated" : "✗ Association failed"}`,
              `Confidence: ${Math.round(assocData.confidenceScore * 100)}%`,
              assocData.issues.length > 0
                ? `${assocData.issues.length} issue${assocData.issues.length > 1 ? "s" : ""} detected`
                : "No issues detected",
              Object.values(docs).filter(Boolean).length + "/3 documents uploaded",
            ],
            color,
          });
        }}
        onMouseLeave={onHoverEnd}
        onClick={() => onUserClick(userId)}
      />

      {/* userId label below cluster */}
      <text x={cx} y={cy + 105} textAnchor="middle" fontSize="9"
        fill={color} fillOpacity="0.6" fontFamily="monospace"
      >
        {userId}
      </text>
    </g>
  );
}

// ─── Floating Tooltip ─────────────────────────────────────────────────────────

function Tooltip({ info, containerRef }: { info: TooltipInfo; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const W_TIP = 200;
  const rect = containerRef.current?.getBoundingClientRect();
  const rawX = info.x - (rect?.left ?? 0) + 14;
  const rawY = info.y - (rect?.top ?? 0) - 10;
  const x = Math.min(rawX, (rect?.width ?? 800) - W_TIP - 10);
  const y = Math.max(rawY, 4);

  return (
    <div
      style={{ left: x, top: y, minWidth: W_TIP, pointerEvents: "none", position: "absolute", zIndex: 50 }}
      className="rounded-md border shadow-xl px-3 py-2.5 text-xs"
      style2={{ borderColor: info.color + "60", backgroundColor: "#0f172a" }}
    >
      <div style={{ borderLeft: `3px solid ${info.color}`, paddingLeft: 8 }}>
        <div className="font-bold text-sm mb-1" style={{ color: info.color }}>{info.title}</div>
        {info.lines.map((l, i) => (
          <div key={i} className="text-muted-foreground leading-relaxed">{l}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  allData, selectedUser, selectedDoc, onClose
}: {
  allData: Record<string, UserAssocData>;
  selectedUser: string;
  selectedDoc: string | null;
  onClose: () => void;
}) {
  const data = allData[selectedUser];
  if (!data) return null;
  const color = getUserColor(selectedUser);
  const docs = data.documents ?? {};
  const docKey = selectedDoc ? selectedDoc.toLowerCase() as "dl" | "rc" | "ic" : null;
  const focusedDoc = docKey ? docs[docKey] : null;
  const docLabels: Record<string, string> = {
    DL: "Driving License", RC: "Registration Certificate", IC: "Insurance Certificate"
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 relative"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      <button onClick={onClose}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground text-xs">✕</button>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="font-bold text-sm text-foreground">{selectedUser}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded border ${data.associated ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-rose-500/40 text-rose-400 bg-rose-500/10"}`}>
          {data.associated ? "Associated" : "Mismatched"}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Confidence: <span className="font-mono text-foreground">{Math.round(data.confidenceScore * 100)}%</span>
        </span>
      </div>

      {/* Focused doc */}
      {selectedDoc && (
        <div className="rounded-md border border-border bg-background/50 p-3 text-xs space-y-1.5">
          <div className="font-semibold text-sm text-foreground">{docLabels[selectedDoc] ?? selectedDoc}</div>
          {!focusedDoc ? (
            <div className="text-amber-400">Not uploaded — this node is missing. Association cannot be fully verified.</div>
          ) : (
            <>
              {focusedDoc.extractedFields?.name && <div><span className="text-muted-foreground">Name: </span>{focusedDoc.extractedFields.name}</div>}
              {focusedDoc.extractedFields?.licenseNumber && <div><span className="text-muted-foreground">License: </span><span className="font-mono">{focusedDoc.extractedFields.licenseNumber}</span></div>}
              {focusedDoc.extractedFields?.vehicleNumber && <div><span className="text-muted-foreground">Vehicle: </span><span className="font-mono">{focusedDoc.extractedFields.vehicleNumber}</span></div>}
              {focusedDoc.extractedFields?.expiryDate && <div><span className="text-muted-foreground">Expiry: </span><span className="font-mono">{focusedDoc.extractedFields.expiryDate}</span></div>}
              <div className="pt-1 border-t border-border">
                Score: <span className={`font-bold ${scoreColor(focusedDoc.complianceScore) === "#34d399" ? "text-emerald-400" : focusedDoc.complianceScore >= 50 ? "text-amber-400" : "text-rose-400"}`}>{focusedDoc.complianceScore}/100</span>
                {(focusedDoc.violations?.length ?? 0) > 0 && <span className="text-rose-400 ml-2">· {focusedDoc.violations!.length} violation{focusedDoc.violations!.length !== 1 ? "s" : ""}</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Issues */}
      {!selectedDoc && data.issues.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Issues</div>
          {data.issues.map((issue, i) => (
            <div key={i} className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2.5 text-xs">
              <div className="font-semibold text-rose-400">{issue.description}</div>
              <div className="text-muted-foreground font-mono mt-1">Field: {issue.field}</div>
              {(issue.dlValue || issue.rcValue || issue.icValue) && (
                <div className="mt-2 flex gap-4">
                  {issue.dlValue && <div><span className="text-muted-foreground">DL: </span><span className="font-mono text-foreground">{issue.dlValue}</span></div>}
                  {issue.rcValue && <div><span className="text-muted-foreground">RC: </span><span className="font-mono text-foreground">{issue.rcValue}</span></div>}
                  {issue.icValue && <div><span className="text-muted-foreground">IC: </span><span className="font-mono text-foreground">{issue.icValue}</span></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!selectedDoc && data.issues.length === 0 && (
        <p className="text-xs text-emerald-400">{data.summary ?? "All documents verified and associated."}</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface AssociationGraphProps {
  users: string[];
}

export function AssociationGraph({ users = [] }: AssociationGraphProps) {
  const [allData, setAllData] = useState<Record<string, UserAssocData>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [prevUsers, setPrevUsers] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track which users are "new" (just added) for entrance animation
  const safeUsers = users ?? [];
  const newUsers = safeUsers.filter(u => !prevUsers.includes(u));
  useEffect(() => { setPrevUsers(safeUsers); }, [safeUsers.join(",")]);

  const handleDataLoaded = useCallback((userId: string, data: UserAssocData) => {
    setAllData(prev => ({ ...prev, [userId]: data }));
  }, []);

  const handleHover = useCallback((key: string, e: React.MouseEvent, info: TooltipInfo) => {
    setHoveredKey(key);
    setTooltip({ ...info, x: e.clientX, y: e.clientY });
  }, []);

  const handleHoverEnd = useCallback(() => {
    setHoveredKey(null);
    setTooltip(null);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (tooltip) setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }, [tooltip]);

  const handleUserClick = useCallback((userId: string) => {
    if (selectedUser === userId && !selectedDoc) { setSelectedUser(null); setSelectedDoc(null); }
    else { setSelectedUser(userId); setSelectedDoc(null); }
  }, [selectedUser, selectedDoc]);

  const handleDocClick = useCallback((userId: string, doc: string) => {
    if (selectedUser === userId && selectedDoc === doc) setSelectedDoc(null);
    else { setSelectedUser(userId); setSelectedDoc(doc); }
  }, [selectedUser, selectedDoc]);

  const handleClose = useCallback(() => { setSelectedUser(null); setSelectedDoc(null); }, []);

  const { svgH } = getLayout(safeUsers.length);

  // Summary stats
  const totalAssociated = Object.values(allData).filter(d => d.associated).length;
  const totalMissing = Object.values(allData).reduce((acc, d) => {
    const docs = d.documents ?? {};
    return acc + (["dl", "rc", "ic"] as const).filter(k => !docs[k]).length;
  }, 0);
  const totalMismatches = Object.values(allData).reduce((acc, d) => acc + (d.issues?.length ?? 0), 0);

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        {[
          { label: "Users", value: safeUsers.length, color: "text-foreground" },
          { label: "Associated", value: totalAssociated, color: "text-emerald-400" },
          { label: "Missing Docs", value: totalMissing, color: "text-amber-400" },
          { label: "Mismatches", value: totalMismatches, color: "text-rose-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-md border border-border bg-card p-2.5 text-center">
            <div className="text-muted-foreground mb-0.5">{label}</div>
            <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Graph */}
      <div className="rounded-lg border border-border bg-card overflow-hidden" ref={containerRef}
        onMouseMove={handleMouseMove} style={{ position: "relative" }}>
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Entity–Document Graph · {safeUsers.length} user{safeUsers.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-muted-foreground">Hover or click any node</span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-3 pb-2 text-xs text-muted-foreground">
          {[
            { color: "#34d399", label: "Compliant" },
            { color: "#fbbf24", label: "Review" },
            { color: "#f43f5e", label: "Flagged" },
            { color: "#475569", label: "Missing", dashed: true },
          ].map(({ color, label, dashed }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-5 h-3 rounded-sm" style={{ border: `1.5px ${dashed ? "dashed" : "solid"} ${color}`, background: `${color}18` }} />
              <span>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#f43f5e" strokeWidth="2" strokeDasharray="5 3" /></svg>
            <span>Mismatch</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${SVG_W} ${svgH}`} width="100%" style={{ display: "block" }}>
          <SVGDefs />

          {/* Grid lines */}
          {safeUsers.length > 1 && (
            <>
              {Array.from({ length: getLayout(safeUsers.length).cols - 1 }, (_, i) => {
                const x = SVG_W / getLayout(safeUsers.length).cols * (i + 1);
                return <line key={i} x1={x} y1="10" x2={x} y2={svgH - 10} stroke="#1e293b" strokeWidth="1" />;
              })}
              {Array.from({ length: getLayout(safeUsers.length).rows - 1 }, (_, i) => {
                const y = CELL_H * (i + 1);
                return <line key={i} x1="10" y1={y} x2={SVG_W - 10} y2={y} stroke="#1e293b" strokeWidth="1" />;
              })}
            </>
          )}

          {/* Clusters */}
          {safeUsers.map((uid, i) => {
            const { x, y } = getCenter(i, safeUsers.length);
            return (
              <ClusterNode
                key={uid}
                userId={uid} cx={x} cy={y}
                isNew={newUsers.includes(uid)}
                hoveredKey={hoveredKey}
                selectedUser={selectedUser}
                selectedDoc={selectedDoc}
                onHover={handleHover}
                onHoverEnd={handleHoverEnd}
                onUserClick={handleUserClick}
                onDocClick={handleDocClick}
                onDataLoaded={handleDataLoaded}
              />
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x - (containerRef.current?.getBoundingClientRect().left ?? 0) + 14,
              top: tooltip.y - (containerRef.current?.getBoundingClientRect().top ?? 0) - 16,
              pointerEvents: "none",
              zIndex: 50,
              minWidth: 180,
              maxWidth: 220,
              borderLeft: `3px solid ${tooltip.color}`,
              background: "#0f172a",
              border: `1px solid ${tooltip.color}50`,
              borderRadius: 6,
              padding: "10px 12px",
              boxShadow: `0 8px 32px ${tooltip.color}20`,
            }}
            className="text-xs"
          >
            <div style={{ color: tooltip.color }} className="font-bold text-sm mb-1.5">{tooltip.title}</div>
            {tooltip.lines.map((l, i) => (
              <div key={i} className="text-muted-foreground leading-relaxed">{l}</div>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedUser && allData[selectedUser] && (
        <DetailPanel
          allData={allData}
          selectedUser={selectedUser}
          selectedDoc={selectedDoc}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
