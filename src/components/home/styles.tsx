export function EStyles() {
  return (
    <style>{`
      @media (prefers-reduced-motion: no-preference) {
        html { scroll-behavior: smooth }
        .e-float { animation: e-float 5s ease-in-out infinite alternate }
        .e-card { transition: border-color .25s ease-out, box-shadow .25s ease-out }
        .e-glow { transition: opacity .25s ease-out }
        .e-arrow { transition: transform .2s ease-out }
        .e-plus { transition: transform .25s ease-out }
        .e-acc { transition: grid-template-rows .25s ease-out }
        .e-bar { transition: transform .25s ease-out }
        .e-menu { transition: opacity .2s ease-out, transform .2s ease-out, visibility .2s }
        .e-tile { transition: transform .25s ease-out, border-color .25s ease-out, box-shadow .25s ease-out }
        .e-press { transition: transform .15s ease-out, background-color .2s, border-color .25s ease-out, box-shadow .25s ease-out }
        .e-logo { transition: background-color .2s ease-out }
        .e-head { transition: background-color .25s ease-out, box-shadow .25s ease-out, padding .25s ease-out }
        .e-pay { transition: transform .2s ease-out, border-color .25s ease-out }
        .e-halo { transition: opacity .25s ease-out }
        .e-pay:active { transform: translateY(-3px) scale(.97) }
        /* Retour d'appui (toucher) : court, transform seulement */
        .e-press:active { transform: scale(.97) }
        @media (hover: hover) {
          a:hover > .e-arrow, button:hover > .e-arrow { transform: translateX(3px) }
          .e-tile:hover { transform: translateY(-4px) }
          .e-pay:hover { transform: translateY(-3px) scale(1.05) }
          a.e-press:hover { transform: translateY(-2px) }
          a.e-press:active, .e-tile:active { transform: scale(.97) }
        }
      }
      @keyframes e-float { from { transform: translateY(0) } to { transform: translateY(-8px) } }
      .e-glow { position: absolute; inset: 0; opacity: 0; pointer-events: none;
        background: radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--lp-accent-9) 22%, transparent), transparent 70%) }
      .e-halo { opacity: .3 }
      .e-pay:active { border-color: var(--glow) }
      .e-pay:active .e-halo { opacity: .85 }
      .e-logo { background-color: var(--lp-gray-11) }
      .e-logo-host:active .e-glow, .e-card:active .e-glow { opacity: 1 }
      .e-card:active { border-color: var(--lp-accent-8); box-shadow: 0 0 0 1px var(--lp-accent-8), 0 8px 24px -10px color-mix(in srgb, var(--lp-accent-9) 55%, transparent) }
      .e-logo-host:active .e-logo { background-color: var(--lp-gray-12) }
      @media (hover: hover) {
        .e-pay:hover { border-color: var(--glow) }
        .e-pay:hover .e-halo { opacity: .85 }
        .e-card:hover .e-glow, .e-tile:hover .e-glow { opacity: 1 }
        .e-card:hover { border-color: var(--lp-accent-8); box-shadow: 0 0 0 1px var(--lp-accent-8), 0 12px 32px -12px color-mix(in srgb, var(--lp-accent-9) 45%, transparent) }
        .e-logo-host:hover .e-logo { background-color: var(--lp-gray-12) }
      }
      .e-card:focus-within .e-glow { opacity: 1 }
      .e-plus-open { transform: rotate(45deg) }
      .e-acc { display: grid; grid-template-rows: 0fr }
      .e-acc-open { grid-template-rows: 1fr }
      .e-menu[data-open='false'] { opacity: 0; transform: translateY(-8px); visibility: hidden; pointer-events: none }
      .e-bar[data-show='false'] { transform: translateY(110%) }
      .e-grid { background-image: linear-gradient(var(--lp-gray-3) 1px, transparent 1px), linear-gradient(90deg, var(--lp-gray-3) 1px, transparent 1px); background-size: 56px 56px;
        mask-image: radial-gradient(70% 60% at 50% 30%, #000, transparent 80%); -webkit-mask-image: radial-gradient(70% 60% at 50% 30%, #000, transparent 80%) }
    `}</style>
  );
}
