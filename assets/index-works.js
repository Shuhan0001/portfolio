/* Continuous rightward archive rail; vertical scrolling always remains with the page. */
(function (root) {
    'use strict';
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const ease = progress => (1 - Math.cos(Math.PI * progress)) / 2;
    function scrollState(position, travel, distance, count, native = false) {
        const progress = travel > 0 ? clamp(position / travel, 0, 1) : 0;
        const phase = native ? progress : ease(progress);
        return { x: phase * distance, index: Math.round(phase * Math.max(0, count - 1)), progress };
    }
    function positionForIndex(index, count, travel, native = false) {
        const phase = count > 1 ? clamp(index / (count - 1), 0, 1) : 0;
        return (native ? phase : Math.acos(1 - 2 * phase) / Math.PI) * travel;
    }

    function titleLines(title) {
        if (title === 'Threshold') return ['THRESH', 'OLD'];
        return title.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s-]+/);
    }
    function rectFrame(rect) {
        return { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' };
    }
    function clipFrame(rect) {
        return { clipPath: `inset(${rect.top}px calc(100% - ${rect.left + rect.width}px) calc(100% - ${rect.top + rect.height}px) ${rect.left}px)` };
    }

    function setupIndexWorks({ lenis, featured, track, runway, native, reduced }) {
        const viewport = featured.querySelector('.slice-viewport');
        const items = Array.from(track.querySelectorAll('.artifact-slice'));
        const title = document.getElementById('slice-current-title');
        const indexNav = document.getElementById('slice-index');
        const category = document.getElementById('slice-current-category');
        const dialog = document.getElementById('work-viewer');
        const surface = dialog.querySelector('.work-viewer__surface');
        const frame = dialog.querySelector('.work-viewer__frame');
        const heading = document.getElementById('work-viewer-title');
        const outlineHeading = document.getElementById('work-viewer-title-outline');
        const outlineWindow = dialog.querySelector('.work-viewer__title-window');
        const topBar = dialog.querySelector('.work-viewer__top');
        const description = dialog.querySelector('.work-viewer__description');
        const neighbours = dialog.querySelector('.work-viewer__neighbours');
        const neighbourButtons = ['previous', 'next'].map(side => dialog.querySelector('.work-viewer__neighbour--' + side));
        const media = dialog.querySelector('.work-viewer__media');
        const closeButton = dialog.querySelector('.work-viewer__close');
        const controller = new AbortController();
        const { signal } = controller;
        let distance = 0, travel = 0, current = -1, previousX = null;
        native = false;
        featured.classList.add('is-looping');
        let railX = 0, period = 0, autoFrame = 0, lastTime = 0, hovered = false, seekMotion = null;
        let visible = false, hoveredIndex = null;
        title.setAttribute('aria-live','off');
        category.setAttribute('aria-live','off');
        const positionLabel=document.createElement('span');
        positionLabel.className='slice-loop-position';
        indexNav.before(positionLabel);
        const copies = [];
        const originals = Array.from(track.children);
        items.forEach((item,index) => item.dataset.loopIndex = index);
        function copyGroups(before) {
            const fragment = document.createDocumentFragment();
            originals.forEach(group => {
                const copy = group.cloneNode(true);
                copy.removeAttribute('id');
                copy.setAttribute('aria-hidden','true');
                copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
                copy.querySelectorAll('a,button').forEach(el => el.tabIndex = -1);
                copy.addEventListener('click', event => {
                    const card = event.target.closest('.artifact-slice');
                    if (!card || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    const original = items[Number(card.dataset.loopIndex)];
                    railX += card.getBoundingClientRect().left-original.getBoundingClientRect().left;
                    track.style.transform = 'translate3d('+railX+'px,0,0)';
                    openItem(original);
                }, {signal});
                copies.push(copy); fragment.append(copy);
            });
            before ? track.prepend(fragment) : track.append(fragment);
        }
        copyGroups(true); copyGroups(false);
        viewport.addEventListener('pointerleave',()=>{hovered=false;hoveredIndex=null;render(false);},{signal});
        viewport.addEventListener('pointerover',event=>{
            const card=event.target.closest('.artifact-slice');
            if(card){hovered=true;hoveredIndex=Number(card.dataset.loopIndex);render(false);}
        },{signal});
        viewport.addEventListener('pointerout',event=>{
            const next=event.relatedTarget;
            const card=next instanceof Element ? next.closest('.artifact-slice') : null;
            if(!card || !viewport.contains(card)){hovered=false;hoveredIndex=null;render(false);}
        },{signal});
        viewport.addEventListener('wheel',event=>{
            if(dialog.open || !period || !event.deltaX) return;
            seekMotion=null;railX-=event.deltaX;render();
        },{passive:true,signal});
        let touchX = null;
        viewport.addEventListener('touchstart',event=>{touchX=event.touches[0].clientX;hovered=true;},{passive:true,signal});
        viewport.addEventListener('touchmove',event=>{if(touchX===null)return;const x=event.touches[0].clientX;railX+=x-touchX;touchX=x;seekMotion=null;render();},{passive:true,signal});
        viewport.addEventListener('touchend',()=>{touchX=null;hovered=false;},{passive:true,signal});
        viewport.addEventListener('touchcancel',()=>{touchX=null;hovered=false;},{passive:true,signal});
        const visibilityObserver = new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{threshold:0});
        visibilityObserver.observe(featured);
        function autoplay(time) {
            if(destroyed)return;
            const dt=Math.min((time-lastTime)/1000,.05);lastTime=time;
            if(!document.hidden && !dialog.open) {
                if(seekMotion) {
                    const t=clamp((time-seekMotion.start)/850,0,1);
                    railX=seekMotion.from+(seekMotion.to-seekMotion.from)*ease(t);
                    if(t===1)seekMotion=null;
                    render(false);
                } else if(visible && !reduced && !hovered && !featured.querySelector(':focus-visible')) {
                    railX+=dt*26;render(false);
                }
            }
            autoFrame=requestAnimationFrame(autoplay);
        }
        let motionTimer, resizeFrame, captionAnimation, frameAnimation;
        let viewerAnimations = [], titleRows = [];
        let opener = null, closing = false, destroyed = false, restoringFocus = false;
        let wasStopped = false;
        let viewerIndex = -1, switching = false, switchVersion = 0, queuedDirection = 0;
        let viewerMoved = false, outgoingFrame = null;
        const exploreLink = document.getElementById('work-viewer-link');
        function rememberReturn(item) {
            if (!item?.id) return;
            // Keep this on the history entry being left, so browser Back also
            // restores the viewed project, including after a neighbour switch.
            history.replaceState({ ...history.state, portfolioArtifact: item.id }, '');
        }
        exploreLink.addEventListener('click', event => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const displayedItem = items[viewerIndex];
            rememberReturn(displayedItem?.href === exploreLink.href ? displayedItem
                : items.find(item => item.href === exploreLink.href));
        }, { signal });


        // Derive navigation from the covers so its order and labels stay in sync.
        indexNav.replaceChildren();
        const ticks = items.map((item, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'slice-index__tick hover-trigger';
            button.setAttribute('aria-label', `Go to ${item.dataset.title}`);
            button.setAttribute('aria-controls', track.id);
            const label = document.createElement('span');
            label.className = 'slice-index__name';
            label.textContent = item.dataset.title;
            label.setAttribute('aria-hidden', 'true');
            button.appendChild(label);
            button.addEventListener('click', () => seek(index, false, true), { signal });
            button.addEventListener('keydown', event => {
                if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                const next = event.key === 'ArrowRight' ? (index + 1) % items.length
                    : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
                if (next === null) return;
                event.preventDefault();
                ticks[next].focus({ preventScroll: true });
                seek(next, false, true);
            }, { signal });
            indexNav.appendChild(button);
            return button;
        });

        function select(index, animate = true) {
            if (index === current) return;
            current = index;
            items.forEach((item, i) => {
                item.classList.toggle('is-current', i === index);
                item.classList.toggle('is-adjacent', Math.abs(i - index) === 1);
                if (i === index) item.setAttribute('aria-current', 'true');
                else item.removeAttribute('aria-current');
                if (i === index) ticks[i].setAttribute('aria-current', 'true');
                else ticks[i].removeAttribute('aria-current');
            });
            const item = items[index];
            title.textContent = item.dataset.title;
            category.textContent = item.dataset.category;
            positionLabel.textContent=String(index+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');
            ticks.forEach((tick,i)=>tick.setAttribute('aria-label',(i===index?'Current project: ':'Show ')+items[i].dataset.title));
            captionAnimation?.cancel();
            if (animate && !reduced && title.animate) {
                captionAnimation = title.animate([
                    { opacity: .65, transform: 'translateY(4px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
            }
        }

        function settle() {
            clearTimeout(motionTimer);
            featured.classList.remove('is-scrolling');
        }
        function render(allowMotion = true) {
            if (destroyed || dialog.open || !period) return;
            if (viewport.scrollLeft) viewport.scrollLeft = 0;
            if(!seekMotion) { while(railX>0)railX-=period; while(railX<=-period)railX+=period; }
            track.style.transform = 'translate3d('+railX+'px,0,0)';
            const center=viewport.getBoundingClientRect().left+viewport.clientWidth/2;
            let nearest=0,delta=Infinity;
            track.querySelectorAll('.artifact-slice').forEach(card=>{
                const rect=card.getBoundingClientRect(),d=Math.abs(rect.left+rect.width/2-center);
                if(d<delta){delta=d;nearest=Number(card.dataset.loopIndex);}
            });
            select(hoveredIndex ?? nearest,allowMotion);
            featured.classList.toggle('is-scrolling',visible && (!reduced || hoveredIndex !== null));
            copies.forEach(group=>group.querySelectorAll('.artifact-slice').forEach(card=>{
                card.classList.toggle('is-current',Number(card.dataset.loopIndex)===current);
                card.classList.remove('is-adjacent');
            }));
        }
        const onScroll = () => render(false);
        function measure() {
            if (destroyed) return;
            const old=period;
            period=originals[0].getBoundingClientRect().left-copies[0].getBoundingClientRect().left;
            if(old)railX=railX/old*period;
            else railX=-period;
            const changed=!!runway.style.height;
            runway.style.removeProperty('height');travel=0;
            render(false);
            if(changed)window.dispatchEvent(new CustomEvent('works:layout'));
        }
        function seek(index, focus = false, smooth = false) {
            if(destroyed || (smooth && dialog.open) || !period)return;
            hoveredIndex=null;
            const rect=items[index].getBoundingClientRect();
            let offset=viewport.getBoundingClientRect().left+viewport.clientWidth/2-rect.left-rect.width/2;
            if(!dialog.open && !focus)offset-=Math.round(offset/period)*period;
            if(smooth && !reduced) seekMotion={from:railX,to:railX+offset,start:performance.now()};
            else {seekMotion=null;railX+=offset;track.style.transform='translate3d('+railX+'px,0,0)';render(false);}
            select(index,false);
            if(focus){restoringFocus=true;items[index].focus({preventScroll:true});restoringFocus=false;}
        }

        function sourceFrame(item) {
            return (item.querySelector('.artifact-slice__frame') || item).getBoundingClientRect();
        }
        function animate(element, frames, options) {
            const animation = element.animate(frames, options);
            viewerAnimations.push(animation);
            return animation;
        }
        function cancelAnimations() {
            frameAnimation?.cancel();
            viewerAnimations.forEach(animation => animation.cancel());
            viewerAnimations = [];
        }
        function animateHeading(frames, options) {
            const animation = animate(heading, frames, options);
            const outlineAnimation = animate(outlineHeading, frames, options);
            return {
                finished: animation.finished,
                cancel() { animation.cancel(); outlineAnimation.cancel(); }
            };
        }
        function fitTitle() {
            // Reserve the actual caption height before exposing more of the lower row.
            const captionHeight = Math.max(description.offsetHeight, description.querySelector('.work-viewer__details').scrollHeight);
            dialog.style.setProperty('--viewer-footer-room', `${captionHeight + 16}px`);
            // Measure complete words at the design size, preserving native
            // kerning. A shared font-size reduction fits long names without
            // stretching short words or separating glyphs from their boxes.
            dialog.style.setProperty('--viewer-title-fit', 1);
            const fit = Math.min(1, ...titleRows.map(({ row, word }) =>
                row.clientWidth > 0 && word.offsetWidth > 0 ? row.clientWidth * .98 / word.offsetWidth : 1));
            dialog.style.setProperty('--viewer-title-fit', fit);
        }
        function setTitle(titleText) {
            heading.replaceChildren();
            outlineHeading.replaceChildren();
            heading.setAttribute('aria-label', titleText);
            const lines = titleLines(titleText);
            heading.dataset.rows = String(lines.length);
            outlineHeading.dataset.rows = String(lines.length);
            function createRow(line, parent) {
                const row = document.createElement('span');
                row.className = 'work-viewer__title-row';
                row.setAttribute('aria-hidden', 'true');
                const word = document.createElement('span');
                word.className = 'work-viewer__word';
                word.textContent = line;
                row.appendChild(word);
                parent.appendChild(row);
                return { row, word };
            }
            titleRows = lines.map(line => {
                const solid = createRow(line, heading);
                const outline = createRow(line, outlineHeading);
                return { ...solid, outlineRow: outline.row, outlineWord: outline.word };
            });
        }
        function setNeighbours(index) {
            neighbourButtons.forEach((holder, i) => {
                const adjacent = items[index + (i === 0 ? -1 : 1)];
                holder.replaceChildren();
                holder.disabled = !adjacent;
                holder.setAttribute('aria-label', `${i === 0 ? 'Previous' : 'Next'} project${adjacent ? ': ' + adjacent.dataset.title : ''}`);
                if (adjacent) holder.appendChild(cloneArtwork(adjacent));
                else if (document.activeElement === holder) closeButton.focus({ preventScroll: true });
            });
        }
        function cloneArtwork(item) {
            const artwork = item.querySelector('.artifact-artwork').cloneNode(true);
            if (artwork.tagName === 'IMG') artwork.loading = 'eager';
            artwork.setAttribute('aria-hidden', 'true');
            return artwork;
        }
        function setViewerContent(item) {
            document.getElementById('work-viewer-category').textContent = item.dataset.category;
            document.getElementById('work-viewer-meta').textContent = item.dataset.meta;
            document.getElementById('work-viewer-summary').textContent = item.dataset.summary;
            const aiStatement = item.dataset.aiStatement || '';
            document.getElementById('work-viewer-ai-text').textContent = aiStatement;
            document.getElementById('work-viewer-ai').hidden = !aiStatement;
            dialog.setAttribute('aria-describedby', aiStatement ? 'work-viewer-summary work-viewer-ai' : 'work-viewer-summary');
            const credit = document.getElementById('work-viewer-credit');
            if (credit) {
                credit.textContent = item.dataset.credit || '';
                credit.href = item.dataset.creditUrl || '#';
                credit.hidden = !item.dataset.creditUrl;
            }
            setTitle(item.dataset.title);
            const link = document.getElementById('work-viewer-link');
            link.href = item.href;
            const certificate = item.id === 'artifact-xuanwu';
            link.textContent = certificate ? 'View Certificate' : 'Explore';
            link.setAttribute('aria-label', certificate ? 'View QQ Xuanwu internship certificate (PDF)' : 'Explore ' + item.dataset.title);
        }
        function clearOutgoing() {
            outgoingFrame?.remove();
            outgoingFrame = null;
            neighbourButtons.forEach(button => button.style.removeProperty('visibility'));
        }
        function cancelSwitch() {
            switchVersion++;
            switching = false;
            queuedDirection = 0;
            dialog.removeAttribute('aria-busy');
            clearOutgoing();
        }
        async function switchItem(direction) {
            if (!dialog.open || closing || destroyed) return;
            if (switching) { queuedDirection = direction; return; }
            const nextIndex = viewerIndex + direction;
            const item = items[nextIndex];
            if (!item) return;
            switching = true;
            const version = ++switchVersion;
            const active = () => version === switchVersion && dialog.open && !closing && !destroyed;
            const artwork = cloneArtwork(item);
            dialog.setAttribute('aria-busy', 'true');
            // Adjacent images are eager-loaded when shown. Decode before moving
            // their crop into the centre so the transition never reveals a blank.
            if (artwork.decode) await artwork.decode().catch(() => {});
            if (!active()) return;
            const origin = frame.getBoundingClientRect();
            const source = neighbourButtons[direction > 0 ? 1 : 0];
            const destination = neighbourButtons[direction > 0 ? 0 : 1];
            const incomingRect = source.getBoundingClientRect();
            const outgoingRect = destination.getBoundingClientRect();
            const sourceOpacity = getComputedStyle(source).opacity;
            const sourceFilter = getComputedStyle(source).filter;
            const oldFrameOpacity = getComputedStyle(frame).opacity;
            const oldArtworkTransform = getComputedStyle(media.firstElementChild).transform;
            const oldHeadingOpacity = getComputedStyle(heading).opacity;
            const oldOutlineOpacity = getComputedStyle(outlineWindow).opacity;
            const oldDescriptionOpacity = getComputedStyle(description).opacity;
            const oldDescriptionTop = description.getBoundingClientRect().top;
            // The outgoing cover and incoming cover keep their own crop; the
            // dialog, page lock and central image dimensions stay in place.
            if (!reduced && frame.animate) {
                outgoingFrame = frame.cloneNode(true);
                outgoingFrame.classList.add('work-viewer__outgoing');
                outgoingFrame.setAttribute('aria-hidden', 'true');
                Object.assign(outgoingFrame.style, rectFrame(origin), { opacity: oldFrameOpacity });
                frame.before(outgoingFrame);
                neighbourButtons.forEach(button => { button.style.visibility = 'hidden'; });
            }
            cancelAnimations();
            viewerIndex = nextIndex;
            viewerMoved = true;
            opener = item;
            select(nextIndex, false);
            media.replaceChildren(artwork);
            if (reduced || !frame.animate) {
                setViewerContent(item);
                setNeighbours(viewerIndex);
                fitTitle();
                const nextDirection = queuedDirection;
                cancelSwitch();
                if (nextDirection) switchItem(nextDirection);
                return;
            }
            const timing = { duration: 960, easing: 'cubic-bezier(.22,.72,.18,1)' };
            animate(outgoingFrame, [
                { ...rectFrame(origin), opacity: oldFrameOpacity },
                { ...rectFrame(outgoingRect), opacity: .28 }
            ], { ...timing, fill: 'forwards' });
            animate(outgoingFrame.querySelector('.artifact-artwork'), [
                { filter: 'none', transform: oldArtworkTransform },
                { filter: 'grayscale(1)', transform: 'scale(1.035)' }
            ], { ...timing, fill: 'forwards' });
            const destinationRect = frame.getBoundingClientRect();
            frameAnimation = frame.animate([
                { ...rectFrame(incomingRect), opacity: sourceOpacity },
                { ...rectFrame(destinationRect), opacity: 1 }
            ], timing);
            const incomingAnimation = frameAnimation;
            animate(outlineWindow, [clipFrame(incomingRect), clipFrame(destinationRect)], timing);
            const outlineOut = animate(outlineWindow, [{ opacity: oldOutlineOpacity }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
            animate(artwork, [
                { filter: sourceFilter, transform: 'scale(1.045)' },
                { filter: 'none', transform: 'scale(1)' }
            ], timing);
            const titleOut = animateHeading([
                { opacity: oldHeadingOpacity, transform: 'translateX(0)' },
                { opacity: 0, transform: `translateX(${-direction * 32}px)` }
            ], { duration: 180, fill: 'forwards', easing: 'ease-out' });
            const descriptionOut = animate(description, [{ opacity: oldDescriptionOpacity }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
            const neighboursOut = animate(neighbours, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
            await titleOut.finished.catch(() => {});
            if (!active()) return;
            setViewerContent(item);
            setNeighbours(viewerIndex);
            // The outgoing cover occupies the opposite peek until the handoff
            // completes; avoid showing two overlapping copies at that edge.
            source.style.removeProperty('visibility');
            fitTitle();
            titleOut.cancel();
            outlineOut.cancel();
            descriptionOut.cancel();
            neighboursOut.cancel();
            animateHeading([
                { opacity: 0, transform: `translateX(${direction * 40}px)` },
                { opacity: 1, transform: 'translateX(0)' }
            ], { duration: 650, easing: timing.easing });
            animate(outlineWindow, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 400, fill: 'backwards', easing: timing.easing });
            const descriptionShift = oldDescriptionTop - description.getBoundingClientRect().top;
            animate(description, [
                { opacity: 0, transform: `translate(-50%, ${descriptionShift + 8}px)` },
                { opacity: 1, transform: 'translate(-50%, 0)' }
            ], { duration: 650, easing: timing.easing });
            animate(neighbours, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 380, fill: 'backwards' });
            await incomingAnimation.finished.catch(() => {});
            if (!active()) return;
            const nextDirection = queuedDirection;
            cancelAnimations();
            cancelSwitch();
            if (nextDirection) switchItem(nextDirection);
        }
        function resumePage() {
            document.documentElement.classList.remove('works-viewer-open');
            if (!wasStopped) lenis.start();
        }
        function openItem(item) {
            if (dialog.open || destroyed) return;
            seekMotion=null;
            const origin = sourceFrame(item);
            const source = item.querySelector('.artifact-artwork');
            const sourceFilter = getComputedStyle(source).filter;
            const sourceOpacity = getComputedStyle(item.querySelector('.artifact-slice__frame') || item).opacity;
            opener = item;
            const index = items.indexOf(item);
            viewerIndex = index;
            viewerMoved = false;
            cancelSwitch();
            select(index, false);
            settle();
            const artwork = cloneArtwork(item);
            media.replaceChildren(artwork);
            setNeighbours(index);
            setViewerContent(item);
            wasStopped = lenis.isStopped;
            lenis.stop();
            document.documentElement.classList.add('works-viewer-open');
            dialog.showModal();
            closeButton.focus({ preventScroll: true });
            cancelAnimations();
            fitTitle();
            if (!reduced && frame.animate) {
                const destination = frame.getBoundingClientRect();
                // Resize one isolated crop instead of wiping a full-screen image.
                // object-fit preserves the artwork's proportions throughout the opening.
                const timing = { duration: 1080, easing: 'cubic-bezier(.22,.72,.18,1)' };
                frameAnimation = frame.animate([
                    { ...rectFrame(origin), opacity: sourceOpacity },
                    { ...rectFrame(destination), opacity: 1 }
                ], timing);
                animate(outlineWindow, [clipFrame(origin), clipFrame(destination)], timing);
                animate(outlineWindow, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 700, fill: 'backwards', easing: timing.easing });
                animate(artwork, [
                    { filter: sourceFilter, transform: 'scale(1.045)' },
                    { filter: 'none', transform: 'scale(1)' }
                ], { ...timing, duration: 1380 });
                animate(surface, [{ backgroundColor: '#07070700' }, { backgroundColor: '#070707' }], { duration: 620, easing: 'ease' });
                animate(neighbours, [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 160, fill: 'backwards' });
                animate(topBar, [{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay: 180, fill: 'backwards' });
                titleRows.forEach(({ word, outlineWord }, rowIndex) => {
                    const frames = [
                        { opacity: 0, transform: 'translate(' + (rowIndex % 2 ? 14 : -14) + 'px, 16px)' },
                        { opacity: 1, transform: 'translate(0, 0)' }
                    ];
                    const options = { duration: 960, delay: 240 + rowIndex * 90, fill: 'backwards', easing: timing.easing };
                    animate(word, frames, options);
                    animate(outlineWord, frames, options);
                });
                animate(description, [
                    { opacity: 0, transform: 'translate(-50%, 12px)' },
                    { opacity: 1, transform: 'translate(-50%, 0)' }
                ], { duration: 620, delay: 640, fill: 'backwards', easing: 'cubic-bezier(.22,.72,.18,1)' });
            }
        }
        async function closeItem() {
            if (!dialog.open || closing) return;
            closing = true;
            cancelSwitch();
            // After browsing neighbours, return to the displayed project's
            // slice. Move the rail under the opaque viewer before shrinking it.
            if (viewerMoved) seek(viewerIndex);
            // Read the live animation state before cancelling: an early close must
            // return from the current crop, without jumping to its fully open size.
            const origin = frame.getBoundingClientRect();
            const artwork = dialog.querySelector('.work-viewer__media').firstElementChild;
            const sourceFilter = getComputedStyle(artwork).filter;
            const sourceTransform = getComputedStyle(artwork).transform;
            const frameOpacity = getComputedStyle(frame).opacity;
            const backgroundColor = getComputedStyle(surface).backgroundColor;
            const outlineOpacity = getComputedStyle(outlineWindow).opacity;
            const fading = [heading, outlineHeading, description, topBar, neighbours, ...titleRows.flatMap(({ word, outlineWord }) => [word, outlineWord])]
                .map(element => ({ element, opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform }));
            cancelAnimations();
            if (!reduced && frame.animate && opener) {
                const timing = { duration: 760, delay: 120, fill: 'both', easing: 'cubic-bezier(.55,0,.2,1)' };
                animate(outlineWindow, [{ opacity: outlineOpacity }, { opacity: 0 }], { duration: 100, fill: 'forwards' });
                animate(outlineWindow, [clipFrame(origin), clipFrame(sourceFrame(opener))], timing);
                fading.forEach(({ element, opacity, transform }) => animate(element, [
                    { opacity, transform }, { opacity: 0, transform }
                ], { duration: 240, fill: 'forwards' }));
                animate(surface, [{ backgroundColor }, { backgroundColor: '#07070700' }], timing);
                animate(artwork, [
                    { filter: sourceFilter, transform: sourceTransform },
                    { filter: getComputedStyle(opener.querySelector('.artifact-artwork')).filter, transform: 'scale(1)' }
                ], timing);
                frameAnimation = frame.animate([
                    { ...rectFrame(origin), opacity: frameOpacity },
                    { ...rectFrame(sourceFrame(opener)), opacity: getComputedStyle(opener.querySelector('.artifact-slice__frame') || opener).opacity }
                ], timing);
                await frameAnimation.finished.catch(() => {});
            }
            if (destroyed) return;
            restoringFocus = true;
            dialog.close();
            cancelAnimations();
            resumePage();
            opener?.focus({ preventScroll: true });
            restoringFocus = false;
            closing = false;
            previousX = null;
        }

        items.forEach((item, index) => {
            item.setAttribute('aria-haspopup', 'dialog');
            item.setAttribute('aria-controls', dialog.id);
            item.addEventListener('click', event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                if (!dialog.showModal) { rememberReturn(item); return; }
                event.preventDefault();
                openItem(item);
            }, { signal });
            item.addEventListener('focus', () => {
                if (!restoringFocus && !dialog.open && item.matches(':focus-visible')) seek(index, true);
            }, { signal });
            item.addEventListener('keydown', event => {
                const next = event.key === 'ArrowRight' ? Math.min(items.length - 1, index + 1)
                    : event.key === 'ArrowLeft' ? Math.max(0, index - 1)
                    : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
                if (next === null) return;
                event.preventDefault();
                seek(next, true);
            }, { signal });
        });
        closeButton.addEventListener('click', closeItem, { signal });
        neighbourButtons.forEach((button, i) => {
            button.addEventListener('click', () => switchItem(i === 0 ? -1 : 1), { signal });
        });
        dialog.addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
            if (!direction) return;
            event.preventDefault();
            if (!event.repeat) switchItem(direction);
        }, { signal });
        dialog.addEventListener('click', event => {
            if (event.target === dialog || event.target === surface) closeItem();
        }, { signal });
        window.addEventListener('resize', () => {
            if (!dialog.open || closing) return;
            if (switching) {
                cancelSwitch();
                cancelAnimations();
                setViewerContent(items[viewerIndex]);
                setNeighbours(viewerIndex);
            } else cancelAnimations();
            fitTitle();
        }, { signal });
        if (document.fonts) document.fonts.ready.then(() => {
            if (!destroyed && dialog.open) fitTitle();
        });
        dialog.addEventListener('cancel', event => { event.preventDefault(); closeItem(); }, { signal });
        viewport.addEventListener('scroll', onScroll, { passive: true, signal });
        window.addEventListener('scroll', onScroll, { passive: true, signal });
        lenis.on('scroll', onScroll);
        if (native) track.style.removeProperty('transform');
        else viewport.scrollLeft = 0;
        measure();
        autoFrame=requestAnimationFrame(autoplay);
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(measure);
        });
        observer.observe(featured);
        observer.observe(track);

        return {
            refresh: measure,
            focusTarget(target) {
                const item = target.matches('.artifact-slice') ? target : target.querySelector('.artifact-slice');
                const index = items.indexOf(item);
                if (index < 0) return false;
                // BFCache can bring back a still-open viewer and stopped Lenis.
                // Return directly to the filmstrip without replaying its close.
                if (dialog.open) {
                    cancelSwitch();
                    cancelAnimations();
                    dialog.close();
                    resumePage();
                    closing = false;
                }
                measure();
                previousX = null;
                seek(index);
                lenis.scrollTo(featured,{immediate:true,force:true});
                settle();
                return true;
            },
            destroy() {
                destroyed = true;
                cancelSwitch();
                controller.abort();
                cancelAnimationFrame(autoFrame);visibilityObserver.disconnect();
                copies.forEach(copy=>copy.remove());positionLabel.remove();featured.classList.remove('is-looping');
                observer.disconnect();
                cancelAnimationFrame(resizeFrame);
                captionAnimation?.cancel();
                cancelAnimations();
                settle();
                lenis.off('scroll', onScroll);
                if (dialog.open) { dialog.close(); resumePage(); }
                track.style.removeProperty('transform');
                runway.style.removeProperty('height');
                indexNav.replaceChildren();
            }
        };
    }
    if (root) root.setupIndexWorks = setupIndexWorks;
    if (typeof module !== 'undefined' && module.exports) module.exports = { scrollState, positionForIndex, titleLines, rectFrame, clipFrame, setupIndexWorks };
})(typeof window === 'undefined' ? null : window);
