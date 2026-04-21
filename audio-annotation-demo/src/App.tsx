import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import NavBar   from './components/NavBar'
import Landing  from './pages/Landing'
import Queue    from './pages/Queue'
import Annotate from './pages/Annotate'
import Review   from './pages/Review'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
        <NavBar />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/"         element={<Landing />} />
            <Route path="/queue"    element={<Queue />} />
            <Route path="/annotate" element={<Annotate />} />
            <Route path="/review"   element={<Review />} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
