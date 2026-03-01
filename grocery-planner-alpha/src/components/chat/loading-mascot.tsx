"use client";

interface LoadingMascotProps {
  text?: string;
  size?: "sm" | "md";
}

export function LoadingMascot({ text, size = "sm" }: LoadingMascotProps) {
  const scale = size === "sm" ? 0.7 : 1;
  const w = Math.round(160 * scale);
  const h = Math.round(64 * scale);

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <svg
        width={w}
        height={h}
        viewBox="0 0 160 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <style>{`
          .mascot-group { animation: mascot-walk 1.5s ease-in-out infinite; }
          .mascot-body { animation: mascot-bounce 0.6s ease-in-out infinite; }
          .cart-wheel { animation: cart-wheel-spin 0.8s linear infinite; }
          .motion-line { animation: motion-fade 1.2s ease-in-out infinite; }
          .motion-line:nth-child(2) { animation-delay: 0.2s; }
          .motion-line:nth-child(3) { animation-delay: 0.4s; }
          @keyframes mascot-walk {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(5px); }
          }
          @keyframes mascot-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes cart-wheel-spin {
            to { transform: rotate(360deg); }
          }
          @keyframes motion-fade {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.8; }
          }
        `}</style>

        <g className="mascot-group">
          {/* Motion lines behind character */}
          <g className="motion-line" opacity="0.5">
            <line x1="6" y1="30" x2="16" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <g className="motion-line" opacity="0.4">
            <line x1="2" y1="36" x2="14" y2="36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <g className="motion-line" opacity="0.3">
            <line x1="8" y1="42" x2="16" y2="42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* Character body */}
          <g className="mascot-body">
            {/* Body/head (round blob) */}
            <circle cx="38" cy="34" r="14" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.8" />

            {/* Chef hat */}
            <rect x="30" y="14" width="16" height="8" rx="2" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="38" cy="14" r="5" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.2" />
            {/* Hat band */}
            <line x1="30" y1="20" x2="46" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.4" />

            {/* Eyes */}
            <circle cx="33" cy="32" r="2" fill="currentColor" />
            <circle cx="43" cy="32" r="2" fill="currentColor" />
            {/* Eye highlights */}
            <circle cx="34" cy="31" r="0.7" fill="white" />
            <circle cx="44" cy="31" r="0.7" fill="white" />

            {/* Smile */}
            <path d="M34 38 Q38 42 42 38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />

            {/* Blush circles */}
            <circle cx="29" cy="36" r="2.5" fill="currentColor" opacity="0.08" />
            <circle cx="47" cy="36" r="2.5" fill="currentColor" opacity="0.08" />
          </g>

          {/* Arm reaching to cart handle */}
          <line x1="50" y1="36" x2="66" y2="30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />

          {/* Shopping cart */}
          <g>
            {/* Cart handle */}
            <line x1="66" y1="22" x2="66" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* Cart body */}
            <path
              d="M68 24 L130 24 L124 44 L74 44 Z"
              fill="currentColor"
              opacity="0.08"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Cart grid lines (items inside) */}
            <line x1="88" y1="24" x2="86" y2="44" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
            <line x1="108" y1="24" x2="106" y2="44" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
            <line x1="70" y1="34" x2="128" y2="34" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />

            {/* Grocery items peeking out of cart */}
            {/* Apple */}
            <circle cx="80" cy="20" r="4" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1" />
            <line x1="80" y1="16" x2="82" y2="14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            {/* Bread/baguette */}
            <rect x="92" y="14" width="14" height="6" rx="3" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
            {/* Carrot */}
            <path d="M115 20 L122 10 L124 10 L118 22" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="0.8" />

            {/* Cart wheels */}
            <g style={{ transformOrigin: "82px 50px" }} className="cart-wheel">
              <circle cx="82" cy="50" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <line x1="82" y1="46" x2="82" y2="54" stroke="currentColor" strokeWidth="1" />
              <line x1="78" y1="50" x2="86" y2="50" stroke="currentColor" strokeWidth="1" />
            </g>
            <g style={{ transformOrigin: "118px 50px" }} className="cart-wheel">
              <circle cx="118" cy="50" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <line x1="118" y1="46" x2="118" y2="54" stroke="currentColor" strokeWidth="1" />
              <line x1="114" y1="50" x2="122" y2="50" stroke="currentColor" strokeWidth="1" />
            </g>
          </g>
        </g>
      </svg>
      {text && (
        <span className="text-xs italic animate-pulse">{text}</span>
      )}
    </div>
  );
}
