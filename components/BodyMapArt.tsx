// Detailed anatomical art for the body map — a stylized human figure
// with the skeleton and the organs/parts drawn in, front and back.
// Drawn as layered SVG (skin silhouette → bones → organs) on a
// 240×540 canvas. Purely decorative: pointer events stay off so the
// tappable heat regions in BodyMap receive the clicks.

function Silhouette() {
  return (
    <g className="bm-skin">
      <ellipse cx="120" cy="46" rx="27" ry="33" />
      <path d="M107 72 h26 v22 h-26 z" />
      <path d="M64 110 Q120 88 176 110 L164 250 Q120 268 76 250 Z" />
      <path d="M76 246 h88 l5 42 h-98 z" />
      <rect x="82" y="284" width="32" height="228" rx="14" />
      <rect x="126" y="284" width="32" height="228" rx="14" />
      <g transform="rotate(4 47 108)">
        <rect x="36" y="106" width="22" height="196" rx="10" />
      </g>
      <g transform="rotate(-4 193 108)">
        <rect x="182" y="106" width="22" height="196" rx="10" />
      </g>
      <ellipse cx="97" cy="520" rx="17" ry="7" />
      <ellipse cx="143" cy="520" rx="17" ry="7" />
    </g>
  );
}

/** One side of the limb bones; mirrored by the caller for the other. */
function LimbBones() {
  return (
    <g className="bm-bone-line">
      {/* arm: humerus, radius/ulna, hand */}
      <path d="M50 118 L45 194" />
      <path d="M44 200 L41 264" />
      <path d="M50 200 L48 264" />
      <path d="M41 264 L38 282 M45 266 L44 286 M49 264 L52 282" className="bm-bone-thin" />
      {/* leg: femur, tibia/fibula, foot */}
      <path d="M99 296 L101 396" className="bm-bone-thick" />
      <circle cx="101" cy="404" r="6" className="bm-bone-dot" />
      <path d="M101 412 L102 500" />
      <path d="M109 412 L109 492" className="bm-bone-thin" />
      <path d="M102 504 L88 518" className="bm-bone-thin" />
    </g>
  );
}

function Ribs() {
  const rows = [128, 144, 160, 176, 192];
  return (
    <g className="bm-bone-line">
      <path d="M120 104 L86 114 M120 104 L154 114" />
      {rows.map((y, i) => (
        <path key={y} d={`M120 ${y} C ${98 - i * 3} ${y - 8}, ${80 - i * 2} ${y + 2}, ${76 - i} ${y + 16}`} />
      ))}
      {rows.map((y, i) => (
        <path key={`r${y}`} d={`M120 ${y} C ${142 + i * 3} ${y - 8}, ${160 + i * 2} ${y + 2}, ${164 + i} ${y + 16}`} />
      ))}
      <path d="M120 112 L120 198" className="bm-bone-thick" />
    </g>
  );
}

function PelvisBones() {
  return (
    <g className="bm-bone">
      <path d="M118 258 C 96 246, 76 254, 78 278 C 80 300, 100 308, 112 296 L118 282 Z" />
      <path d="M122 258 C 144 246, 164 254, 162 278 C 160 300, 140 308, 128 296 L122 282 Z" />
      <path d="M120 262 L110 292 h20 Z" />
    </g>
  );
}

function Spine() {
  return (
    <g className="bm-bone">
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x="113" y={96 + i * 10.5} width="14" height="7.5" rx="3" />
      ))}
    </g>
  );
}

function SkullFace() {
  return (
    <g>
      <path className="org-brain" d="M101 30 C 104 16, 136 16, 139 30 C 146 40, 140 52, 131 50 C 126 56, 114 56, 109 50 C 100 52, 94 40, 101 30 Z" />
      <ellipse className="org-eye" cx="109" cy="47" rx="5.5" ry="4" />
      <ellipse className="org-eye" cx="131" cy="47" rx="5.5" ry="4" />
      <circle cx="109" cy="47" r="2" className="org-pupil" />
      <circle cx="131" cy="47" r="2" className="org-pupil" />
      <path d="M120 50 L117 60 h6" className="bm-detail" />
      <path d="M108 68 Q120 73 132 68" className="bm-detail" />
      <path d="M104 74 h32 M108 74 v6 M116 74 v6 M124 74 v6 M132 74 v6" className="bm-detail" />
    </g>
  );
}

function FrontOrgans() {
  return (
    <g>
      {/* thyroid */}
      <path className="org-thyroid" d="M120 84 C 112 78, 106 84, 108 90 C 110 95, 116 94, 120 90 C 124 94, 130 95, 132 90 C 134 84, 128 78, 120 84 Z" />
      {/* lungs (anatomical right = screen left) */}
      <path className="org-lung" d="M114 116 C 96 108, 78 120, 77 148 L 78 178 C 79 196, 94 204, 112 198 C 116 176, 116 140, 114 116 Z" />
      <path className="org-lung" d="M126 116 C 144 108, 162 120, 163 148 L 162 178 C 161 196, 146 204, 128 198 C 124 176, 124 140, 126 116 Z" />
      {/* trachea + bronchi */}
      <path d="M120 92 L120 122 M120 122 L100 138 M120 122 L140 138" className="bm-airway" />
      {/* heart (anatomical left = screen right of center) */}
      <path className="org-heart" d="M132 138 C 122 128, 108 138, 112 152 C 115 164, 128 172, 134 180 C 138 171, 150 163, 150 150 C 150 138, 140 131, 132 138 Z" />
      {/* diaphragm */}
      <path d="M76 202 Q120 188 164 202" className="bm-detail-strong" />
      {/* liver (screen left) + gallbladder */}
      <path className="org-liver" d="M74 210 C 76 202, 128 200, 134 210 C 132 228, 118 240, 98 240 C 82 240, 72 228, 74 210 Z" />
      <ellipse className="org-gall" cx="94" cy="240" rx="6" ry="8" />
      {/* stomach (screen right) */}
      <path className="org-stomach" d="M132 212 C 146 206, 160 212, 159 224 C 158 236, 146 243, 137 239 C 130 236, 127 218, 132 212 Z" />
      {/* spleen (far screen right, behind stomach edge) */}
      <ellipse className="org-spleen" cx="163" cy="228" rx="7" ry="10" transform="rotate(18 163 228)" />
      {/* kidneys (flanks, behind the bowel) */}
      <ellipse className="org-kidney" cx="80" cy="246" rx="8" ry="13" transform="rotate(-14 80 246)" />
      <ellipse className="org-kidney" cx="160" cy="246" rx="8" ry="13" transform="rotate(14 160 246)" />
      {/* intestines */}
      <path className="org-bowel" d="M88 250 C 84 282, 88 300, 100 302 L 140 302 C 152 300, 156 282, 152 250 C 140 242, 100 242, 88 250 Z" />
      <path d="M94 262 C 104 254, 116 264, 126 256 C 136 250, 146 258, 145 266 C 144 276, 132 272, 124 278 C 114 285, 102 276, 95 282 C 89 276, 90 268, 94 262 Z M98 290 C 108 284, 120 292, 132 286 C 140 282, 146 288, 144 294" className="bm-coil" />
      {/* bladder */}
      <ellipse className="org-bladder" cx="120" cy="312" rx="11" ry="9" />
    </g>
  );
}

function BackDetails() {
  return (
    <g>
      {/* skull back + jaw hint */}
      <path d="M100 66 Q120 74 140 66" className="bm-detail" />
      {/* scapulae */}
      <g className="bm-bone">
        <path d="M88 118 L114 124 L97 160 Z" />
        <path d="M152 118 L126 124 L143 160 Z" />
      </g>
      {/* kidneys on the lower back */}
      <ellipse className="org-kidney" cx="99" cy="244" rx="10" ry="15" transform="rotate(-12 99 244)" />
      <ellipse className="org-kidney" cx="141" cy="244" rx="10" ry="15" transform="rotate(12 141 244)" />
      {/* glute fold */}
      <path d="M84 292 Q102 302 118 294 M122 294 Q138 302 156 292" className="bm-detail" />
      {/* calf lines */}
      <path d="M92 442 C 88 470, 90 492, 96 508 M148 442 C 152 470, 150 492, 144 508" className="bm-detail" />
    </g>
  );
}

export function FrontArt() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <Silhouette />
      <LimbBones />
      <g transform="translate(240 0) scale(-1 1)">
        <LimbBones />
      </g>
      <Ribs />
      <PelvisBones />
      <FrontOrgans />
      <SkullFace />
    </g>
  );
}

export function BackArt() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <Silhouette />
      <LimbBones />
      <g transform="translate(240 0) scale(-1 1)">
        <LimbBones />
      </g>
      <Ribs />
      <Spine />
      <PelvisBones />
      <BackDetails />
    </g>
  );
}
