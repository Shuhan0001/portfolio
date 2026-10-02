/* Move the selection as one object, without changing gallery scroll geometry. */
(() => {
    'use strict';
    const title = document.getElementById('works-heading');
    const gallery = document.getElementById('zone-2-featured');
    if (!title || !gallery) return;
    const controller = new AbortController();
    const { signal } = controller;
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    let x = 0, y = 0, drag = null, resizeFrame;

    title.classList.add('is-draggable');
    title.tabIndex = 0;
    title.setAttribute('aria-description', 'Drag to move the title. Arrow keys move it; Home or double-click resets its position.');
    title.title = 'Drag to move · Double-click to reset';

    function bounds() {
        const box = title.getBoundingClientRect();
        const stage = gallery.getBoundingClientRect();
        const kicker = gallery.querySelector('.section-kicker').getBoundingClientRect();
        const viewport = gallery.querySelector('.slice-viewport');
        const railTop = viewport.getBoundingClientRect().top + parseFloat(getComputedStyle(viewport).paddingTop);
        const left = box.left - x, top = box.top - y;
        const margin = Math.max(24, parseFloat(getComputedStyle(title).fontSize) * .85);
        return {
            minX: Math.min(0, stage.left + margin - left),
            maxX: Math.max(0, stage.right - margin - left - box.width),
            minY: Math.min(0, kicker.bottom + 16 - top),
            maxY: Math.max(0, railTop - 32 - top - box.height)
        };
    }
    function move(nextX, nextY, limits) {
        x = clamp(nextX, limits.minX, limits.maxX);
        y = clamp(nextY, limits.minY, limits.maxY);
        title.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    function finish() {
        if (!drag) return;
        const id = drag.id;
        drag = null;
        title.classList.remove('is-dragging');
        if (title.hasPointerCapture(id)) title.releasePointerCapture(id);
    }
    function reset() {
        finish();
        x = y = 0;
        title.style.removeProperty('transform');
    }
    title.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary || drag) return;
        const limits = bounds();
        drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y, limits };
        title.setPointerCapture(event.pointerId);
        title.classList.add('is-dragging');
        event.preventDefault();
    }, { signal });
    title.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        move(drag.x + event.clientX - drag.startX, drag.y + event.clientY - drag.startY, drag.limits);
    }, { signal });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
        title.addEventListener(type, event => {
            if (drag && event.pointerId === drag.id) finish();
        }, { signal });
    });
    title.addEventListener('dblclick', reset, { signal });
    title.addEventListener('keydown', event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'Home' || event.key === 'Escape') {
            event.preventDefault();
            reset();
            return;
        }
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!direction) return;
        event.preventDefault();
        finish();
        const step = event.shiftKey ? 24 : 8;
        move(x + direction[0] * step, y + direction[1] * step, bounds());
    }, { signal });
    window.addEventListener('blur', finish, { signal });
    // A wheel gesture hands control back to the page, even mid-drag.
    window.addEventListener('wheel', finish, { signal, passive: true });
    const observer = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
            finish();
            move(x, y, bounds());
        });
    });
    observer.observe(gallery);
    observer.observe(title);
    window.addEventListener('pagehide', event => {
        finish();
        if (event.persisted) return;
        controller.abort();
        observer.disconnect();
        cancelAnimationFrame(resizeFrame);
    }, { signal });
})();
