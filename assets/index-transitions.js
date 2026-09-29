/* global gsap, ScrollTrigger */
'use strict';
window.setupIndexTransitions = function setupIndexTransitions({ lenis, heroSection }) {
    const track = document.getElementById('featured-track');
    const featured = document.getElementById('zone-2-featured');
    const runway = document.createElement('div');
    runway.className = 'gallery-runway';
    featured.before(runway);
    runway.appendChild(featured);
    const html = document.documentElement;
    const media = gsap.matchMedia();
    let syncGallery = () => {};
    const sheets = ['#zone-about', '#zone-1', '#zone-2-featured', '#zone-3-archive', '#contact-section'].map(selector => document.querySelector(selector));
    const surfaces = [sheets[0].firstElementChild, sheets[1].lastElementChild, featured.firstElementChild, sheets[3].lastElementChild, document.getElementById('contact-content')];
    const seams = sheets.map(section => {
        const seam = document.createElement('div');
        seam.className = 'chapter-seam';
        seam.setAttribute('aria-hidden', 'true');
        section.appendChild(seam);
        return seam;
    });

    media.add({
        reduced: '(prefers-reduced-motion: reduce)',
        mobile: '(max-width: 767px)',
        shortTouch: '(max-height: 740px) and (pointer: coarse)',
        all: '(min-width: 0px)'
    }, context => {
        const { reduced, mobile, shortTouch } = context.conditions;
        const nativeGallery = reduced || shortTouch;
        html.classList.toggle('index-motion', !reduced);
        html.classList.toggle('index-native-gallery', nativeGallery);
        html.classList.toggle('index-scroll-gallery', !nativeGallery);
        lenis.options.smoothWheel = !reduced;
        // Stop at the last link, rather than travelling through the track's
        // unused fixed-width tail. Lenis already smooths the input once.
        const travel = () => Math.max(0, track.lastElementChild.offsetLeft + track.lastElementChild.offsetWidth + parseFloat(getComputedStyle(track).paddingRight) - featured.clientWidth);
        // Remove the old hidden-on-load state before managing section entrances.
        gsap.set('.gsap-reveal', { autoAlpha: 1, y: 0 });
        const passageStart = .62;
        const passagePace = 2.8;
        const heroDuration = passageStart + (1 - passageStart) * passagePace;
        const phaseDistance = phase => window.innerHeight * (mobile ? 1.5 : 1.9) * (phase <= passageStart ? phase : passageStart + (phase - passageStart) * passagePace);

        if (!reduced) {
            // Keep the initial reveal and split at their existing scroll speed.
            // Reserve 2.8x the travel for the close-up and camera passage.
            const hero = gsap.timeline({
                scrollTrigger: {
                    id: 'home-sculpture', trigger: heroSection, start: 'top top',
                    end: () => '+=' + window.innerHeight * (mobile ? 1.5 : 1.9) * heroDuration,
                    pin: true, pinSpacing: true, scrub: true, invalidateOnRefresh: true,
                    onUpdate: self => {
                        const elapsed = self.progress * heroDuration;
                        const phase = elapsed <= passageStart ? elapsed : passageStart + (elapsed - passageStart) / passagePace;
                        window.davidScrollProgress = phase;
                        window.dispatchEvent(new CustomEvent('david:progress', { detail: phase }));
                    }
                }
            });
            hero.to('#hero-back-layer', { scale: .92, x: '-4vw', y: '-2vh', ease: 'none', duration: .42 }, 0)
                .to('#hero-back-layer', { opacity: 0, ease: 'power2.inOut', duration: .3 }, .04)
                .to('#hero-content-wrapper', { scale: .82, y: '6vh', ease: 'none', duration: .42 }, 0)
                .to('#hero-content-wrapper', { opacity: 0, ease: 'power2.inOut', duration: .3 }, .08)
                .to({}, { duration: heroDuration - .42 }, .42);
        } else {
            window.davidScrollProgress = 0;
            window.dispatchEvent(new CustomEvent('david:progress', { detail: 0 }));
        }

        // Native sticky follows the live layout even while an accordion above
        // changes height. No fixed/relative swap or cached pin start is needed.
        let galleryObserver;
        let renderGallery = () => {};
        if (!nativeGallery) {
            let distance = 0, ramp = 0, runwayTravel = 0;
            gsap.set(track, { x: 0, y: 0 });
            const setX = gsap.quickSetter(track, 'x', 'px');
            renderGallery = () => {
                if (!distance) { setX(0); return; }
                const position = Math.max(0, Math.min(runwayTravel, -runway.getBoundingClientRect().top));
                const remaining = runwayTravel - position;
                // Ease the change from vertical to horizontal over a short
                // distance, without a second time-based smoothing/snap layer.
                const x = position < ramp ? position * position / (2 * ramp)
                    : remaining < ramp ? distance - remaining * remaining / (2 * ramp)
                    : position - ramp / 2;
                setX(-x);
            };
            const measureGallery = () => {
                distance = travel();
                ramp = Math.min(144, window.innerHeight * .18, distance * .25);
                runwayTravel = distance + ramp;
                runway.style.height = `${featured.offsetHeight + runwayTravel}px`;
                renderGallery();
            };
            measureGallery();
            galleryObserver = new ResizeObserver(measureGallery);
            galleryObserver.observe(featured);
            galleryObserver.observe(track.lastElementChild);
            syncGallery = renderGallery;
            lenis.on('scroll', renderGallery);
            window.addEventListener('scroll', renderGallery, { passive: true });
        } else {
            runway.style.removeProperty('height');
            syncGallery = () => {};
        }

        if (!reduced) {
            // The real About content occupies the space beyond the slices.
            // Cancel its ordinary upward travel during the handoff, so it
            // stays in the viewing corridor while growing to reading size.
            // It then returns to ordinary document flow without a second pin.
            const introStart = .84;
            const introTravel = () => phaseDistance(1) - phaseDistance(introStart);
            const handoff = gsap.timeline({
                scrollTrigger: {
                    id: 'chapter-enter-0', trigger: heroSection,
                    start: () => phaseDistance(introStart),
                    end: () => phaseDistance(1),
                    scrub: true, invalidateOnRefresh: true
                }
            });
            handoff.fromTo(surfaces[0], { y: () => -introTravel() }, {
                y: 0, ease: 'none', duration: 1
            }, 0).fromTo(surfaces[0], {
                scale: mobile ? .88 : .8, opacity: 0, transformOrigin: '50% 50%'
            }, {
                scale: 1, opacity: 1, ease: 'power2.out', duration: .92
            }, .08).fromTo(html, { '--chapter-stream-gain': 1 }, {
                '--chapter-stream-gain': .4, ease: 'power2.inOut', duration: .9
            }, .1);

            sheets.forEach((sheet, i) => {
                if (i === 0) return;
                // Move only content through depth. Keep section edges and all
                // pin ancestors flat; the horizontal gallery stays stationary.
                const arrival = gsap.timeline({
                    scrollTrigger: {
                        id: `chapter-enter-${i}`, trigger: i === 2 ? runway : sheet, start: 'top 94%', end: 'top 30%',
                        scrub: true, invalidateOnRefresh: true
                    }
                });
                if (i !== 2) {
                    arrival.fromTo(surfaces[i], {
                        transformPerspective: 1200, transformOrigin: '50% 18vh',
                        z: mobile ? -35 : -100, y: mobile ? 8 : 16, opacity: .38
                    }, { z: 0, y: 0, opacity: 1, ease: 'power2.out', duration: 1 }, 0);
                }
                arrival.fromTo(seams[i], { scaleX: .65, opacity: 0 }, {
                    scaleX: 1, opacity: .45, ease: 'power2.out', duration: .7
                }, .3);
            });

            // Only the outgoing content recedes. Section boxes keep their layout
            // and the gallery pin retains a stable, untransformed ancestor.
            [
                { content: surfaces[0], next: sheets[1] },
                { content: surfaces[1], next: document.getElementById('zone-2-works') },
                { content: document.querySelector('#zone-2-works > div:last-child'), next: sheets[3] },
                { content: surfaces[3], next: sheets[4] }
            ].forEach(({ content, next }, i) => {
                gsap.fromTo(content, { scale: 1 }, {
                    scale: mobile ? .99 : .965, transformOrigin: '50% 100%', ease: 'none', immediateRender: false,
                    scrollTrigger: { id: `chapter-exit-${i}`, trigger: next, start: 'top 78%', end: 'top 12%', scrub: true, invalidateOnRefresh: true }
                });
            });

            // Small follow-through in reading order, with no wipe over text.
            document.querySelectorAll('.archive-row').forEach((row, i) => {
                gsap.fromTo(row, { opacity: .4, y: 6 }, {
                    opacity: 1, y: 0, ease: 'power2.out',
                    scrollTrigger: { trigger: row, start: 'top 102%', end: 'top 86%', scrub: true }
                });
            });
            gsap.fromTo('#contact-content > .grid > *', { y: mobile ? 8 : 16 }, {
                y: 0, stagger: .12, ease: 'power2.out',
                scrollTrigger: { trigger: '#contact-content > .grid', start: 'top 94%', end: 'top 60%', scrub: true }
            });
        }

        // Do not leave a focused control behind an entrance mask when tabbing.
        const revealFocus = event => {
            const section = event.target.closest('#zone-about, #zone-1, #zone-2-featured, #zone-3-archive, #contact-section');
            if (!section) return;
            const transition = ScrollTrigger.getById(`chapter-enter-${sheets.indexOf(section)}`);
            if (transition && transition.progress < 1) {
                transition.animation.progress(1);
                transition.getTween()?.progress(1);
            }
        };
        document.addEventListener('focusin', revealFocus);
        return () => {
            document.removeEventListener('focusin', revealFocus);
            if (galleryObserver) galleryObserver.disconnect();
            lenis.off('scroll', renderGallery);
            window.removeEventListener('scroll', renderGallery);
            syncGallery = () => {};
            runway.style.removeProperty('height');
            html.classList.remove('index-motion', 'index-native-gallery', 'index-scroll-gallery');
        };
    });

    // Hover must never collapse content just because scrolling moved it away
    // from the pointer. Explicit, persistent controls work on touch/keyboard too.
    const accordion = document.querySelector('.group\\/accordion');
    if (accordion) {
        accordion.classList.add('logic-accordion');
        accordion.querySelectorAll('.accordion-panel').forEach((panel, i) => {
            const row = panel.parentElement;
            const control = panel.previousElementSibling;
            const heading = control.querySelector('h4');
            panel.classList.remove('group-hover/row:grid-rows-[1fr]');
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
            const toggle = () => {
                const open = row.dataset.open !== 'true';
                row.dataset.open = String(open);
                control.setAttribute('aria-expanded', String(open));
                panel.setAttribute('aria-hidden', String(!open));
                panel.inert = !open;
            };
            control.addEventListener('click', toggle);
            control.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                if (!event.repeat) toggle();
            });
        });
    }

    // The sticky scene reads the live boundary during resizing; only the other
    // decorative section triggers need a single remeasure after settling.
    let refreshTimer;
    const refreshLayout = () => {
        clearTimeout(refreshTimer);
        lenis.resize();
        ScrollTrigger.refresh();
        syncGallery();
    };
    const queueRefresh = () => {
        syncGallery();
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshLayout, 160);
    };
    const observer = accordion && window.ResizeObserver ? new ResizeObserver(queueRefresh) : null;
    if (observer) observer.observe(accordion);
    const afterTransition = event => {
        if (event.propertyName === 'grid-template-rows') refreshLayout();
    };
    if (accordion) accordion.addEventListener('transitionend', afterTransition);
    window.addEventListener('pagehide', event => {
        if (event.persisted) return;
        clearTimeout(refreshTimer);
        if (observer) observer.disconnect();
        if (accordion) accordion.removeEventListener('transitionend', afterTransition);
        media.revert();
    });
};
