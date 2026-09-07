import React from 'react';

const DynamicWidget = React.lazy(() => import('../components/Header'));

export default function HomePage() {
  return (
    <main>
      <h2>Home Route</h2>
      <React.Suspense fallback={<div>Loading...</div>}>
        <DynamicWidget />
      </React.Suspense>
    </main>
  );
}
