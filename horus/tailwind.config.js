module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: { extend: {
    colors: { void: '#0A0E17', grid: '#1E293B', hud: '#38BDF8',
      conflict: '#FF0033', unrest: '#9333EA', maroon: '#8B0000', election: '#EAB308', anomaly: '#06B6D4' },
    fontFamily: { mono: ['var(--font-mono)', 'Fira Code', 'monospace'] },
    transitionTimingFunction: { weighted: 'cubic-bezier(0.22,1,0.36,1)' },
  } },
};
