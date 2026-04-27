/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import * as React from 'react'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title: 'Atelier AI Store',
      },
      {
        name: 'description',
        content:
          'A modern AI-assisted fashion storefront with voice recommendations and virtual try-on.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <header className="site-header">
          <Link className="brand" to="/">
            <span>Atelier</span>
            <strong>AI</strong>
          </Link>
          <nav>
            <Link activeProps={{ className: 'active' }} to="/">
              Store
            </Link>
            <Link activeProps={{ className: 'active' }} to="/studio">
              In-store AI
            </Link>
          </nav>
        </header>
        {children}
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'TanStack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
