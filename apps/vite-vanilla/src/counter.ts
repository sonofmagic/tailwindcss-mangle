export function setupCounter(element: HTMLButtonElement) {
  let counter = 0
  const setCounter = (count: number) => {
    counter = count
    element.innerHTML = `<div class="lg:dark:bg-zinc-800/30 dark:bg-zinc-800/30">count is ${counter}</div>`
  }
  element.addEventListener('click', () => setCounter(counter + 1))
  setCounter(0)
}
