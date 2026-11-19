import type { ComponentChildren } from 'preact';

/** Small illustrated banner at the top of a Today card (like the farm cards in the design). */
export function CardArt({ kind, pill }: { kind: 'mission' | 'challenge' | 'spacing'; pill?: ComponentChildren }) {
  return (
    <div class={'tart tart-' + kind}>
      <svg viewBox="0 0 300 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        {kind === 'mission' ? (
          <>
            <circle cx="238" cy="30" r="16" fill="#FFF3B0" opacity=".9" />
            <path d="M-10 92Q60 54 130 80T310 70L310 120L-10 120Z" fill="#4FB074" />
            <path d="M-10 104Q80 78 170 98T310 92L310 120L-10 120Z" fill="#2F8453" />
            <path d="M148 22l8.4 17.4 19 2.8-13.7 13.4 3.2 19L148 65.7l-16.9 8.9 3.2-19-13.7-13.4 19-2.8z" fill="#FFD54A" stroke="#F2A92B" stroke-width="3" stroke-linejoin="round" />
            <g fill="#fff" opacity=".9"><circle cx="96" cy="34" r="2.4" /><circle cx="205" cy="64" r="2" /><circle cx="64" cy="62" r="1.8" /></g>
          </>
        ) : kind === 'challenge' ? (
          <>
            <circle cx="64" cy="32" r="14" fill="#FFF3B0" opacity=".9" />
            <path d="M-10 96Q70 58 150 84T310 72L310 120L-10 120Z" fill="#E0884A" />
            <path d="M-10 106Q90 82 180 100T310 94L310 120L-10 120Z" fill="#B85F2E" />
            <path d="M172 92V30" stroke="#5A3A24" stroke-width="3.4" stroke-linecap="round" />
            <path d="M172 30L214 42 172 56Z" fill="#FF6B6B" />
            <path d="M118 96l6-24h20l6 24z" fill="#FFD54A" />
            <path d="M121 74c-8 0-9 10 0 12M147 74c8 0 9 10 0 12" fill="none" stroke="#F2A92B" stroke-width="2.6" stroke-linecap="round" />
            <rect x="124" y="60" width="16" height="14" rx="3" fill="#FFE27A" />
          </>
        ) : (
          <>
            <path d="M-10 96Q70 60 150 84T310 74L310 120L-10 120Z" fill="#7B6FD6" />
            <path d="M-10 106Q90 84 180 102T310 96L310 120L-10 120Z" fill="#5B4FB8" />
            <circle cx="150" cy="52" r="30" fill="#fff" />
            <circle cx="150" cy="52" r="30" fill="none" stroke="#5B4FB8" stroke-width="4" />
            <path d="M150 34v18l12 7" fill="none" stroke="#5B4FB8" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" />
            <g fill="#FFD54A" stroke="#F2A92B" stroke-width="2"><circle cx="222" cy="80" r="11" /><circle cx="238" cy="88" r="9" /></g>
            <g fill="#fff" opacity=".85"><circle cx="70" cy="30" r="2.2" /><circle cx="96" cy="58" r="1.8" /><circle cx="236" cy="30" r="2" /></g>
          </>
        )}
      </svg>
      {pill ? <span class="tpill">{pill}</span> : null}
    </div>
  );
}
