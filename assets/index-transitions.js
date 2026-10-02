/* global gsap, ScrollTrigger, setupIndexWorks */
'use strict';
window.setupIndexTransitions = function setupIndexTransitions({ lenis, heroSection }) {
    const track = document.getElementById('featured-track');
    const featured = document.getElementById('zone-2-featured');
    const runway = document.createElement('div');
    runway.className = 'gallery-runway';
    featured.before(runway);
    runway.appendChild(featured);
    const html = document.documentElement;
    // The wrapper reserves the full contact height and clips the portion still
    // behind Logic & Form. Its own box never moves, so anchors remain stable.
    const contact = document.getElementById('contact-section');
    const contactReveal = document.createElement('div');
    contactReveal.className = 'contact-reveal';
    contact.before(contactReveal);
    contactReveal.appendChild(contact);
    const media = gsap.matchMedia();
    let syncGallery = () => {};
    const sheets = ['#zone-about', '#zone-2-featured', '#zone-1', '#contact-section'].map(selector => document.querySelector(selector));
    const surfaces = [sheets[0].firstElementChild, featured.firstElementChild, sheets[2].lastElementChild, document.getElementById('contact-content')];
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
        shortTouch: '(max-height: 480px) and (pointer: coarse)',
        all: '(min-width: 0px)'
    }, context => {
        const { reduced, mobile, shortTouch } = context.conditions;
        const nativeGallery = reduced || shortTouch;
        html.classList.toggle('index-motion', !reduced);
        html.classList.toggle('index-native-gallery', nativeGallery);
        html.classList.toggle('index-scroll-gallery', !nativeGallery);
        lenis.options.smoothWheel = !reduced;
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

        // One live sticky surface now owns both projects and archive entries.
        const gallery = setupIndexWorks({ lenis, featured, track, runway, native: nativeGallery, reduced });
        syncGallery = gallery.refresh;
        window.focusIndexArtifact = gallery.focusTarget;

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
                if (i !== 2) return;
                // Move only content through depth. Keep section edges and all
                // pin ancestors flat; the horizontal gallery stays stationary.
                const arrival = gsap.timeline({
                    scrollTrigger: {
                        id: `chapter-enter-${i}`, trigger: i === 1 ? runway : sheet, start: 'top 94%', end: 'top 30%',
                        scrub: true, invalidateOnRefresh: true
                    }
                });
                if (i !== 1) {
                    arrival.fromTo(surfaces[i], {
                        transformPerspective: 1200, transformOrigin: '50% 18vh',
                        z: mobile ? -35 : -100, y: mobile ? 8 : 16, opacity: .38
                    }, { z: 0, y: 0, opacity: 1, ease: 'power2.out', duration: 1 }, 0);
                }
                arrival.fromTo(seams[i], { scaleX: .65, opacity: 0 }, {
                    scaleX: 1, opacity: .45, ease: 'power2.out', duration: .7
                }, .3);
            });

            // Hold About in place while the opaque works sheet rises over it.
            // The gallery keeps its natural position, then CSS sticky takes
            // over at the top for the existing horizontal browse.
            gsap.fromTo(sheets[0], { y: 0 }, {
                y: () => window.innerHeight, ease: 'none',
                scrollTrigger: {
                    id: 'works-cover', trigger: runway,
                    start: 'top bottom', end: 'top top',
                    scrub: true, invalidateOnRefresh: true
                }
            });

            // Cancel exactly one viewport of document travel. While the lower
            // edge of Logic scrolls from bottom to top, Contact stays still
            // behind it; afterwards the long form resumes normal scrolling.
            gsap.fromTo(contact, { y: () => -window.innerHeight }, {
                y: 0, ease: 'none',
                scrollTrigger: {
                    id: 'contact-uncover', trigger: contactReveal,
                    start: 'top bottom', end: 'top top',
                    scrub: true, invalidateOnRefresh: true
                }
            });
        }

        // Do not leave a focused control behind an entrance mask when tabbing.
        const revealFocus = event => {
            const section = event.target.closest('#zone-about, #zone-1, #zone-2-featured, #contact-section');
            if (!section) return;
            if (section === contact && !reduced && contactReveal.getBoundingClientRect().top > 0) {
                // A keyboard user can tab straight to a form field before the
                // curtain is open. Reveal it before positioning that field.
                lenis.scrollTo(contactReveal, { immediate: true });
                const bounds = event.target.getBoundingClientRect();
                if (bounds.bottom > window.innerHeight || bounds.top < 0) {
                    lenis.scrollTo(event.target, { immediate: true, offset: -96 });
                }
            }
            const transition = ScrollTrigger.getById(`chapter-enter-${sheets.indexOf(section)}`);
            if (transition && transition.progress < 1) {
                transition.animation.progress(1);
                const scrubTween = transition.getTween();
                if (scrubTween) scrubTween.progress(1);
            }
        };
        document.addEventListener('focusin', revealFocus);
        return () => {
            document.removeEventListener('focusin', revealFocus);
            gallery.destroy();
            if (window.focusIndexArtifact === gallery.focusTarget) delete window.focusIndexArtifact;
            syncGallery = () => {};
            runway.style.removeProperty('height');
            html.classList.remove('index-motion', 'index-native-gallery', 'index-scroll-gallery');
        };
    });

    // Track deliberate pointer movement, so scrolling or the changing panel
    // height cannot masquerade as entering/leaving another accordion row.
    const accordion = document.querySelector('.group\\/accordion');
    if (accordion) {
        accordion.classList.add('logic-accordion');
        const rows = Array.from(accordion.querySelectorAll('.accordion-panel'), panel => panel.parentElement);
        const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');
        let hoverTimer, closeTimer, revealTimer;
        let hoverCandidate = null, closeCandidate = null, dismissedRow = null, pinnedRow = null;
        let pointerX = null, pointerY = null;
        const cancelHover = () => {
            clearTimeout(hoverTimer);
            hoverCandidate = null;
        };
        const cancelClose = () => {
            clearTimeout(closeTimer);
            closeCandidate = null;
        };
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
        const onPointerMove = event => {
            if (event.pointerType !== 'mouse' || !hoverCapable.matches) return;
            // Layout changes can retarget the pointer without the hand moving.
            if (pointerX === event.clientX && pointerY === event.clientY) return;
            pointerX = event.clientX;
            pointerY = event.clientY;
            // An explicit click owns the open row until the next click.
            if (pinnedRow) return;
            const hoveredRow = rows.find(row => row.contains(event.target));
            if (hoveredRow !== dismissedRow) dismissedRow = null;
            const open = rows.find(row => row.dataset.open === 'true');
            if (!open || hoveredRow === open) cancelClose();
            else if (closeCandidate !== open) {
                cancelClose();
                closeCandidate = open;
                closeTimer = setTimeout(() => {
                    if (!open.querySelector(':focus-visible')) setOpen(open, false);
                    closeCandidate = null;
                }, 220);
            }
            const control = hoveredRow && hoveredRow.querySelector('.logic-toggle');
            if (!control || !control.contains(event.target) || hoveredRow === open || hoveredRow === dismissedRow) {
                cancelHover();
                return;
            }
            if (hoverCandidate === hoveredRow) return;
            cancelHover();
            hoverCandidate = hoveredRow;
            hoverTimer = setTimeout(() => {
                cancelClose();
                openRow(hoveredRow);
                hoverCandidate = null;
            }, 100);
        };
        document.addEventListener('pointermove', onPointerMove, { passive: true });
        const onPointerOut = event => {
            if (event.relatedTarget !== null || event.pointerType !== 'mouse') return;
            cancelHover();
            cancelClose();
            if (pinnedRow) return;
            closeTimer = setTimeout(() => rows.forEach(row => {
                if (!row.querySelector(':focus-visible')) setOpen(row, false);
            }), 220);
        };
        document.addEventListener('pointerout', onPointerOut);
        const revealRow = row => {
            clearTimeout(revealTimer);
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            // Wait until sibling rows stop moving before choosing a scroll target.
            revealTimer = setTimeout(() => {
                if (row.dataset.open !== 'true' || pinnedRow !== row) return;
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
            cancelHover();
            cancelClose();
            clearTimeout(revealTimer);
            if (pinnedRow === row && row.dataset.open === 'true') {
                pinnedRow = null;
                dismissedRow = row;
                setOpen(row, false);
            } else {
                // Clicking an already-hovered preview keeps its animation going.
                pinnedRow = row;
                dismissedRow = null;
                openRow(row);
                revealRow(row);
            }
        };
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
            control.addEventListener('click', event => {
                toggleRow(row);
            });
            control.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                if (event.repeat) return;
                toggleRow(row);
            });
        });
        window.addEventListener('pagehide', event => {
            cancelHover();
            cancelClose();
            clearTimeout(revealTimer);
            if (event.persisted) return;
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerout', onPointerOut);
        });
    }

    // The accordion is below the gallery: its height never changes gallery
    // geometry. Coalesce its resize frames and refresh only after settling.
    let refreshTimer;
    let galleryDirty = false;
    const refreshLayout = () => {
        clearTimeout(refreshTimer);
        const refreshGallery = galleryDirty;
        galleryDirty = false;
        if (refreshGallery) syncGallery();
        lenis.resize();
        ScrollTrigger.refresh();
    };
    const queueRefresh = () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshLayout, 160);
    };
    const queueGalleryRefresh = () => {
        galleryDirty = true;
        queueRefresh();
    };
    const observer = accordion && window.ResizeObserver ? new ResizeObserver(queueRefresh) : null;
    if (observer) observer.observe(accordion);
    const afterTransition = event => {
        if (event.propertyName === 'grid-template-rows') queueRefresh();
    };
    if (accordion) accordion.addEventListener('transitionend', afterTransition);
    window.addEventListener('works:layout', queueGalleryRefresh);
    window.addEventListener('pagehide', event => {
        if (event.persisted) return;
        clearTimeout(refreshTimer);
        window.removeEventListener('works:layout', queueGalleryRefresh);
        if (observer) observer.disconnect();
        if (accordion) accordion.removeEventListener('transitionend', afterTransition);
        media.revert();
    });
};
