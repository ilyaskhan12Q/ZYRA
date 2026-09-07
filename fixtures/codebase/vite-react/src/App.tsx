import React, { useState } from 'react';
import './App.css';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <h1>Vite + React</h1>
      <button onClick={() => setCount((c) => c + 1)}>
        count is {count}
      </button>
    </div>
  );
}
export default App;
