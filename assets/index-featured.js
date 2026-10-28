/* A single broadcast-style white wipe reveals each cover as it enters view. */
(() => {
    'use strict';
    const cards = document.querySelectorAll('.focus-work');
    document.querySelectorAll('.focus-work__link').forEach(link => {
        link.addEventListener('click', event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            history.replaceState({ ...history.state, portfolioArtifact: link.dataset.artifact }, '');
        });
    });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const card = entry.target;
            observer.unobserve(card);
            const image = card.querySelector('img');
            const wipe = card.querySelector('.focus-work__wipe');
            // Never leave an unloaded cover hidden. Decode before starting the reveal.
            const ready = image.decode ? image.decode().catch(() => {}) : Promise.resolve();
            ready.then(() => {
                if (!card.isConnected) return;
                wipe.animate([
                    { transform:'translateX(-125%) skewX(-14deg)', offset:0 },
                    { transform:'translateX(0%) skewX(0deg)', offset:.38 },
                    { transform:'translateX(0%) skewX(0deg)', offset:.48 },
                    { transform:'translateX(125%) skewX(-14deg)', offset:1 }
                ], { duration:1150, easing:'cubic-bezier(.65,0,.2,1)', fill:'forwards' });
                image.animate([{ opacity:0, transform:'scale(1.065)' },{ opacity:1, transform:'scale(1)' }],
                    { duration:750, delay:420, fill:'backwards', easing:'cubic-bezier(.2,.7,.2,1)' });
            });
        }
    }, { threshold:.12, rootMargin:'0px 0px -12% 0px' });
    cards.forEach(card => observer.observe(card));
    addEventListener('pagehide', () => observer.disconnect(), { once:true });
})();
