---
name: react-expert
description: Use when building React 18/19 applications in Vite, specifically for Client-Side Rendering (CSR). Creates components, implements custom hooks, debugs rendering issues, and manages state. Invoke for React Router setup, Suspense boundaries, useActionState forms, performance optimization, or React 19 features in a Vite setup.
license: MIT
metadata:
  author: Adapted from Jeff Allan (https://github.com/Jeffallan) for Vite
  version: "1.1.0"
  domain: frontend
  triggers: React, JSX, hooks, useState, useEffect, useContext, Vite, React 19, Suspense, React Router, component, frontend
  role: specialist
  scope: implementation
  output-format: code
---

# React Expert (Vite + React 19 Edition)

Senior React specialist with deep expertise in React 19 client-side features, Vite bundling, and production-grade CSR architecture.

## When to Use This Skill

- Building new React components or features in Vite
- Implementing client-side routing with `react-router-dom` v7
- Optimizing React performance (memo, useCallback)
- Implementing forms with React 19 actions (`useActionState`)
- Data fetching patterns using React Router loaders/actions or TanStack Query

## Core Workflow

1. **Analyze requirements** - Identify component hierarchy, state needs, data flow
2. **Choose patterns** - Select appropriate state management, data fetching approach
3. **Implement** - Write TypeScript components with proper types
4. **Validate** - Run `tsc --noEmit`; fix all type issues before proceeding
5. **Optimize** - Apply memoization where needed, ensure accessibility
6. **Test** - Write tests with React Testing Library if applicable

## Key Patterns

### React Router v7 Loader & Component
```tsx
import { useLoaderData, json } from 'react-router-dom';
import { db } from '@/lib/db-client'; // client-side fetcher

interface User {
  id: string;
  name: string;
}

export async function usersLoader() {
  const users = await db.fetchUsers();
  return json({ users });
}

export default function UsersPage() {
  const { users } = useLoaderData() as { users: User[] };

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### React 19 Form with `useActionState` (Client-Side)
```tsx
import { useActionState } from 'react';
import { api } from '@/lib/api';

async function submitForm(_prev: string, formData: FormData): Promise<string> {
  const name = formData.get('name') as string;
  await api.post('/hello', { name });
  return `Hello, ${name}!`;
}

export function GreetForm() {
  const [message, action, isPending] = useActionState(submitForm, '');

  return (
    <form action={action}>
      <input name="name" required className="border p-2 rounded" />
      <button type="submit" disabled={isPending} className="bg-blue-500 text-white p-2">
        {isPending ? 'Submitting…' : 'Submit'}
      </button>
      {message && <p className="text-green-600">{message}</p>}
    </form>
  );
}
```

## Constraints

### MUST DO
- Use TypeScript with strict mode
- Implement error boundaries for graceful failures
- Use `key` props correctly (stable, unique identifiers)
- Clean up effects (return cleanup function in `useEffect`)
- Use semantic HTML and ARIA for accessibility
- Memoize when passing callbacks/objects to memoized children

### MUST NOT DO
- Mutate state directly
- Use array index as key for dynamic lists
- Create functions inside JSX (causes re-renders)
- Forget useEffect cleanup (memory leaks)
- Ignore React strict mode warnings

## Knowledge Reference
React 19, Vite, useActionState, Suspense, TypeScript, React Router DOM, Radix UI, Tailwind CSS, Accessibility (WCAG).
