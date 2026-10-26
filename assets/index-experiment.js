/* Experimental index only. Shared assets are read-only. */
window.setupIndexTransitions = function ({lenis, heroSection}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.set('.gsap-reveal', {autoAlpha: 1, y: 0});
  document.documentElement.classList.add('index-native-gallery');
  const featured = document.getElementById('zone-2-featured');
  const runway = document.createElement('div');
  runway.className = 'gallery-runway'; featured.before(runway); runway.append(featured);
  const gallery = setupIndexWorks({lenis, featured, track: document.getElementById('featured-track'), runway, native: true, reduced});
  window.focusIndexArtifact = gallery.focusTarget;
  if (!reduced) {
    gsap.timeline({scrollTrigger: {trigger: heroSection, start: 'top top', end: () => '+=' + innerHeight * 1.25, pin: true, scrub: true, invalidateOnRefresh: true,
      onUpdate: self => {window.davidScrollProgress = self.progress; window.dispatchEvent(new CustomEvent('david:progress', {detail: self.progress}));}}})
      .to('#hero-back-layer', {opacity: 0, x: '-3vw', duration: .4}, 0)
      .to('#hero-content-wrapper', {opacity: 0, y: 35, duration: .35}, .05)
      .to({}, {duration: .6});
  }
    // Opening is deliberate: mouse, touch and keyboard share the same toggle.
    const accordion = document.querySelector('.group\\/accordion');
    if (accordion) {
        accordion.classList.add('logic-accordion');
        const rows = Array.from(accordion.querySelectorAll('.accordion-panel'), panel => panel.parentElement);
        let revealTimer, activeRow = null;
        const setOpen = (row, open) => {
            if (row.dataset.open === String(open)) return;
            const control = row.querySelector('.logic-toggle');
            const panel = row.querySelector('.accordion-panel');
            row.dataset.open = String(open);
            control.setAttribute('aria-expanded', String(open));
            panel.setAttribute('aria-hidden', String(!open));
            panel.inert = !open;
        };
        const openRow = row => rows.forEach(item => setOpen(item, item === row));
        const revealRow = row => {
            clearTimeout(revealTimer);
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            // Wait until sibling rows stop moving before choosing a scroll target.
            revealTimer = setTimeout(() => {
                if (row.dataset.open !== 'true' || activeRow !== row) return;
                const panel = row.querySelector('.accordion-panel');
                if (panel.getBoundingClientRect().top < window.innerHeight - 180) return;
                lenis.scrollTo(row, {
                    offset: window.innerWidth < 768 ? -120 : -96,
                    duration: .45,
                    immediate: reduced
                });
            }, reduced ? 0 : 520);
        };
        const toggleRow = row => {
            clearTimeout(revealTimer);
            if (activeRow === row && row.dataset.open === 'true') {
                activeRow = null;
                setOpen(row, false);
            } else {
                activeRow = row;
                openRow(row);
                revealRow(row);
            }
        };
        accordion.querySelectorAll('.accordion-panel').forEach((panel, i) => {
            const row = panel.parentElement;
            const control = panel.previousElementSibling;
            const heading = control.querySelector('h4');
            panel.id = `logic-details-${i}`;
            heading.id = `logic-title-${i}`;
            control.classList.add('logic-toggle');
            control.setAttribute('role', 'button');
            control.setAttribute('tabindex', '0');
            control.setAttribute('aria-expanded', 'false');
            control.setAttribute('aria-controls', panel.id);
            control.setAttribute('aria-label', `${heading.textContent.trim()} details`);
            panel.setAttribute('role', 'region');
            panel.setAttribute('aria-labelledby', heading.id);
            panel.inert = true;
            panel.setAttribute('aria-hidden', 'true');
            control.addEventListener('click', () => toggleRow(row));
            control.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                if (event.repeat) return;
                toggleRow(row);
            });
        });
        window.addEventListener('pagehide', () => clearTimeout(revealTimer));
    }


  document.fonts.ready.then(() => {gallery.refresh(); ScrollTrigger.refresh(); lenis.resize();});
  window.addEventListener('pagehide', event => {if (!event.persisted) gallery.destroy();});
};
