export function isAnimatedImage(source = '') {
  return /\.gif(?:[?#].*)?$/i.test(source)
}