import Sidebar from "./Components/Sidebar"
import Dashboard from "./Screens/Dashboard"
import {Routes,Route} from 'react-router-dom'
import Projects from "./Screens/Projects"
function App() {
  return (
    <div className="flex">
    <Sidebar/>
    <div className="ml-64">
      <Routes>
        <Route path='/' element = {<Dashboard/>}/>
        <Route path="/projects" element={<Projects/>}/>
      </Routes>
    </div> 
    </div>
  )
}

export default App
