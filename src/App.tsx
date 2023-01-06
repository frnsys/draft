import './App.css';
import React from 'react'
import Graph from './components/Graph';
import Status, { StatusProvider } from './components/Status';

function App() {
  return <StatusProvider>
    <>
      <Status />
      <Graph />
    </>
  </StatusProvider>
}

export default App;
