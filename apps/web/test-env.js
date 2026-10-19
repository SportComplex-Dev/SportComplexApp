import React from 'react';
import { setAuthenticateOverride } from './src/lib/api/auth-overrides.ts';

process.env.NODE_ENV = 'test';
global.React = React;
globalThis.React = React;

try {
  const hooksContext = await import('next/dist/shared/lib/hooks-client-context.shared-runtime.js');
  if (hooksContext && hooksContext.PathnameContext) {
    hooksContext.PathnameContext._currentValue = '/admin';
    hooksContext.PathnameContext._currentValue2 = '/admin';
  }
} catch {
  // Ignorar si el path difiere en diferentes builds
}

// Puente exclusivo de tests: permite seguir usando `globalThis.__scAuthSession`
// sin que el código de producción conozca ese global.
setAuthenticateOverride(async () => globalThis.__scAuthSession ?? null);
