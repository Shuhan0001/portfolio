/* Original synthesized UI cues: metallic scan, data ticks and a low confirmation hit. */
(() => {
    'use strict';
    window.createProjectSoundSynth = context => {
        const bus = context.createGain();
        const compressor = context.createDynamicsCompressor();
        const output = context.createGain();
        compressor.threshold.value = -20;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.12;
        output.gain.value = 0.65;
        bus.connect(compressor).connect(output).connect(context.destination);

        // Two quiet reflections, without a feedback loop or a continuous ambient bed.
        for (const [time, level, pan] of [[0.064, 0.22, -0.45], [0.118, 0.13, 0.45]]) {
            const delay = context.createDelay(0.2);
            const filter = context.createBiquadFilter();
            const gain = context.createGain();
            const stereo = context.createStereoPanner();
            delay.delayTime.value = time;
            filter.type = 'lowpass';
            filter.frequency.value = 3400;
            gain.gain.value = level;
            stereo.pan.value = pan;
            bus.connect(delay).connect(filter).connect(gain).connect(stereo).connect(compressor);
        }

        const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.25), context.sampleRate);
        const samples = noise.getChannelData(0);
        let seed = 3917;
        for (let i = 0; i < samples.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            samples[i] = seed / 2147483648 - 1;
        }

        function envelope(peak, attack, duration, time) {
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, time);
            gain.gain.exponentialRampToValueAtTime(peak, time + attack);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            gain.gain.linearRampToValueAtTime(0, time + duration + 0.008);
            return gain;
        }

        function tone(time, duration, startHz, endHz, peak, { type = 'sine', fm = 0, ratio = 2.73, pan = 0 } = {}) {
            const oscillator = context.createOscillator();
            const gain = envelope(peak, 0.003, duration, time);
            const stereo = context.createStereoPanner();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(startHz, time);
            oscillator.frequency.exponentialRampToValueAtTime(endHz, time + duration);
            stereo.pan.value = pan;
            const nodes = [oscillator, gain, stereo];
            if (fm) {
                const modulator = context.createOscillator();
                const depth = context.createGain();
                modulator.frequency.setValueAtTime(startHz * ratio, time);
                modulator.frequency.exponentialRampToValueAtTime(endHz * ratio, time + duration);
                depth.gain.setValueAtTime(fm, time);
                depth.gain.exponentialRampToValueAtTime(0.01, time + duration);
                modulator.connect(depth).connect(oscillator.frequency);
                modulator.start(time);
                modulator.stop(time + duration + 0.01);
                nodes.push(modulator, depth);
            }
            oscillator.connect(gain).connect(stereo).connect(bus);
            oscillator.onended = () => nodes.forEach(node => node.disconnect());
            oscillator.start(time);
            oscillator.stop(time + duration + 0.012);
        }

        function air(time, duration, startHz, endHz, peak) {
            const source = context.createBufferSource();
            const filter = context.createBiquadFilter();
            const gain = envelope(peak, 0.004, duration, time);
            source.buffer = noise;
            filter.type = 'bandpass';
            filter.Q.value = 2.6;
            filter.frequency.setValueAtTime(startHz, time);
            filter.frequency.exponentialRampToValueAtTime(endHz, time + duration);
            source.connect(filter).connect(gain).connect(bus);
            source.onended = () => [source, filter, gain].forEach(node => node.disconnect());
            source.start(time);
            source.stop(time + duration + 0.012);
        }

        return {
            hover(time, index) {
                const pitch = 1 + index * 0.028;
                const pan = (index % 3 - 1) * 0.18;
                tone(time, 0.14, 780 * pitch, 1420 * pitch, 0.068, { fm: 920, pan });
                tone(time, 0.065, 290, 150, 0.026, { type: 'triangle' });
                tone(time + 0.026, 0.037, 2600 * pitch, 1820 * pitch, 0.024, { pan: -pan });
                tone(time + 0.073, 0.045, 1900 * pitch, 2240 * pitch, 0.016, { pan });
                air(time, 0.058, 4700, 1900, 0.038);
            },
            press(time, index) {
                const pitch = 1 + index * 0.018;
                tone(time, 0.21, 145, 48, 0.17);
                tone(time, 0.10, 360, 90, 0.065, { type: 'triangle' });
                tone(time + 0.006, 0.20, 1750 * pitch, 340 * pitch, 0.10, { fm: 2400, ratio: 2.41 });
                tone(time + 0.045, 0.075, 1300 * pitch, 1600 * pitch, 0.046, { pan: -0.2 });
                tone(time + 0.115, 0.095, 2100 * pitch, 1800 * pitch, 0.035, { pan: 0.2 });
                air(time, 0.14, 3200, 700, 0.065);
            }
        };
    };
})();
