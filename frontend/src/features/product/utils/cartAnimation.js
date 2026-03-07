export function triggerAddToCartAnimation(sourceElement) {
  if (!sourceElement) return

  const targetElement = document.getElementById('customer-cart-button')
  if (!targetElement) {
    window.dispatchEvent(new Event('gymcore:cart-pulse'))
    return
  }

  const sourceRect = sourceElement.getBoundingClientRect()
  const targetRect = targetElement.getBoundingClientRect()
  const startX = sourceRect.left + sourceRect.width / 2
  const startY = sourceRect.top + sourceRect.height / 2
  const endX = targetRect.left + targetRect.width / 2
  const endY = targetRect.top + targetRect.height / 2
  const dx = endX - startX
  const dy = endY - startY

  const ghost = document.createElement('div')
  ghost.className = 'pointer-events-none fixed z-[120] h-4 w-4 rounded-full border border-gym-600 bg-gym-500/80 shadow-lg'
  ghost.style.left = `${startX}px`
  ghost.style.top = `${startY}px`
  ghost.style.transform = 'translate(-50%, -50%)'
  document.body.appendChild(ghost)

  const animation = ghost.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.95 },
      { transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.45}px)) scale(0.82)`, opacity: 0.9, offset: 0.65 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.25)`, opacity: 0.15 },
    ],
    { duration: 650, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)', fill: 'forwards' },
  )

  animation.onfinish = () => {
    ghost.remove()
    window.dispatchEvent(new Event('gymcore:cart-pulse'))
  }
}
