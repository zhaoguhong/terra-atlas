import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './components/MapLegend.css'
import './components/MobileSheet.css'
import './components/LayerPanel.css'
import './components/Exploration.css'
import './appearance.css'
async function start(){
  // Keep the pre-rendered article visible while its interactive module loads.
  if(document.getElementById('initial-article'))await import('./components/TopicReader')
  createRoot(document.getElementById('root')!).render(<App />)
}
void start()
