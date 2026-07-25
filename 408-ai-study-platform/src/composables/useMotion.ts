import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Scroll reveal helper for H5 pages.
 */
export function useScrollReveal(
  selector = '.section, .panel, .soft-card, .hero-shell, .metric-card, .option, .step-item, .pdf-row, .mode-item, .auth-panel, .answer'
) {
  const observerRef = ref<IntersectionObserver | null>(null);

  onMounted(() => {
    // #ifdef H5
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll(selector).forEach(el => observer.observe(el));
    observerRef.value = observer;
    // #endif
  });

  onUnmounted(() => {
    observerRef.value?.disconnect();
  });
}

/**
 * Count-up animation for numeric metrics.
 */
export function useCountUp(end: number, duration = 800, start = 0) {
  const current = ref(start);
  let rafId: number | null = null;

  const run = (target: number) => {
    if (typeof window === 'undefined') return;
    if (rafId) cancelAnimationFrame(rafId);
    const from = current.value;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      current.value = Math.round(from + (target - from) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
  };

  onMounted(() => run(end));

  onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });

  return { current, run };
}

/**
 * H5 ripple effect for click targets.
 */
export function useRipple(event: MouseEvent | TouchEvent, color = 'rgba(255, 255, 255, 0.35)') {
  // #ifdef H5
  if (typeof window === 'undefined') return;
  const target = event.currentTarget as HTMLElement | null;
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  const x = clientX - rect.left - size / 2;
  const y = clientY - rect.top - size / 2;

  ripple.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background: ${color};
    transform: scale(0);
    opacity: 0.6;
    pointer-events: none;
    animation: rippleExpand 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  `;

  target.style.overflow = 'hidden';
  target.appendChild(ripple);
  setTimeout(() => ripple.remove(), 460);
  // #endif
}
