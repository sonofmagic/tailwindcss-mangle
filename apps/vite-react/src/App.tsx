import { twMerge } from 'tailwind-merge'
import reactLogo from './assets/react.svg'

import { cn } from './utils'

// 'hover:bg-dark-red p-3 bg-[#B91C1C]'
const aaa = twMerge('px-2 py-1 bg-red-100 hover:bg-red-800', 'p-3 bg-[#B91C1C]')
const bbb = cn(
  {
    'p-3': true,
  },
  'p-1',
  ['p-2', true && 'p-4'],
)
function App() {
  return (
    <div className="w-screen">
      <div className="container mx-auto">
        <main className="px-2 py-1 bg-red-100 hover:bg-red-800 flex min-h-screen flex-col items-center justify-between p-24 ">
          <nav className={aaa}>{aaa}</nav>
          <nav className={bbb}>{bbb}</nav>
          <nav className="p-3">ccc</nav>
          <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
            <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
              Get started by editing&nbsp;
              <code className="font-mono font-bold">pages/index.tsx</code>
            </p>
            <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
              <a
                className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
                href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
                target="_blank"
                rel="noopener noreferrer"
              >
                By
                {' '}
                <img src="/vite.svg" alt="Vercel Logo" className="dark:invert" width={100} height={24} />
              </a>
            </div>
          </div>

          <div className="relative flex place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700/10 after:dark:from-sky-900 after:dark:via-[#0141ff]/40 before:lg:h-[360px]">
            <img className="relative dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert" src={reactLogo} alt="Next.js Logo" width={180} height={37} />
          </div>

          <div className="mb-32 grid text-center lg:mb-0 lg:grid-cols-4 lg:text-left">
            <a
              href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
              className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h2 className={` mb-3 text-2xl font-semibold`}>
                Docs
                {' '}
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">-&gt;</span>
              </h2>
              <p className={` m-0 max-w-[30ch] text-sm opacity-50`}>Find in-depth information about Next.js features and API.</p>
            </a>

            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
              className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h2 className={` mb-3 text-2xl font-semibold`}>
                Learn
                {' '}
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">-&gt;</span>
              </h2>
              <p className={` m-0 max-w-[30ch] text-sm opacity-50`}>Learn about Next.js in an interactive course with&nbsp;quizzes!</p>
            </a>

            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
              className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h2 className={` mb-3 text-2xl font-semibold`}>
                Templates
                {' '}
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">-&gt;</span>
              </h2>
              <p className={` m-0 max-w-[30ch] text-sm opacity-50`}>Discover and deploy boilerplate example Next.js&nbsp;projects.</p>
            </a>

            <a
              href="https://vercel.com/new?utm_source=create-next-app&utm_medium=default-template-tw&utm_campaign=create-next-app"
              className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
              target="_blank"
              rel="noopener noreferrer"
            >
              <h2 className={` mb-3 text-2xl font-semibold`}>
                Deploy
                {' '}
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">-&gt;</span>
              </h2>
              <p className={` m-0 max-w-[30ch] text-sm opacity-50`}>Instantly deploy your Next.js site to a shareable URL with Vercel.</p>
            </a>
          </div>
        </main>
      </div>
    </div>

  )
}

export default App
