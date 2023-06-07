const clipPath = [`circle()`]

document.documentElement.animate(
  {
    clipPath
  },
  {
    duration: 500,
    easing: 'ease-out',
    pseudoElement: '::view-transition-new(root)'
  }
)

document.documentElement.animate(
  {
    clipPath
  },
  {
    duration: 500,
    easing: /* tw-mangle ignore */ 'ease-out',
    pseudoElement: '::view-transition-new(root)'
  }
)
